import {test, assertEqual, assert} from './harness.js';
import {parseLevelLine, smoothLevel} from '../src/core/levelParser.js';

test('parseLevelLine extracts the loudest peak and normalizes it', () => {
    const line = 'endtime=(guint64)100000000, peak=(GValueArray)< -45.0, -20.0 >;';
    const value = parseLevelLine(line);

    assert(value !== null);
    assert(value > 0.6);
    assert(value < 0.7);
});

test('parseLevelLine clamps very quiet levels to zero', () => {
    assertEqual(parseLevelLine('peak=(GValueArray)< -80.0, -90.0 >'), 0);
});

test('parseLevelLine returns null for unrelated lines', () => {
    assertEqual(parseLevelLine('state-changed: paused -> playing'), null);
});

test('parseLevelLine returns null for malformed peak section', () => {
    assertEqual(parseLevelLine('peak=something-weird'), null);
});

test('parseLevelLine returns null for empty peak values', () => {
    assertEqual(parseLevelLine('peak=(GValueArray)< >'), null);
});

test('parseLevelLine clamps positive values to one', () => {
    assertEqual(parseLevelLine('peak=(GValueArray)< 1.5 >'), 1);
});

test('smoothLevel applies smoothing factor', () => {
    assertEqual(smoothLevel(0.2, 0.8, 0.5), 0.5);
});
