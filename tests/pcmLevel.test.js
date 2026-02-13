import {test, assert, assertEqual} from './harness.js';
import {pcmS16Level} from '../src/core/pcmLevel.js';

function samplesToBytes(samples) {
    const bytes = new Uint8Array(samples.length * 2);

    for (let i = 0; i < samples.length; i += 1) {
        let value = Math.max(-32768, Math.min(32767, samples[i]));

        if (value < 0)
            value = 0x10000 + value;

        bytes[i * 2] = value & 0xff;
        bytes[i * 2 + 1] = (value >> 8) & 0xff;
    }

    return bytes;
}

test('pcmS16Level returns zero for empty input', () => {
    assertEqual(pcmS16Level(new Uint8Array()), 0);
});

test('pcmS16Level returns zero for silence', () => {
    const bytes = samplesToBytes([0, 0, 0, 0, 0, 0]);
    assertEqual(pcmS16Level(bytes), 0);
});

test('pcmS16Level detects moderate speech-like amplitude', () => {
    const bytes = samplesToBytes([1200, -1100, 1500, -1400, 800, -900]);
    const level = pcmS16Level(bytes);

    assert(level > 0.05);
    assert(level < 0.5);
});

test('pcmS16Level clamps loud samples to one', () => {
    const bytes = samplesToBytes([32767, -32768, 32767, -32768]);
    assertEqual(pcmS16Level(bytes), 1);
});
