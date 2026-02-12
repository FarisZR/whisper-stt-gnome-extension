import {normalizeSettings} from './settings.js';

export class WhisperController {
    constructor(deps) {
        this._deps = deps;

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

        await session.levelMonitor.stop();
        await session.recorder.stop();
        await this._deps.cleanupRecording(session.path);

        this._state = 'idle';
        this._session = null;
    }

    async _startRecording() {
        const settings = normalizeSettings(this._deps.getSettings());
        const path = this._deps.createRecordingPath();
        let recorder = null;

        try {
            recorder = await this._deps.startRecording(path, settings);
            const levelMonitor = await this._deps.startLevelMonitor(level => {
                this._deps.updateOverlay(level);
            }, settings);

            this._session = {
                path,
                settings,
                recorder,
                levelMonitor,
            };

            this._deps.showOverlay();
            this._state = 'recording';
        } catch (error) {
            await recorder?.stop();
            await this._deps.cleanupRecording(path);
            this._state = 'idle';
            this._session = null;
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

        try {
            this._deps.hideOverlay();

            await session.levelMonitor.stop();
            await session.recorder.stop();

            const transcript = await this._deps.transcribeRecording(session.path, session.settings);
            const cleaned = typeof transcript === 'string' ? transcript.trim() : '';

            if (cleaned.length > 0) {
                await this._deps.copyToClipboard(cleaned);
                this._deps.notify('Transcription copied to clipboard');
            } else {
                this._deps.notify('Transcription finished with empty text');
            }

            await this._deps.playTone('success');
        } catch (error) {
            this._deps.notify(`Transcription failed: ${error.message}`);
            await this._deps.playTone('error');
        } finally {
            await this._deps.cleanupRecording(session.path);
            this._session = null;
            this._state = 'idle';
        }
    }
}
