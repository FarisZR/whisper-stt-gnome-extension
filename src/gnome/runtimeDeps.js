import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {buildRecordingCommand} from '../core/pipelineCommand.js';
import {parseLevelLine, smoothLevel} from '../core/levelParser.js';
import {buildCurlArgs} from '../core/curlCommand.js';
import {splitBodyAndStatus, parseTranscriptionResponse} from '../core/transcriptionParser.js';
import {runCommand, spawnLineProcess} from './process.js';

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
    const icon = kind === 'error' ? 'dialog-warning' : 'complete';

    try {
        await runCommand(['canberra-gtk-play', '-i', icon]);
    } catch (_error) {
        // Tone is best effort.
    }
}

export function createRuntimeDeps({settings, overlay, title}) {
    const levelListeners = new Set();
    let currentLevel = 0;

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
                onStdoutLine: line => {
                    const level = parseLevelLine(line);
                    if (level === null)
                        return;

                    currentLevel = smoothLevel(currentLevel, level, 0.35);

                    for (const listener of levelListeners)
                        listener(currentLevel);
                },
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

            return {
                async stop() {
                    levelListeners.delete(onLevel);
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
            _deleteFile(path);
        },
    };
}
