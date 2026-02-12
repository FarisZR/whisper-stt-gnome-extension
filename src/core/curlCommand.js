function _pushForm(args, key, value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return;

    args.push('--form', `${key}=${value}`);
}

export function buildCurlArgs(settings, audioPath) {
    const args = [
        'curl',
        '--silent',
        '--show-error',
        '--write-out',
        '\n%{http_code}',
        '--request',
        'POST',
        settings.endpoint,
        '--form',
        `file=@${audioPath}`,
        '--form',
        `model=${settings.model}`,
    ];

    _pushForm(args, 'response_format', settings.responseFormat);
    _pushForm(args, 'language', settings.language);
    _pushForm(args, 'prompt', settings.prompt);

    if (typeof settings.apiKey === 'string' && settings.apiKey.trim().length > 0)
        args.push('--header', `Authorization: Bearer ${settings.apiKey.trim()}`);

    return args;
}
