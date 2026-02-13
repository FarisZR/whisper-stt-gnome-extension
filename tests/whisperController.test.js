import GLib from 'gi://GLib';

import {test, assert, assertEqual, assertIncludes} from './harness.js';
import {WhisperController} from '../src/core/whisperController.js';

function waitMs(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

function createDeps(overrides = {}) {
    const calls = [];

    const deps = {
        getSettings() {
            return {};
        },
        createRecordingPath() {
            calls.push('createRecordingPath');
            return '/tmp/recording.wav';
        },
        async startRecording(path) {
            calls.push(`startRecording:${path}`);
            return {
                async stop() {
                    calls.push('recording.stop');
                },
            };
        },
        async startLevelMonitor(onLevel) {
            calls.push('startLevelMonitor');
            onLevel(0.4);
            return {
                async stop() {
                    calls.push('level.stop');
                },
            };
        },
        async transcribeRecording() {
            calls.push('transcribeRecording');
            return 'hello world';
        },
        async copyToClipboard(text) {
            calls.push(`copyToClipboard:${text}`);
        },
        async playTone(kind) {
            calls.push(`playTone:${kind}`);
        },
        showOverlay() {
            calls.push('showOverlay');
        },
        hideOverlay() {
            calls.push('hideOverlay');
        },
        updateOverlay(level) {
            calls.push(`updateOverlay:${level.toFixed(1)}`);
        },
        notify(message) {
            calls.push(`notify:${message}`);
        },
        async cleanupRecording(path) {
            calls.push(`cleanupRecording:${path}`);
        },
        ...overrides,
    };

    return {deps, calls};
}

test('first toggle starts recording and overlay', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.toggle();

    assertEqual(controller.state, 'recording');
    assert(calls.includes('showOverlay'));
    assert(calls.includes('updateOverlay:0.4'));
});

test('second toggle stops, transcribes, copies and plays tone', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('recording.stop'));
    assert(calls.includes('level.stop'));
    assert(calls.includes('transcribeRecording'));
    assert(calls.includes('copyToClipboard:hello world'));
    assert(calls.includes('playTone:success'));
});

