import {test, assert, assertEqual} from './harness.js';
import {buildCurlArgs} from '../src/core/curlCommand.js';

const baseSettings = {
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    apiKey: 'secret',
    language: '',
    prompt: '',
    responseFormat: 'json',
    proxyEnabled: false,
    proxyType: 'socks5',
    proxyHost: '',
    proxyPort: '1080',
    proxyUsername: '',
    proxyPassword: '',
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

test('buildCurlArgs omits proxy when proxy is disabled', () => {
    const args = buildCurlArgs(baseSettings, '/tmp/audio.wav');
    assert(!args.includes('--proxy'));
});

test('buildCurlArgs adds socks5h proxy without auth', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        proxyEnabled: true,
        proxyHost: '127.0.0.1',
        proxyPort: '9050',
    }, '/tmp/audio.wav');

    assert(args.includes('--proxy'));
    assert(args.includes('socks5h://127.0.0.1:9050'));
});

test('buildCurlArgs adds http proxy without auth', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        proxyEnabled: true,
        proxyType: 'http',
        proxyHost: '127.0.0.1',
        proxyPort: '3128',
    }, '/tmp/audio.wav');

    assert(args.includes('--proxy'));
    assert(args.includes('http://127.0.0.1:3128'));
});

test('buildCurlArgs adds socks5h proxy with auth when username exists', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        proxyEnabled: true,
        proxyHost: '127.0.0.1',
        proxyPort: '9050',
        proxyUsername: 'alice',
        proxyPassword: 'secretpass',
    }, '/tmp/audio.wav');

    assert(args.includes('--proxy'));
    assert(args.includes('socks5h://alice:secretpass@127.0.0.1:9050'));
});

test('buildCurlArgs adds http proxy with auth when username exists', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        proxyEnabled: true,
        proxyType: 'http',
        proxyHost: '127.0.0.1',
        proxyPort: '3128',
        proxyUsername: 'alice',
        proxyPassword: 'secretpass',
    }, '/tmp/audio.wav');

    assert(args.includes('--proxy'));
    assert(args.includes('http://alice:secretpass@127.0.0.1:3128'));
});

test('buildCurlArgs ignores auth when username is blank', () => {
    const args = buildCurlArgs({
        ...baseSettings,
        proxyEnabled: true,
        proxyHost: '127.0.0.1',
        proxyPort: '9050',
        proxyUsername: ' ',
        proxyPassword: 'secretpass',
    }, '/tmp/audio.wav');

    assert(args.includes('socks5h://127.0.0.1:9050'));
    assert(!args.some(arg => arg.includes('@127.0.0.1:9050')));
});
