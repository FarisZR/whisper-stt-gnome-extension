const SUCCESS_EVENTS = Object.freeze([
    'message-new-instant',
    'complete',
    'dialog-information',
]);

const ERROR_EVENTS = Object.freeze([
    'dialog-warning',
    'suspend-error',
    'bell',
]);

export async function playTone(kind, deps) {
    const events = kind === 'error' ? ERROR_EVENTS : SUCCESS_EVENTS;
    for (const event of events) {
        try {
            const result = await deps.runCommand(['canberra-gtk-play', '-i', event], null, {timeoutMs: 700});
            if (result.success)
                return;
        } catch (_error) {
            // Sound themes and installations may lack individual event IDs.
        }
    }
}
