import {test, assert, assertEqual} from './harness.js';
import {createSpeechDetector} from '../src/core/speechDetector.js';

test('speech detector starts without speech', () => {
    const detector = createSpeechDetector();
    assertEqual(detector.hasSpeech(), false);
});

test('speech detector stays false for quiet levels', () => {
    const detector = createSpeechDetector();

    for (let i = 0; i < 20; i += 1)
        detector.pushLevel(0.03);

    assertEqual(detector.hasSpeech(), false);
});

test('speech detector becomes true for sustained speech levels', () => {
    const detector = createSpeechDetector();

    detector.pushLevel(0.15);
    detector.pushLevel(0.18);
    detector.pushLevel(0.17);
    detector.pushLevel(0.16);

    assertEqual(detector.hasSpeech(), true);
});

test('speech detector becomes true for a loud short burst', () => {
    const detector = createSpeechDetector();
    detector.pushLevel(0.31);
    assertEqual(detector.hasSpeech(), true);
});

test('speech detector ignores invalid level values', () => {
    const detector = createSpeechDetector();

    detector.pushLevel(Number.NaN);
    detector.pushLevel(undefined);
    detector.pushLevel('a');

    assert(detector.getStats().sampleCount >= 3);
    assertEqual(detector.hasSpeech(), false);
});
