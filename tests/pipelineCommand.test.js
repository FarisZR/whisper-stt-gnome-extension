import {test, assert, assertDeepEqual, assertEqual} from './harness.js';
import {buildRecordingCommand} from '../src/core/pipelineCommand.js';

test('buildRecordingCommand creates a gst-launch argv list', () => {
    const argv = buildRecordingCommand('/tmp/sample.wav');

    assertEqual(argv[0], 'gst-launch-1.0');
    assert(argv.includes('pulsesrc'));
    assert(argv.includes('level'));
    assert(argv.includes('wavenc'));
    assert(argv.includes('post-messages=true'));
    assert(argv.includes('location=/tmp/sample.wav'));
});

test('buildRecordingCommand keeps dynamic parts stable', () => {
    assertDeepEqual(buildRecordingCommand('/x.wav').slice(0, 8), [
        'gst-launch-1.0',
        '-m',
        'pulsesrc',
        '!',
        'tee',
        'name=t',
        't.',
        '!',
    ]);
});
