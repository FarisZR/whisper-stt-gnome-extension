import GLib from 'gi://GLib';

import {test, assert} from './harness.js';
import {spawnLineProcess} from '../src/gnome/process.js';

test('spawnLineProcess stops a running process promptly', async () => {
    const handle = spawnLineProcess(['sleep', '30']);
    const started = GLib.get_monotonic_time();

    await handle.stop();

    const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
    assert(elapsedMs < 1000, `stop took ${elapsedMs} ms`);
});
