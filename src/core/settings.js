const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'whisper-1';
const DEFAULT_RESPONSE_FORMAT = 'json';
const DEFAULT_SHORTCUT = ['<Ctrl><Super>space'];

function _asTrimmedString(value) {
    if (typeof value !== 'string')
        return '';

    return value.trim();
}

function _normalizeShortcut(value) {
    if (!Array.isArray(value))
        return [...DEFAULT_SHORTCUT];

    const cleaned = value
        .map(item => _asTrimmedString(item))
        .filter(item => item.length > 0);

    return cleaned.length > 0 ? cleaned : [...DEFAULT_SHORTCUT];
}

export function normalizeSettings(raw = {}) {
    const endpoint = _asTrimmedString(raw.endpoint) || DEFAULT_ENDPOINT;
    const model = _asTrimmedString(raw.model) || DEFAULT_MODEL;
    const apiKey = _asTrimmedString(raw.apiKey);
    const language = _asTrimmedString(raw.language);
    const prompt = _asTrimmedString(raw.prompt);
    const responseFormat = _asTrimmedString(raw.responseFormat) || DEFAULT_RESPONSE_FORMAT;
    const shortcut = _normalizeShortcut(raw.shortcut);

    return {
        endpoint,
        model,
        apiKey,
        language,
        prompt,
        responseFormat,
        shortcut,
    };
}

export const SETTINGS_DEFAULTS = Object.freeze({
    endpoint: DEFAULT_ENDPOINT,
    model: DEFAULT_MODEL,
    apiKey: '',
    language: '',
    prompt: '',
    responseFormat: DEFAULT_RESPONSE_FORMAT,
    shortcut: [...DEFAULT_SHORTCUT],
});
