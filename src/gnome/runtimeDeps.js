import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {buildRecordingCommand} from '../core/pipelineCommand.js';
import {parseLevelLine} from '../core/levelParser.js';
import {buildCurlArgs} from '../core/curlCommand.js';
import {splitBodyAndStatus, parseTranscriptionResponse} from '../core/transcriptionParser.js';
import {playTone} from '../core/tonePlayer.js';
import {runCommand, spawnLineProcess} from './process.js';

function _settingsToObject(settings) {
    return {
        endpoint: settings.get_string('transcription-endpoint'),
        model: settings.get_string('transcription-model'),
        apiKey: settings.get_string('api-key'),
        language: settings.get_string('language'),
        prompt: settings.get_string('prompt'),
        responseFormat: settings.get_string('response-format'),
        soundsEnabled: settings.get_boolean('sounds-enabled'),
        proxyEnabled: settings.get_boolean('proxy-enabled'),
        proxyType: settings.get_string('proxy-type'),
        proxyHost: settings.get_string('proxy-host'),
        proxyPort: settings.get_string('proxy-port'),
        proxyUsername: settings.get_string('proxy-username'),
        proxyPassword: settings.get_string('proxy-password'),
        bypassVpnEnabled: settings.get_boolean('bypass-vpn-enabled'),
        bypassVpnInterface: settings.get_string('bypass-vpn-interface'),
    };
}

function _createRecordingPath() {
    const timestamp = GLib.uuid_string_random();
    return GLib.build_filenamev([GLib.get_tmp_dir(), `whisper-stt-${timestamp}.wav`]);
}

function _deleteFile(path) {
    if (!path)
        return;

    try {
        GLib.unlink(path);
    } catch (_error) {
    }
}

async function _transcribeRecording(path, settings, cancellable) {
    const args = buildCurlArgs(settings, path);
    const {stdout, stderr, success} = await runCommand(args, null, {cancellable});
    const {body, statusCode} = splitBodyAndStatus(stdout);

    if (!success && statusCode === 0)
        throw new Error(stderr || body || 'Transcription request failed');

    return parseTranscriptionResponse(body, statusCode);
}

async function _copyToClipboard(text) {
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
}

export function createRuntimeDeps({settings, overlay, title}) {
    let transcription = null;


    return {
        getSettings() {
            return _settingsToObject(settings);
        },

        createRecordingPath() {
            return _createRecordingPath();
        },

        async startRecording(path, onLevel) {
            return spawnLineProcess(buildRecordingCommand(path), {
                onStdoutLine: line => {
                    const level = parseLevelLine(line);
                    if (level !== null)
                        onLevel(level);
                },
                onStderrLine: line => {
                    if (line.includes('ERROR'))
                        console.error(`[whisper-stt] ${line}`);
                },
            });
        },

        async transcribeRecording(path, normalizedSettings) {
            const operation = new Gio.Cancellable();
            transcription = operation;
            try {
                return await _transcribeRecording(path, normalizedSettings, operation);
            } finally {
                if (transcription === operation)
                    transcription = null;
            }
        },

        cancelTranscription() {
            transcription?.cancel();
        },

        async copyToClipboard(text) {
            await _copyToClipboard(text);
        },

        async playTone(kind) {
            await playTone(kind, {runCommand});
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
