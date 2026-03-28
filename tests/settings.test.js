import {test, assertDeepEqual} from './harness.js';
import {normalizeSettings} from '../src/core/settings.js';

test('normalizeSettings returns defaults', () => {
    assertDeepEqual(normalizeSettings({}), {
        endpoint: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1',
        apiKey: '',
        language: '',
        prompt: '',
        responseFormat: 'json',
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        shortcut: ['<Ctrl><Super>space'],
    });
});

test('normalizeSettings trims values and preserves empty api key', () => {
    assertDeepEqual(normalizeSettings({
        endpoint: '  https://example.com/v1/audio/transcriptions  ',
        model: '  gpt-4o-mini-transcribe ',
        apiKey: '',
        language: ' en ',
        prompt: '  say hi ',
        responseFormat: ' text ',
        proxyEnabled: true,
        proxyHost: ' 127.0.0.1 ',
        proxyPort: ' 9050 ',
        proxyUsername: ' user ',
        proxyPassword: ' pass ',
        shortcut: [' <Alt>F8 '],
    }), {
        endpoint: 'https://example.com/v1/audio/transcriptions',
        model: 'gpt-4o-mini-transcribe',
        apiKey: '',
        language: 'en',
        prompt: 'say hi',
        responseFormat: 'text',
        proxyEnabled: true,
        proxyHost: '127.0.0.1',
        proxyPort: '9050',
        proxyUsername: 'user',
        proxyPassword: 'pass',
        shortcut: ['<Alt>F8'],
    });
});

test('normalizeSettings falls back for blank endpoint/model/format', () => {
    assertDeepEqual(normalizeSettings({
        endpoint: ' ',
        model: ' ',
        responseFormat: ' ',
        shortcut: [],
    }), {
        endpoint: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1',
        apiKey: '',
        language: '',
        prompt: '',
        responseFormat: 'json',
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        shortcut: ['<Ctrl><Super>space'],
    });
});

test('normalizeSettings handles non-string values safely', () => {
    assertDeepEqual(normalizeSettings({
        endpoint: null,
        model: 42,
        apiKey: undefined,
        language: false,
        prompt: {},
        responseFormat: 0,
        proxyEnabled: 'yes',
        proxyHost: null,
        proxyPort: 1080,
        proxyUsername: undefined,
        proxyPassword: {},
        shortcut: 'invalid',
    }), {
        endpoint: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1',
        apiKey: '',
        language: '',
        prompt: '',
        responseFormat: 'json',
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        shortcut: ['<Ctrl><Super>space'],
    });
});
