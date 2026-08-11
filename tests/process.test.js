import GLib from 'gi://GLib';

import {test, assert, assertRejects} from './harness.js';
import {spawnLineProcess} from '../src/gnome/process.js';

function _sleep(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

async function _forceCleanup(handle) {
    try {
        handle.process.force_exit();
    } catch (error) {
        console.error('Failed to force-exit test subprocess:', error);
    }

    try {
        await handle.process.wait_async(null);
    } catch (error) {
        console.error('Failed to wait for test subprocess cleanup:', error);
    }
}

function _spawnTestProcess(argv, options = {}) {
    try {
        return spawnLineProcess(argv, options);
    } catch (error) {
        console.error('Failed to start test subprocess:', error);
        throw error;
    }
}

function _readUint32LE(bytes, offset) {
    return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
    ) >>> 0;
}

function _ascii(bytes, offset, length) {
    return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function _assertFinalizedWav(path) {
    let bytes;

    try {
        const [success, contents] = GLib.file_get_contents(path);

        if (!success)
            throw new Error(`failed to read ${path}`);

        bytes = contents;
    } catch (error) {
        console.error('Failed to read test WAV:', error);
        throw error;
    }

    assert(bytes.length >= 44, `WAV is too small: ${bytes.length} bytes`);
    assert(_ascii(bytes, 0, 4) === 'RIFF', 'WAV is missing RIFF header');
    assert(_ascii(bytes, 8, 4) === 'WAVE', 'WAV is missing WAVE signature');
    assert(_readUint32LE(bytes, 4) === bytes.length - 8,
        'WAV RIFF size was not finalized');
}

test('spawnLineProcess stops a running process promptly', async () => {
    const handle = _spawnTestProcess(['sleep', '30']);
    const started = GLib.get_monotonic_time();

    try {
        await handle.stop();

        const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
        assert(elapsedMs < 1000, `stop took ${elapsedMs} ms`);
    } finally {
        await _forceCleanup(handle);
    }
});

test('spawnLineProcess force-exits a SIGINT-ignoring process and reports failure', async () => {
    const handle = _spawnTestProcess(
        ['sh', '-c', 'trap "" INT; exec sleep 30'],
        {stopTimeoutMs: 100}
    );

    try {
        await _sleep(100);
        const started = GLib.get_monotonic_time();

        await assertRejects(() => handle.stop(), 'force-killed');

        const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
        assert(elapsedMs >= 80, `forced exit happened too early: ${elapsedMs} ms`);
        assert(elapsedMs < 1000, `forced exit took too long: ${elapsedMs} ms`);
    } finally {
        await _forceCleanup(handle);
    }
});

test('spawnLineProcess allows slow GStreamer EOS to finalize WAV', async () => {
    const path = GLib.build_filenamev([
        GLib.get_tmp_dir(),
        `whisper-stt-slow-eos-${GLib.get_monotonic_time()}.wav`,
    ]);
    const handle = _spawnTestProcess([
        'gst-launch-1.0',
        '-q',
        '-e',
        'audiotestsrc',
        'is-live=true',
        'wave=sine',
        '!',
        'audioconvert',
        '!',
        'audio/x-raw,format=S16LE,channels=1,rate=16000',
        '!',
        'wavenc',
        '!',
        'identity',
        'sleep-time=600000',
        '!',
        'filesink',
        `location=${path}`,
    ]);

    try {
        await _sleep(1200);
        const started = GLib.get_monotonic_time();

        await handle.stop();

        const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
        assert(elapsedMs >= 700, `slow EOS scenario stopped too quickly: ${elapsedMs} ms`);
        assert(elapsedMs < 2500, `slow EOS scenario took too long: ${elapsedMs} ms`);
        _assertFinalizedWav(path);
    } finally {
        await _forceCleanup(handle);

        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS))
                GLib.unlink(path);
        } catch (error) {
            console.error('Failed to remove test WAV:', error);
        }
    }
});

test('spawnLineProcess drains unhandled GStreamer messages through EOS', async () => {
    const path = GLib.build_filenamev([
        GLib.get_tmp_dir(),
        `whisper-stt-message-heavy-${GLib.get_monotonic_time()}.wav`,
    ]);
    const handle = _spawnTestProcess([
        'gst-launch-1.0',
        '-e',
        '-m',
        'audiotestsrc',
        'is-live=true',
        'wave=sine',
        '!',
        'tee',
        'name=t',
        't.',
        '!',
        'queue',
        '!',
        'audioconvert',
        '!',
        'wavenc',
        '!',
        'filesink',
        `location=${path}`,
        't.',
        '!',
        'queue',
        '!',
        'audioconvert',
        '!',
        'level',
        'interval=1000000',
        'post-messages=true',
        '!',
        'fakesink',
    ]);

    try {
        await _sleep(1500);
        const started = GLib.get_monotonic_time();

        await handle.stop();

        const elapsedMs = (GLib.get_monotonic_time() - started) / 1000;
        assert(elapsedMs < 1000, `message-heavy EOS took too long: ${elapsedMs} ms`);
        _assertFinalizedWav(path);
    } finally {
        await _forceCleanup(handle);

        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS))
                GLib.unlink(path);
        } catch (error) {
            console.error('Failed to remove message-heavy test WAV:', error);
        }
    }
});
