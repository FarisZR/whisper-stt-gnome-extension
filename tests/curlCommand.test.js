import {test, assert, assertEqual} from './harness.js';
import {buildCurlArgs} from '../src/core/curlCommand.js';

const baseSettings = {
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    apiKey: 'secret',
    language: '',
    prompt: '',
    responseFormat: 'json',
};

test('buildCurlArgs includes bearer header when api key exists', () => {
    const args = buildCurlArgs(baseSettings, '/tmp/audio.wav');

    assertEqual(args[0], 'curl');
    assert(args.includes('Authorization: Bearer secret'));
    assert(args.includes('file=@/tmp/audio.wav'));
    assert(args.includes('model=whisper-1'));
});

test('buildCurlArgs omits bearer header when api key is empty', () => {
    const args = buildCurlArgs({...baseSettings, apiKey: ''}, '/tmp/audio.wav');
    assert(!args.some(arg => arg.includes('Authorization: Bearer')));
});

test('buildCurlArgs adds optional language and prompt fields', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        language: 'en',
        prompt: 'meeting notes',
        responseFormat: 'text',
    }, '/tmp/audio.wav');

    assert(args.includes('language=en'));
    assert(args.includes('prompt=meeting notes'));
    assert(args.includes('response_format=text'));
});

test('buildCurlArgs skips blank optional form fields', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        language: '  ',
        prompt: null,
        responseFormat: '',
    }, '/tmp/audio.wav');

    assert(!args.some(arg => arg === 'language=  '));
    assert(!args.some(arg => arg.startsWith('prompt=')));
    assert(!args.some(arg => arg === 'response_format='));
});
