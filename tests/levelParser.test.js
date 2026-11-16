import {test, assertEqual, assert} from './harness.js';
import {parseLevelLine} from '../src/core/levelParser.js';

test('parseLevelLine extracts the loudest peak and normalizes it', () => {
    const line = 'endtime=(guint64)100000000, peak=(GValueArray)< -45.0, -20.0 >;';
    const value = parseLevelLine(line);

    assert(value !== null);
    assert(value > 0.3);
    assert(value <= 1);
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

test('parseLevelLine accepts spaced and comma decimal values', () => {
    const value = parseLevelLine('peak = (GValueArray) < -30,5, -40,2 >');
    assert(value !== null);
    assert(value > 0);
    assert(value < 1);
});

test('recorder levels preserve noise floor and distinguish sustained speech', () => {
    const quiet = parseLevelLine('rms=(GValueArray)< -70 >, peak=(GValueArray)< -60 >');
    const speech = parseLevelLine('rms=(GValueArray)< -35 >, peak=(GValueArray)< -25 >');
    assertEqual(quiet, 0);
    assert(speech > 0.3);
});

test('silent GStreamer infinity values normalize to silence', () => {
    assertEqual(parseLevelLine('rms=(GValueArray)< -inf >, peak=(GValueArray)< -inf >'), 0);
});
