import GLib from 'gi://GLib';

import {normalizeSettings} from './settings.js';
import {createSpeechDetector} from './speechDetector.js';

const OPERATION_TIMEOUT_MS = 700;
const TRANSCRIPTION_TIMEOUT_MS = 120000;

export class WhisperController {
    constructor(deps) {
        const {
            operationTimeoutMs = OPERATION_TIMEOUT_MS,
            ...runtimeDeps
        } = deps;

        this._deps = runtimeDeps;
        this._operationTimeoutMs = Number.isFinite(operationTimeoutMs)
            ? Math.max(50, operationTimeoutMs)
            : OPERATION_TIMEOUT_MS;

        this._state = 'idle';
        this._session = null;
    }

    get state() {
        return this._state;
    }

    async toggle() {
        if (this._state === 'transcribing') {
            this._deps.notify('Transcription in progress');
            return;
        }

        if (this._state === 'idle') {
            await this._startRecording();
            return;
        }

        if (this._state === 'recording')
            await this._finishRecording();
    }

    async disable() {
        if (this._state !== 'recording') {
            this._state = 'idle';
            this._session = null;
            return;
        }

        const session = this._session;
        this._deps.hideOverlay();
        this._state = 'idle';
        this._session = null;

        await this._runBestEffort(() => session.levelMonitor.stop());
        await this._runBestEffort(() => session.recorder.stop());
        await this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
    }

    async _startRecording() {
        const settings = normalizeSettings(this._deps.getSettings());
        const path = this._deps.createRecordingPath();
        const speechDetector = createSpeechDetector();
        let recorder = null;

        try {
            recorder = await this._deps.startRecording(path, settings);
            const levelMonitor = await this._deps.startLevelMonitor(level => {
                speechDetector.pushLevel(level);
                this._deps.updateOverlay(level);
            }, settings);

            this._session = {
                path,
                settings,
                recorder,
                levelMonitor,
                speechDetector,
            };

            this._deps.showOverlay();
            this._state = 'recording';
        } catch (error) {
            this._state = 'idle';
            this._session = null;

            await this._runBestEffort(() => recorder?.stop?.());
            await this._runBestEffort(() => this._deps.cleanupRecording(path), 1000);

            this._deps.notify(`Failed to start recording: ${error.message}`);
        }
    }

    async _finishRecording() {
        const session = this._session;

        if (!session) {
            this._state = 'idle';
            return;
        }

        this._state = 'transcribing';
        let toneKind = 'success';

        try {
            this._deps.hideOverlay();

            await this._runBestEffort(() => session.levelMonitor.stop(), 1000);
            await this._runBestEffort(() => session.recorder.stop(), 1000);

            if (!session.speechDetector.hasSpeech()) {
                this._deps.notify('No audio detected or no speech.');
                toneKind = 'error';
                return;
            }

            const transcript = await this._runWithTimeout(
                () => this._deps.transcribeRecording(session.path, session.settings),
                TRANSCRIPTION_TIMEOUT_MS
            );
            const cleaned = typeof transcript === 'string' ? transcript.trim() : '';

            if (cleaned.length > 0) {
                await this._deps.copyToClipboard(cleaned);
                this._deps.notify('Transcription copied to clipboard');
            } else {
                this._deps.notify('Transcription finished with empty text');
            }

        } catch (error) {
            this._deps.notify(`Transcription failed: ${error.message}`);
            toneKind = 'error';
        } finally {
            this._session = null;
            this._state = 'idle';

            void this._runBestEffort(() => this._deps.playTone(toneKind));
            void this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
        }
    }

    async _runBestEffort(action, timeoutMs = this._operationTimeoutMs) {
        try {
            await this._runWithTimeout(action, timeoutMs);
        } catch (_error) {
            // Best effort operations (tone/cleanup) should not block state progress.
        }
    }

    async _runWithTimeout(action, timeoutMs) {
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
            ]);
        } finally {
            if (timeoutId !== 0)
                GLib.source_remove(timeoutId);
        }
    }
}
