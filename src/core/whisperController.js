import GLib from 'gi://GLib';

import {normalizeSettings} from './settings.js';
import {createSpeechDetector} from './speechDetector.js';

const OPERATION_TIMEOUT_MS = 700;
const TRANSCRIPTION_TIMEOUT_MS = 120000;
const CLIPBOARD_TIMEOUT_MS = 2500;
const TRANSCRIBING_WATCHDOG_MS = 150000;

export class WhisperController {
    constructor(deps) {
        const {
            operationTimeoutMs = OPERATION_TIMEOUT_MS,
            transcriptionTimeoutMs = TRANSCRIPTION_TIMEOUT_MS,
            clipboardTimeoutMs = CLIPBOARD_TIMEOUT_MS,
            transcribingWatchdogMs = TRANSCRIBING_WATCHDOG_MS,
            ...runtimeDeps
        } = deps;

        this._deps = runtimeDeps;
        this._operationTimeoutMs = Number.isFinite(operationTimeoutMs)
            ? Math.max(50, operationTimeoutMs)
            : OPERATION_TIMEOUT_MS;
        this._transcriptionTimeoutMs = Number.isFinite(transcriptionTimeoutMs)
            ? Math.max(100, transcriptionTimeoutMs)
            : TRANSCRIPTION_TIMEOUT_MS;
        this._clipboardTimeoutMs = Number.isFinite(clipboardTimeoutMs)
            ? Math.max(50, clipboardTimeoutMs)
            : CLIPBOARD_TIMEOUT_MS;
        this._transcribingWatchdogMs = Number.isFinite(transcribingWatchdogMs)
            ? Math.max(100, transcribingWatchdogMs)
            : TRANSCRIBING_WATCHDOG_MS;

        this._state = 'idle';
        this._session = null;
        this._toggleInFlight = false;
        this._transcribingWatchdogId = 0;
    }

    get state() {
        return this._state;
    }

    async toggle() {
        if (this._toggleInFlight) {
            if (this._state === 'transcribing')
                this._deps.notify('Transcription in progress');

            return;
        }

        this._toggleInFlight = true;

        try {
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
        } finally {
            this._toggleInFlight = false;
        }
    }

    async disable() {
        this._clearTranscribingWatchdog();

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
        this._startTranscribingWatchdog(session);
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
                this._transcriptionTimeoutMs
            );
            const cleaned = typeof transcript === 'string' ? transcript.trim() : '';

            if (cleaned.length > 0) {
                let copied = false;

                try {
                    await this._runWithTimeout(
                        () => this._deps.copyToClipboard(cleaned),
                        this._clipboardTimeoutMs
                    );
                    copied = true;
                } catch (_error) {
                    copied = false;
                }

                if (copied)
                    this._deps.notify('Transcription copied to clipboard');
                else
                    this._deps.notify('Transcription ready, but clipboard copy timed out.');
            } else {
                this._deps.notify('Transcription finished with empty text');
            }

        } catch (error) {
            this._deps.notify(`Transcription failed: ${error.message}`);
            toneKind = 'error';
        } finally {
            this._clearTranscribingWatchdog();
            this._session = null;
            this._state = 'idle';

            void this._runBestEffort(() => this._deps.playTone(toneKind));
            void this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);
        }
    }

    _startTranscribingWatchdog(session) {
        this._clearTranscribingWatchdog();

        this._transcribingWatchdogId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._transcribingWatchdogMs, () => {
            if (this._state !== 'transcribing')
                return GLib.SOURCE_REMOVE;

            this._deps.notify('Transcription took too long. Resetting state.');
            this._state = 'idle';
            this._session = null;

            void this._runBestEffort(() => this._deps.cleanupRecording(session.path), 1000);

            this._transcribingWatchdogId = 0;
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._transcribingWatchdogId, '[whisper-stt] transcribing-watchdog');
    }

    _clearTranscribingWatchdog() {
        if (this._transcribingWatchdogId === 0)
            return;

        GLib.source_remove(this._transcribingWatchdogId);
        this._transcribingWatchdogId = 0;
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
