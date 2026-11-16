import GLib from 'gi://GLib';

import {test, assert, assertEqual} from './harness.js';
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
        async startRecording(path, onLevel) {
            calls.push(`startRecording:${path}`);
            onLevel(0.4);
            return {async stop() { calls.push('recording.stop'); }};
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

test('disable during startup releases late resources without showing overlay', async () => {
    let finishStart;
    const {deps, calls} = createDeps({
        startRecording() {
            return new Promise(resolve => { finishStart = resolve; });
        },
    });
    const controller = new WhisperController(deps);
    const starting = controller.toggle();
    await controller.disable();
    finishStart({async stop() { calls.push('late.stop'); }});
    await starting;
    assertEqual(controller.state, 'idle');
    assert(calls.includes('late.stop'));
    assert(!calls.includes('showOverlay'));
});

test('disable during transcription suppresses late clipboard and notifications', async () => {
    let finish;
    const {deps, calls} = createDeps({
        transcribeRecording() { return new Promise(resolve => { finish = resolve; }); },
    });
    const controller = new WhisperController(deps);
    await controller.toggle();
    const pending = controller.toggle();
    for (let i = 0; i < 100 && !finish; i += 1)
        await Promise.resolve();
    assert(finish, 'transcription was not reached');
    await controller.disable();
    const afterDisable = calls.length;
    finish('late text');
    await pending;
    assert(!calls.slice(afterDisable).some(c => /^(copyToClipboard|notify|playTone):/.test(c)));
    assert(calls.includes('cleanupRecording:/tmp/recording.wav'));
});

test('second toggle stops, transcribes, copies and plays tone', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('recording.stop'));
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

test('muting sounds preserves successful clipboard copy and notification', async () => {
    const {deps, calls} = createDeps({getSettings() { return {soundsEnabled: false}; }});
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('copyToClipboard:hello world'));
    assert(calls.includes('notify:Transcription copied to clipboard'));
    assert(!calls.some(c => c.startsWith('playTone:')));
});

test('muting sounds also suppresses error tones and preserves error notifications', async () => {
    const {deps, calls} = createDeps({
        getSettings() { return {soundsEnabled: false}; },
        async transcribeRecording() { throw new Error('HTTP 401'); },
    });
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.toggle();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('notify:Transcription failed: HTTP 401'));
    assert(!calls.some(c => c.startsWith('playTone:')));
});

test('sound preference changes take effect for the current recording', async () => {
    let soundsEnabled = true;
    const {deps, calls} = createDeps({getSettings() { return {soundsEnabled}; }});
    const controller = new WhisperController(deps);

    await controller.toggle();
    soundsEnabled = false;
    await controller.toggle();
    assert(!calls.some(c => c.startsWith('playTone:')));

    await controller.toggle();
    soundsEnabled = true;
    await controller.toggle();
    assertEqual(calls.filter(c => c === 'playTone:success').length, 1);
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

test('hanging recorder stop aborts transcription instead of uploading partial audio', async () => {
    const {deps, calls} = createDeps({
        recorderStopTimeoutMs: 30,
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

    for (let i = 0; i < 20 && !calls.includes('playTone:error'); i += 1)
        await Promise.resolve();

    assertEqual(controller.state, 'idle');
    assert(!calls.includes('transcribeRecording'));
    assert(!calls.includes('copyToClipboard:hello world'));
    assert(calls.some(c => c.startsWith('notify:Recording failed to finalize: Operation timed out')));
    assert(calls.includes('playTone:error'));
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

test('toggle while transcribing discards the old result and starts a new recording', async () => {
    let resolveTranscription;
    let requests = 0;
    const {deps, calls} = createDeps({
        cancelTranscription() { calls.push('cancelTranscription'); },
        async transcribeRecording() {
            calls.push('transcribeRecording');
            if (++requests > 1)
                return 'replacement text';
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

    const replacement = controller.toggle();
    let completed = false;
    replacement.then(() => { completed = true; });
    for (let i = 0; i < 100 && !completed; i += 1)
        await Promise.resolve();
    assert(completed, 'replacement must not wait for the discarded response');
    assert(typeof resolveTranscription === 'function');
    resolveTranscription('done');
    await pending;

    assertEqual(controller.state, 'recording');
    assertEqual(calls.filter(c => c.startsWith('startRecording:')).length, 2);
    assert(!calls.some(c => c.startsWith('copyToClipboard:')));
    assert(!calls.includes('playTone:success'));
    assert(calls.includes('cancelTranscription'));
    await controller.toggle();
    assertEqual(controller.state, 'idle');
    assert(calls.includes('copyToClipboard:replacement text'));
    assert(!calls.includes('copyToClipboard:done'));
    await controller.disable();
});

test('disable while recording stops resources and cleans up', async () => {
    const {deps, calls} = createDeps();
    const controller = new WhisperController(deps);

    await controller.toggle();
    await controller.disable();

    assertEqual(controller.state, 'idle');
    assert(calls.includes('hideOverlay'));
    assert(calls.includes('recording.stop'));
    assert(calls.includes('cleanupRecording:/tmp/recording.wav'));
});

test('disable bounds recorder shutdown separately from transcription finalization', async () => {
    const {deps, calls} = createDeps({
        disableRecorderStopTimeoutMs: 100,
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
    const started = GLib.get_monotonic_time();

    await controller.toggle();
    await controller.disable();

    const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
    assertEqual(controller.state, 'idle');
    assert(elapsedMs < 1000, `disable took ${elapsedMs} ms`);
    assert(calls.includes('recording.stop'));
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
        async startRecording(path, onLevel) {
            for (let i = 0; i < 8; i += 1)
                onLevel(0.02);
            return {async stop() { calls.push('recording.stop'); }};
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


test('transcription timeout returns to idle and permits another recording', async () => {
    const {deps, calls} = createDeps({
        transcriptionTimeoutMs: 100,
        transcribeRecording() { return new Promise(() => {}); },
    });
    const controller = new WhisperController(deps);
    await controller.toggle();
    await controller.toggle();
    assertEqual(controller.state, 'idle');
    assert(calls.some(c => c.startsWith('notify:Transcription failed: Operation timed out')));
    await controller.toggle();
    assertEqual(controller.state, 'recording');
    await controller.disable();
});
