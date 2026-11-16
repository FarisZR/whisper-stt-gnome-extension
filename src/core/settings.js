const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'whisper-1';
const DEFAULT_RESPONSE_FORMAT = 'json';
const DEFAULT_PROXY_PORT = '1080';
const DEFAULT_PROXY_TYPE = 'socks5';
const DEFAULT_SOUNDS_ENABLED = true;

function _asTrimmedString(value) {
    if (typeof value !== 'string')
        return '';

    return value.trim();
}

function _normalizeProxyType(value) {
    const proxyType = _asTrimmedString(value).toLowerCase();
    return proxyType === 'http' ? 'http' : DEFAULT_PROXY_TYPE;
}

export function normalizeSettings(raw = {}) {
    const endpoint = _asTrimmedString(raw.endpoint) || DEFAULT_ENDPOINT;
    const model = _asTrimmedString(raw.model) || DEFAULT_MODEL;
    const apiKey = _asTrimmedString(raw.apiKey);
    const language = _asTrimmedString(raw.language);
    const prompt = _asTrimmedString(raw.prompt);
    const responseFormat = _asTrimmedString(raw.responseFormat) || DEFAULT_RESPONSE_FORMAT;
    const soundsEnabled = typeof raw.soundsEnabled === 'boolean' ? raw.soundsEnabled : DEFAULT_SOUNDS_ENABLED;
    const proxyEnabled = raw.proxyEnabled === true;
    const proxyType = _normalizeProxyType(raw.proxyType);
    const proxyHost = _asTrimmedString(raw.proxyHost);
    const proxyPort = _asTrimmedString(raw.proxyPort) || DEFAULT_PROXY_PORT;
    const proxyUsername = _asTrimmedString(raw.proxyUsername);
    const proxyPassword = _asTrimmedString(raw.proxyPassword);
    const bypassVpnEnabled = raw.bypassVpnEnabled === true;
    const bypassVpnInterface = _asTrimmedString(raw.bypassVpnInterface);

    return {
        endpoint,
        model,
        apiKey,
        language,
        prompt,
        responseFormat,
        soundsEnabled,
        proxyEnabled,
        proxyType,
        proxyHost,
        proxyPort,
        proxyUsername,
        proxyPassword,
        bypassVpnEnabled,
        bypassVpnInterface,
    };
}
