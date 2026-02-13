import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async');
Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async', 'read_line_finish_utf8');
Gio._promisify(Gio.InputStream.prototype, 'read_bytes_async', 'read_bytes_finish');

function _sleep(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

async function _drainPipe(stream, onLine, cancellable) {
    if (!stream || typeof onLine !== 'function')
        return;

    const dataStream = new Gio.DataInputStream({base_stream: stream});

    try {
        while (true) {
            const [line] = await dataStream.read_line_async(GLib.PRIORITY_DEFAULT, cancellable);

            if (line === null)
                break;

            onLine(line);
        }
    } catch (_error) {
        // Ignore pipe read errors during shutdown.
    }
}

async function _drainBytes(stream, onChunk, cancellable) {
    if (!stream || typeof onChunk !== 'function')
        return;

    try {
        while (true) {
            const bytes = await stream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, cancellable);

            if (!bytes || bytes.get_size() === 0)
                break;

            onChunk(bytes.toArray());
        }
    } catch (_error) {
        // Ignore pipe read errors during shutdown.
    }
}

async function _stopProcess(process, cancellable) {
    cancellable.cancel();

    if (!process.get_if_exited()) {
        try {
            process.send_signal(2);
        } catch (_error) {
            process.force_exit();
        }
    }

    const waitPromise = process.wait_async(null);
    await Promise.race([waitPromise, _sleep(700)]);

    if (!process.get_if_exited()) {
        process.force_exit();
        await process.wait_async(null);
    }
}

export async function runCommand(argv, input = null) {
    const process = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE |
        Gio.SubprocessFlags.STDIN_PIPE);

    const [stdout, stderr] = await process.communicate_utf8_async(input, null);

    return {
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        success: process.get_successful(),
        exitStatus: process.get_exit_status(),
    };
}

export function spawnLineProcess(argv, {onStdoutLine = null, onStderrLine = null} = {}) {
    const process = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE);

    const cancellable = new Gio.Cancellable();

    _drainPipe(process.get_stdout_pipe(), onStdoutLine, cancellable);
    _drainPipe(process.get_stderr_pipe(), onStderrLine, cancellable);

    return {
        process,
        async stop() {
            await _stopProcess(process, cancellable);
        },
    };
}

export function spawnByteProcess(argv, {onStdoutChunk = null, onStderrLine = null} = {}) {
    const process = Gio.Subprocess.new(argv,
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE);

    const cancellable = new Gio.Cancellable();

    _drainBytes(process.get_stdout_pipe(), onStdoutChunk, cancellable);
    _drainPipe(process.get_stderr_pipe(), onStderrLine, cancellable);

    return {
        process,
        async stop() {
            await _stopProcess(process, cancellable);
        },
    };
}
