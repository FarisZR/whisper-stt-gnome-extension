import {test, assert, assertEqual, assertIncludes} from './harness.js';
import {WhisperController} from '../src/core/whisperController.js';

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

test('invalid operation timeout falls back to default', () => {
    const {deps} = createDeps({
        operationTimeoutMs: Number.NaN,
    });

    const controller = new WhisperController(deps);
    assertEqual(controller._operationTimeoutMs, 700);
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

    for (let i = 0; i < 5 && typeof resolveTranscription !== 'function'; i += 1)
        await Promise.resolve();

    await controller.toggle();
    assert(typeof resolveTranscription === 'function');
    resolveTranscription('done');
    await pending;

    const busyNotification = calls.find(c => c.startsWith('notify:Transcription in progress'));
    assertIncludes(String(busyNotification), 'Transcription in progress');
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
