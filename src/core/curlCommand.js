function _pushForm(args, key, value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return;

    args.push('--form', `${key}=${value}`);
}

function _buildProxyUrl(settings) {
    if (settings.proxyEnabled !== true)
        return '';

    if (typeof settings.proxyHost !== 'string' || settings.proxyHost.trim().length === 0)
        return '';

    const host = settings.proxyHost.trim();
    const port = typeof settings.proxyPort === 'string' && settings.proxyPort.trim().length > 0
        ? settings.proxyPort.trim()
        : '1080';
    const username = typeof settings.proxyUsername === 'string' ? settings.proxyUsername.trim() : '';
    const password = typeof settings.proxyPassword === 'string' ? settings.proxyPassword.trim() : '';

    if (username.length === 0)
        return `socks5h://${host}:${port}`;

    return `socks5h://${username}:${password}@${host}:${port}`;
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

    const proxyUrl = _buildProxyUrl(settings);

    if (proxyUrl)
        args.push('--proxy', proxyUrl);

    return args;
}
