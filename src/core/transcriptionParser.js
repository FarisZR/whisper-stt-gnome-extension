function _extractErrorMessage(body) {
    const trimmed = body.trim();

    if (!trimmed)
        return 'Request failed with an empty response body';

    try {
        const parsed = JSON.parse(trimmed);

        if (typeof parsed?.error?.message === 'string')
            return parsed.error.message;

        if (typeof parsed?.message === 'string')
            return parsed.message;
    } catch (_error) {
        // Fall through and return raw body.
    }

    return trimmed;
}

export function splitBodyAndStatus(output) {
    if (typeof output !== 'string' || output.length === 0)
        return {body: '', statusCode: 0};

    const lastNewline = output.lastIndexOf('\n');

    if (lastNewline === -1)
        return {body: output, statusCode: 0};

    const body = output.slice(0, lastNewline);
    const statusRaw = output.slice(lastNewline + 1).trim();
    const statusCode = Number.parseInt(statusRaw, 10);

    if (!Number.isFinite(statusCode))
        return {body: output, statusCode: 0};

    return {body, statusCode};
}

export function parseTranscriptionResponse(body, statusCode) {
    if (statusCode >= 400)
        throw new Error(_extractErrorMessage(body));

    const trimmed = body.trim();

    if (!trimmed)
        return '';

    try {
        const parsed = JSON.parse(trimmed);

        if (typeof parsed === 'string')
            return parsed;

        if (typeof parsed?.text === 'string')
            return parsed.text;
    } catch (_error) {
        // Plain text response.
    }

    return trimmed;
}
