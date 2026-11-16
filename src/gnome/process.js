import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async');

const PROCESS_STOP_TIMEOUT_MS = 10000;

async function _drainPipe(stream, onLine, cancellable) {
    if (!stream)
        return;

    const dataStream = new Gio.DataInputStream({base_stream: stream});

    try {
        while (true) {
            // Shell already promisifies read_line_async with the byte-returning finish.
            const line = await new Promise((resolve, reject) => {
                dataStream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (stream, result) => {
                    try {
                        resolve(stream.read_line_finish_utf8(result)[0]);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            if (line === null)
                break;

            if (typeof onLine === 'function')
                onLine(line);
        }
    } catch (error) {
        if (!cancellable.is_cancelled())
            console.error('[whisper-stt] Pipe read failed:', error);
    }
}

async function _waitForExit(process, timeoutMs) {
    let timeoutId = 0;
    const waitPromise = process.wait_async(null);
    const timeoutPromise = new Promise(resolve => {
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
            timeoutId = 0;
            resolve(false);
            return GLib.SOURCE_REMOVE;
        });
    });

    try {
        const exited = await Promise.race([
            (async () => {
                await waitPromise;
                return true;
            })(),
            timeoutPromise,
        ]);
        return {exited, waitPromise};
    } finally {
        if (timeoutId !== 0)
            GLib.source_remove(timeoutId);
    }
}

async function _settleDrains(cancellable, drainPromises, graceMs = 0) {
    if (graceMs > 0) {
        let graceId = 0;
        const gracePromise = new Promise(resolve => {
            graceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, graceMs, () => {
                graceId = 0;
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });

        await Promise.race([Promise.allSettled(drainPromises), gracePromise]);

        if (graceId !== 0)
            GLib.source_remove(graceId);
    }

    cancellable.cancel();
    await Promise.allSettled(drainPromises);
}

async function _stopProcess(process, cancellable, drainPromises, timeoutMs) {
    let waitResult = null;
    let waitError = null;

    try {
        process.send_signal(2);
    } catch (error) {
        console.error('[whisper-stt] Failed to send SIGINT to subprocess:', error);
    }

    try {
        waitResult = await _waitForExit(process, timeoutMs);
    } catch (error) {
        console.error('[whisper-stt] Failed while waiting for subprocess shutdown:', error);
        waitError = error;
    }

    if (waitResult?.exited) {
        await _settleDrains(cancellable, drainPromises, 200);
        return;
    }

    let cleanupError = null;

    try {
        process.force_exit();
    } catch (error) {
        console.error('[whisper-stt] Failed to force-exit subprocess:', error);
        cleanupError = error;
    }

    try {
        if (waitResult?.waitPromise)
            await waitResult.waitPromise;
        else
            await process.wait_async(null);
    } catch (error) {
        console.error('[whisper-stt] Failed while waiting for forced subprocess shutdown:', error);
        cleanupError ??= error;
    } finally {
        await _settleDrains(cancellable, drainPromises);
    }

    if (waitError)
        throw waitError;

    if (cleanupError)
        throw cleanupError;

    throw new Error(`Subprocess did not exit gracefully within ${timeoutMs} ms and was force-killed`);
}

export async function runCommand(argv, input = null, {cancellable = null, timeoutMs = 120000} = {}) {
    const process = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE |
        Gio.SubprocessFlags.STDIN_PIPE);

    const operation = cancellable ?? new Gio.Cancellable();
    let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
        timeoutId = 0;
        operation.cancel();
        return GLib.SOURCE_REMOVE;
    });
    let stdout, stderr;
    try {
        [stdout, stderr] = await process.communicate_utf8_async(input, operation);
    } catch (error) {
        process.force_exit();
        await process.wait_async(null);
        throw error;
    } finally {
        if (timeoutId)
            GLib.source_remove(timeoutId);
    }

    return {
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        success: process.get_successful(),
        exitStatus: process.get_exit_status(),
    };
}

export function spawnLineProcess(argv, {
    onStdoutLine = null,
    onStderrLine = null,
    stopTimeoutMs = PROCESS_STOP_TIMEOUT_MS,
} = {}) {
    const process = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE);

    const cancellable = new Gio.Cancellable();
    const drainPromises = [
        _drainPipe(process.get_stdout_pipe(), onStdoutLine, cancellable),
        _drainPipe(process.get_stderr_pipe(), onStderrLine, cancellable),
    ];
    let stopPromise = null;

    return {
        process,
        async stop() {
            stopPromise ??= _stopProcess(process, cancellable, drainPromises, stopTimeoutMs);
            await stopPromise;
        },
    };
}
