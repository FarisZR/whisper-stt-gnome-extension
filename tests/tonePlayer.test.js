import {test, assertEqual, assert} from './harness.js';
import {playTone} from '../src/core/tonePlayer.js';

test('tone player tries alternatives after missing and unsuccessful events', async () => {
    const events = [];
    await playTone('success', {
        async runCommand(argv) {
            events.push(argv[2]);
            if (events.length === 1)
                throw new Error('event missing');
            return {success: events.length === 3};
        },
    });
    assertEqual(events.length, 3);
    assertEqual(new Set(events).size, 3);
});

test('tone player stops after the first available event', async () => {
    let calls = 0;
    await playTone('error', {async runCommand() { calls += 1; return {success: true}; }});
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
