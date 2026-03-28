function _pushForm(args, key, value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return;

    args.push('--form', `${key}=${value}`);
}

function _buildProxyOptions(settings) {
    if (settings.proxyEnabled !== true)
        return null;

    if (typeof settings.proxyHost !== 'string' || settings.proxyHost.trim().length === 0)
        return null;

    const host = settings.proxyHost.trim();
    const port = String(settings.proxyPort ?? '').trim();
    if (port.length === 0)
        return null;

    const proxyType = settings.proxyType === 'http' ? 'http' : 'socks5';
    const username = typeof settings.proxyUsername === 'string' ? settings.proxyUsername.trim() : '';
    const password = typeof settings.proxyPassword === 'string' ? settings.proxyPassword.trim() : '';
    const protocol = proxyType === 'http' ? 'http' : 'socks5h';
    const options = [
        '--proxy',
        `${protocol}://${host}:${port}`,
    ];

    if (username.length > 0)
        options.push('--proxy-user', password.length > 0 ? `${username}:${password}` : username);

    return options;
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

    const proxyOptions = _buildProxyOptions(settings);

    if (proxyOptions)
        args.push(...proxyOptions);

    return args;
}
