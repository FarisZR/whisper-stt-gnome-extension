import GLib from 'gi://GLib';

import {normalizeSettings} from './settings.js';
import {createSpeechDetector} from './speechDetector.js';

const TIMEOUTS = {
    operation: [700, 50],
    recorderStop: [12000, 100],
    disableRecorderStop: [2500, 100],
    transcription: [120000, 100],
    clipboard: [2500, 50],
};

export class WhisperController {
    constructor(deps) {
        this._deps = deps;
        this._timeouts = Object.fromEntries(Object.entries(TIMEOUTS).map(([name, [fallback, minimum]]) => {
            const value = deps[`${name}TimeoutMs`];
            return [name, Number.isFinite(value) ? Math.max(minimum, value) : fallback];
        }));
        this._state = 'idle';
        this._disabled = false;
        this._session = null;
        this._toggleInFlight = false;
        this._activeOperation = null;
        this._restartPromise = null;
    }

    get state() {
        return this._state;
    }

    async toggle() {
        if (this._disabled)
            return;
        if (this._state === 'transcribing') {
            this._restartPromise ??= this._replaceRecording().finally(() => {
                this._restartPromise = null;
            });
            return await this._restartPromise;
        }
        if (this._toggleInFlight)
            return;

        this._toggleInFlight = true;

        try {
            if (this._state === 'idle') {
                await this._startRecording();
                return;
            }

            if (this._state === 'recording') {
                this._activeOperation = this._finishRecording();
                await this._activeOperation;
            }
        } finally {
            this._toggleInFlight = false;
        }
    }

    async _replaceRecording() {
        this._session.discarded = true;
        this._session.cancel();
        this._deps.cancelTranscription?.();
        await this._activeOperation;
        await this.toggle();
    }

    async disable() {
        this._disabled = true;
        this._session?.cancel();
        this._deps.cancelTranscription?.();

        if (this._state !== 'recording') {
            this._state = 'idle';
            const session = this._session;
            this._session = null;
            if (session)
                await this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
            return;
        }

        const session = this._session;
        this._deps.hideOverlay();
        this._state = 'idle';
        this._session = null;

        await this._runBestEffort(
            () => session.recorder.stop(),
            this._timeouts.disableRecorderStop
        );
        await this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
    }

    async _startRecording() {
        const settings = normalizeSettings(this._deps.getSettings());
        const path = this._deps.createRecordingPath();
        const speechDetector = createSpeechDetector();
        let recorder = null;

        try {
            recorder = await this._deps.startRecording(path, level => {
                if (this._disabled)
                    return;
                speechDetector.pushLevel(level);
                this._deps.updateOverlay(level);
            });
            if (this._disabled) {
                await this._runBestEffort(() => recorder.stop(), this._timeouts.recorderStop);
                await this._runBestEffort(() => this._deps.cleanupRecording(path), 1000);
                return;
            }

            let cancel;
            const cancellation = new Promise(resolve => { cancel = resolve; });
            this._session = {
                cancellation,
                cancel,
                discarded: false,
                path,
                settings,
                recorder,
                speechDetector,
            };

            this._deps.showOverlay();
            this._state = 'recording';
        } catch (error) {
            this._state = 'idle';
            this._session = null;

            await this._runBestEffort(() => recorder?.stop?.(), this._timeouts.recorderStop);
            await this._runBestEffort(() => this._deps.cleanupRecording(path), 1000);

            if (!this._disabled)
                this._deps.notify(`Failed to start recording: ${error.message}`);
        }
    }

    async _finishRecording() {
        const session = this._session;

        this._state = 'transcribing';
        let toneKind = 'success';

        try {
            this._deps.hideOverlay();

            try {
                await this._runWithTimeout(
                    () => session.recorder.stop(),
                    this._timeouts.recorderStop
                );
            } catch (error) {
                if (this._disabled || session.discarded)
                    return;
                this._deps.notify(`Recording failed to finalize: ${error.message}`);
                toneKind = 'error';
                return;
            }

            if (this._disabled || session.discarded)
                return;

            if (!session.speechDetector.hasSpeech()) {
                this._deps.notify('No audio detected or no speech.');
                toneKind = 'error';
                return;
            }

            const transcript = await this._runWithTimeout(
                () => this._deps.transcribeRecording(session.path, session.settings),
                this._timeouts.transcription,
                session.cancellation
            );
            if (this._disabled || session.discarded)
                return;
            const cleaned = typeof transcript === 'string' ? transcript.trim() : '';

            if (cleaned.length > 0) {
                let copied = false;

                try {
                    await this._runWithTimeout(
                        () => this._deps.copyToClipboard(cleaned),
                        this._timeouts.clipboard,
                        session.cancellation
                    );
                    copied = true;
                } catch (_error) {
                    copied = false;
                }

                if (this._disabled || session.discarded)
                    return;

                if (copied)
                    this._deps.notify('Transcription copied to clipboard');
                else
                    this._deps.notify('Transcription ready, but clipboard copy timed out.');
            } else {
                this._deps.notify('Transcription finished with empty text');
            }

        } catch (error) {
            if (!this._disabled && !session.discarded)
                this._deps.notify(`Transcription failed: ${error.message}`);
            toneKind = 'error';
        } finally {
            this._session = null;
            this._state = 'idle';

            if (!this._disabled && !session.discarded)
                void this._runBestEffort(() => this._deps.playTone(toneKind));
            this._deps.cancelTranscription?.();
            await this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
        }
    }

    async _runBestEffort(action, timeoutMs = this._timeouts.operation) {
        try {
            await this._runWithTimeout(action, timeoutMs);
        } catch (_error) {
            // Best effort operations (tone/cleanup) should not block state progress.
        }
    }

    async _runWithTimeout(action, timeoutMs, cancellation = null) {
        let timeoutId = 0;

        try {
            const timeoutPromise = new Promise((_resolve, reject) => {
                timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
                    timeoutId = 0;
                    reject(new Error('Operation timed out'));
                    return GLib.SOURCE_REMOVE;
                });
            });

            return await Promise.race([
                Promise.resolve().then(action),
                timeoutPromise,
                ...(cancellation ? [cancellation] : []),
            ]);
        } finally {
            if (timeoutId !== 0)
                GLib.source_remove(timeoutId);
        }
    }
}
