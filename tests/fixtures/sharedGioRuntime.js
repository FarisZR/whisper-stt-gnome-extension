import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// GNOME Shell's environment.js installs the byte-returning wrapper first.
Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async');
const {spawnLineProcess} = await import('../../src/gnome/process.js');
const {buildRecordingCommand} = await import('../../src/core/pipelineCommand.js');
const {parseLevelLine} = await import('../../src/core/levelParser.js');
const {createSpeechDetector} = await import('../../src/core/speechDetector.js');

const detector = createSpeechDetector();
let samples = 0;
const command = buildRecordingCommand('/dev/null');
command.splice(command.indexOf('pulsesrc'), 1, 'audiotestsrc', 'is-live=true');
const recorder = spawnLineProcess(command, {
    onStdoutLine(line) {
        if (typeof line !== 'string')
            throw new Error('Subprocess callbacks must receive decoded text');
        const level = parseLevelLine(line);
        if (level !== null) {
            samples += 1;
            detector.pushLevel(level);
        }
    },
});
try {
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
} finally {
    await recorder.stop();
}
if (samples === 0 || !detector.hasSpeech())
    throw new Error('Shared GNOME Gio wrappers must not make recorded audio appear silent');
print('SHARED_GIO_METER_OK');