test('empty transcription skips clipboard copy', async () => {
    const {deps, calls} = createDeps({
        async transcribeRecording() {
            calls.push('transcribeRecording');
            return '   ';
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assert(!calls.some(c => c.startsWith('copyToClipboard:')));
    assert(calls.includes('playTone:success'));
});

test('non-string transcription skips clipboard copy', async () => {
    const {deps, calls} = createDeps({
        async transcribeRecording() {
            calls.push('transcribeRecording');
            return null;
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assert(!calls.some(c => c.startsWith('copyToClipboard:')));
    assert(calls.includes('playTone:success'));
});

test('empty api key still allows successful flow', async () => {
    const {deps, calls} = createDeps({
        getSettings() {
            return {apiKey: ''};
        },
        async transcribeRecording(path, settings) {
            calls.push(`transcribeRecording:key=${settings.apiKey}`);
            return 'works without auth';
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assert(calls.includes('transcribeRecording:key='));
    assert(calls.includes('copyToClipboard:works without auth'));
});

test('start failure returns to idle and notifies', async () => {
    const {deps, calls} = createDeps({
        async startRecording() {
            throw new Error('recorder missing');
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.some(c => c.startsWith('notify:Failed to start recording')));
});

test('level monitor start failure stops recorder and notifies', async () => {
    const {deps, calls} = createDeps({
        async startLevelMonitor() {
            throw new Error('monitor failed');
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('recording.stop'));
    assert(calls.some(c => c.startsWith('notify:Failed to start recording')));
});

test('transcription failure returns to idle and plays error tone', async () => {
    const {deps, calls} = createDeps({
        async transcribeRecording() {
            throw new Error('HTTP 401');
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('playTone:error'));
    assert(calls.some(c => c.startsWith('notify:Transcription failed')));
});

test('hanging success tone does not keep controller transcribing', async () => {
    const {deps, calls} = createDeps({
        operationTimeoutMs: 30,
        async playTone(kind) {
            calls.push(`playTone:${kind}`);
            return await new Promise(() => {});
        },
    });

    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('copyToClipboard:hello world'));
    assert(calls.includes('playTone:success'));
});

test('hanging recorder stop does not keep controller transcribing', async () => {
    const {deps, calls} = createDeps({
        operationTimeoutMs: 30,
        async startRecording(path) {
            calls.push(`startRecording:${path}`);
            return {
                async stop() {
                    calls.push('recording.stop');
                    return await new Promise(() => {});
                },
            };
        },
    });

    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('copyToClipboard:hello world'));
});

test('hanging clipboard copy times out and allows next recording', async () => {
    const {deps, calls} = createDeps({
        operationTimeoutMs: 30,
        async copyToClipboard(text) {
            calls.push(`copyToClipboard:${text}`);
            return await new Promise(() => {});
        },
    });

    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.some(c => c.startsWith('notify:Transcription ready, but clipboard copy timed out.')));

    await controller.toggle();
    const startCalls = calls.filter(c => c.startsWith('startRecording:'));
    assertEqual(startCalls.length, 2);
});

test('invalid operation timeout falls back to default', () => {
    const {deps} = createDeps({
        operationTimeoutMs: Number.NaN,
        transcriptionTimeoutMs: Number.NaN,
        clipboardTimeoutMs: Number.NaN,
        transcribingWatchdogMs: Number.NaN,
    });

    const controller = new WhisperController(deps);
    assertEqual(controller._operationTimeoutMs, 700);
    assertEqual(controller._transcriptionTimeoutMs, 120000);
    assertEqual(controller._clipboardTimeoutMs, 2500);
    assertEqual(controller._transcribingWatchdogMs, 150000);
});

test('toggle while transcribing reports busy', async () => {
    let resolveTranscription;
    const {deps, calls} = createDeps({
        async transcribeRecording() {
            calls.push('transcribeRecording');
            return await new Promise(resolve => {
                resolveTranscription = resolve;
            });
        },
    });

    const controller = new WhisperController(deps);

    await controller.toggle();
    const pending = controller.toggle();

    for (let i = 0; i < 40 && typeof resolveTranscription !== 'function'; i += 1)
        await Promise.resolve();

    await controller.toggle();
    assert(typeof resolveTranscription === 'function');
    resolveTranscription('done');
    await pending;

    const busyNotification = calls.find(c => c.startsWith('notify:Transcription in progress'));
    assertIncludes(String(busyNotification), 'Transcription in progress');
});

test('toggle reports busy when state is transcribing without active lock', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    controller._state = 'transcribing';
    controller._toggleInFlight = false;

    await controller.toggle();

    assert(calls.some(c => c.startsWith('notify:Transcription in progress')));
});

test('disable while recording stops resources and cleans up', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.disable();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('hideOverlay'));
    assert(calls.includes('recording.stop'));
    assert(calls.includes('level.stop'));
    assert(calls.includes('cleanupRecording:/tmp/recording.wav'));
});

test('disable from idle is a no-op', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.disable();

    assertEqual(controller.state, 'idle');
    assert(!calls.includes('hideOverlay'));
});

test('disable from transcribing resets state to idle', async () => {
    const {deps} = createDeps();
    const controller = new WhisperController(deps);

    controller._state = 'transcribing';
    controller._session = {path: '/tmp/recording.wav'};

    await controller.disable();

    assertEqual(controller.state, 'idle');
    assertEqual(controller._session, null);
});

test('watchdog resets transcribing state and cleans up', async () => {
    const {deps, calls} = createDeps({
        transcribingWatchdogMs: 100,
    });
    const controller = new WhisperController(deps);

    controller._state = 'transcribing';
    controller._session = {path: '/tmp/recording.wav'};
    controller._startTranscribingWatchdog(controller._session);

    await waitMs(180);

    assertEqual(controller.state, 'idle');
    assert(calls.some(c => c.startsWith('notify:Transcription took too long')));
    assert(calls.includes('cleanupRecording:/tmp/recording.wav'));
});

test('watchdog exits quietly when no longer transcribing', async () => {
    const {deps, calls} = createDeps({
        transcribingWatchdogMs: 100,
    });
    const controller = new WhisperController(deps);

    controller._state = 'idle';
    controller._session = null;
    controller._startTranscribingWatchdog({path: '/tmp/recording.wav'});

    await waitMs(180);

    assert(!calls.some(c => c.startsWith('notify:Transcription took too long')));
});

test('no detected speech skips transcription and notifies', async () => {
    const {deps, calls} = createDeps({
        async startLevelMonitor(onLevel) {
            calls.push('startLevelMonitor');
            for (let i = 0; i < 8; i += 1)
                onLevel(0.02);

            return {
                async stop() {
                    calls.push('level.stop');
                },
            };
        },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(!calls.includes('transcribeRecording'));
    assert(calls.some(c => c.startsWith('notify:No audio detected or no speech')));
    assert(calls.includes('playTone:error'));
});

test('recording state with missing session resets to idle', async () => {
    const {deps} = createDeps();
    const controller = new WhisperController(deps);

    controller._state = 'recording';
    controller._session = null;

    await controller.toggle();

    assertEqual(controller.state, 'idle');
});
