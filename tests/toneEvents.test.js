import {test, assertDeepEqual} from './harness.js';
import {getToneEvents} from '../src/core/toneEvents.js';

test('getToneEvents returns success event order by default', () => {
    assertDeepEqual(getToneEvents('success'), [
        'message-new-instant',
        'complete',
        'dialog-information',
    ]);
});

test('getToneEvents returns error event order for error kind', () => {
    assertDeepEqual(getToneEvents('error'), [
        'dialog-warning',
        'suspend-error',
        'bell',
    ]);
});

test('getToneEvents falls back to success events for unknown kinds', () => {
    assertDeepEqual(getToneEvents('anything-else'), [
        'message-new-instant',
        'complete',
        'dialog-information',
    ]);
});
