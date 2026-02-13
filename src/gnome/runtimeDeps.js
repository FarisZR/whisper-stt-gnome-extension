import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {buildRecordingCommand} from '../core/pipelineCommand.js';
import {smoothLevel} from '../core/levelParser.js';
import {pcmS16Level} from '../core/pcmLevel.js';
import {buildCurlArgs} from '../core/curlCommand.js';
import {splitBodyAndStatus, parseTranscriptionResponse} from '../core/transcriptionParser.js';
import {getToneEvents} from '../core/toneEvents.js';
import {runCommand, spawnLineProcess, spawnByteProcess} from './process.js';

const METER_STALE_TIMEOUT_US = 250000;
const METER_DECAY_INTERVAL_MS = 50;
const METER_DECAY_SMOOTHING = 0.2;

function _settingsToObject(settings) {
    return {
        endpoint: settings.get_string('transcription-endpoint'),
        model: settings.get_string('transcription-model'),
        apiKey: settings.get_string('api-key'),
        language: settings.get_string('language'),
        prompt: settings.get_string('prompt'),
        responseFormat: settings.get_string('response-format'),
        shortcut: settings.get_strv('toggle-recording-shortcut'),
    };
}

function _createRecordingPath() {
    const timestamp = GLib.DateTime.new_now_local().format('%Y%m%d-%H%M%S');
    return GLib.build_filenamev([GLib.get_tmp_dir(), `whisper-stt-${timestamp}.wav`]);
}

function _deleteFile(path) {
    if (!path)
        return;

    try {
        GLib.unlink(path);
    } catch (_error) {
        // Ignore failed cleanup.
    }
}

async function _transcribeRecording(path, settings) {
    const args = buildCurlArgs(settings, path);
    const {stdout, stderr, success} = await runCommand(args);
    const {body, statusCode} = splitBodyAndStatus(stdout);

    if (!success && statusCode === 0)
        throw new Error(stderr || body || 'Transcription request failed');

    return parseTranscriptionResponse(body, statusCode);
}

async function _copyToClipboard(text) {
    const result = await runCommand(['wl-copy'], text);

    if (result.success)
        return;

    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
}

async function _playTone(kind) {
    const eventIds = getToneEvents(kind);

    for (const eventId of eventIds) {
        try {
            const result = await runCommand(['canberra-gtk-play', '-i', eventId]);

            if (result.success)
                return;
        } catch (_error) {
            // Try fallback tone ids.
        }
    }
}

export function createRuntimeDeps({settings, overlay, title}) {
    const levelListeners = new Set();
    let currentLevel = 0;
    let meterProcess = null;
    let meterDecayTimeoutId = 0;
    let lastMeterSampleAt = 0;

    const notifyLevelListeners = () => {
        for (const listener of levelListeners)
            listener(currentLevel);
    };

    const startMeterDecay = () => {
        if (meterDecayTimeoutId !== 0)
            return;

        meterDecayTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, METER_DECAY_INTERVAL_MS, () => {
            if (levelListeners.size === 0)
                return GLib.SOURCE_CONTINUE;

            const now = GLib.get_monotonic_time();

            if (now - lastMeterSampleAt > METER_STALE_TIMEOUT_US) {
                currentLevel = smoothLevel(currentLevel, 0, METER_DECAY_SMOOTHING);
                notifyLevelListeners();
            }

            return GLib.SOURCE_CONTINUE;
        });
        GLib.Source.set_name_by_id(meterDecayTimeoutId, '[whisper-stt] meter-decay');
    };

    const stopMeterDecay = () => {
        if (meterDecayTimeoutId === 0)
            return;

        GLib.source_remove(meterDecayTimeoutId);
        meterDecayTimeoutId = 0;
    };

    const startMeter = () => {
        if (meterProcess)
            return;

        try {
            lastMeterSampleAt = GLib.get_monotonic_time();

            meterProcess = spawnByteProcess([
                'pw-record',
                '--raw',
                '--rate',
                '16000',
                '--channels',
                '1',
                '--format',
                's16',
                '-',
            ], {
                onStdoutChunk: chunk => {
                    const level = pcmS16Level(chunk);
                    lastMeterSampleAt = GLib.get_monotonic_time();
                    currentLevel = smoothLevel(currentLevel, level, 0.25);
                    notifyLevelListeners();
                },
                onStderrLine: line => {
                    if (line.toLowerCase().includes('error'))
                        log(`[whisper-stt] meter: ${line}`);
                },
            });

            startMeterDecay();
        } catch (error) {
            meterProcess = null;
            log(`[whisper-stt] Failed to start microphone meter: ${error}`);
        }
    };

    const stopMeter = async () => {
        stopMeterDecay();

        if (!meterProcess) {
            currentLevel = 0;
            lastMeterSampleAt = 0;
            return;
        }

        const process = meterProcess;
        meterProcess = null;
        await process.stop();
        currentLevel = 0;
        lastMeterSampleAt = 0;
    };

    return {
        getSettings() {
            return _settingsToObject(settings);
        },

        createRecordingPath() {
            return _createRecordingPath();
        },

        async startRecording(path) {
            currentLevel = 0;
            const command = buildRecordingCommand(path);
            const processHandle = spawnLineProcess(command, {
                onStderrLine: line => {
                    if (line.includes('ERROR'))
                        log(`[whisper-stt] ${line}`);
                },
            });

            return {
                async stop() {
                    await processHandle.stop();
                },
            };
        },

        async startLevelMonitor(onLevel) {
            levelListeners.add(onLevel);
            onLevel(currentLevel);
            startMeter();

            return {
                async stop() {
                    levelListeners.delete(onLevel);

                    if (levelListeners.size === 0)
                        await stopMeter();
                },
            };
        },

        async transcribeRecording(path, normalizedSettings) {
            return await _transcribeRecording(path, normalizedSettings);
        },

        async copyToClipboard(text) {
            await _copyToClipboard(text);
        },

        async playTone(kind) {
            await _playTone(kind);
        },

        showOverlay() {
            overlay.show();
        },

        hideOverlay() {
            overlay.hide();
        },

        updateOverlay(level) {
            overlay.update(level);
        },

        notify(message) {
            Main.notify(title, message);
        },

        async cleanupRecording(path) {
            if (levelListeners.size === 0)
                await stopMeter();

            _deleteFile(path);
        },
    };
}
