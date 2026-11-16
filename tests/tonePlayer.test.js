import {test, assertEqual, assertDeepEqual, assert} from './harness.js';
import {playTone} from '../src/core/tonePlayer.js';

test('success tone plays only the light message cue', async () => {
    const commands = [];
    await playTone('success', {
        async runCommand(argv) {
            commands.push(argv);
            return {success: true};
        },
    });
    assertDeepEqual(commands, [['canberra-gtk-play', '-i', 'message-new-instant']]);
});

test('unsuccessful playback does not trigger more sounds', async () => {
    const events = [];
    await playTone('success', {
        async runCommand(argv) {
            events.push(argv[2]);
            return {success: false};
        },
    });
    assertDeepEqual(events, ['message-new-instant']);
});

test('playback timeout does not trigger fallback sounds', async () => {
    let calls = 0;
    await playTone('success', {
        async runCommand() {
            calls += 1;
            throw new Error('Operation timed out');
        },
    });
    assertEqual(calls, 1);
});

test('error feedback attempts only one sound even when playback fails', async () => {
    let calls = 0;
    await playTone('error', {async runCommand() { calls += 1; return {success: false}; }});
    assertEqual(calls, 1);
});

test('unavailable sound player does not fail transcription feedback', async () => {
    await playTone('success', {async runCommand() { throw new Error('player unavailable'); }});
});

test('success and error feedback use different sound events', async () => {
    const events = [];
    const deps = {async runCommand(argv) { events.push(argv[2]); return {success: true}; }};
    await playTone('success', deps);
    await playTone('error', deps);
    assert(events[0] !== events[1]);
});
