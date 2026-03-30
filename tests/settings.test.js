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
        proxyType: 'socks5',
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        bypassVpnEnabled: false,
        bypassVpnInterface: '',
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
        proxyType: ' HTTP ',
        proxyHost: ' 127.0.0.1 ',
        proxyPort: ' 9050 ',
        proxyUsername: ' user ',
        proxyPassword: ' pass ',
        bypassVpnEnabled: true,
        bypassVpnInterface: ' enp6s0 ',
        shortcut: [' <Alt>F8 '],
    }), {
        endpoint: 'https://example.com/v1/audio/transcriptions',
        model: 'gpt-4o-mini-transcribe',
        apiKey: '',
        language: 'en',
        prompt: 'say hi',
        responseFormat: 'text',
        proxyEnabled: true,
        proxyType: 'http',
        proxyHost: '127.0.0.1',
        proxyPort: '9050',
        proxyUsername: 'user',
        proxyPassword: 'pass',
        bypassVpnEnabled: true,
        bypassVpnInterface: 'enp6s0',
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
        proxyType: 'socks5',
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        bypassVpnEnabled: false,
        bypassVpnInterface: '',
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
        proxyType: null,
        proxyHost: null,
        proxyPort: 1080,
        proxyUsername: undefined,
        proxyPassword: {},
        bypassVpnEnabled: 'yes',
        bypassVpnInterface: null,
        shortcut: 'invalid',
    }), {
        endpoint: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1',
        apiKey: '',
        language: '',
        prompt: '',
        responseFormat: 'json',
        proxyEnabled: false,
        proxyType: 'socks5',
        proxyHost: '',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        bypassVpnEnabled: false,
        bypassVpnInterface: '',
        shortcut: ['<Ctrl><Super>space'],
    });
});

test('normalizeSettings falls back to socks5 for unknown proxy type', () => {
    assertDeepEqual(normalizeSettings({
        proxyEnabled: true,
        proxyType: 'ftp',
        proxyHost: 'localhost',
    }), {
        endpoint: 'https://api.openai.com/v1/audio/transcriptions',
        model: 'whisper-1',
        apiKey: '',
        language: '',
        prompt: '',
        responseFormat: 'json',
        proxyEnabled: true,
        proxyType: 'socks5',
        proxyHost: 'localhost',
        proxyPort: '1080',
        proxyUsername: '',
        proxyPassword: '',
        bypassVpnEnabled: false,
        bypassVpnInterface: '',
        shortcut: ['<Ctrl><Super>space'],
    });
});
