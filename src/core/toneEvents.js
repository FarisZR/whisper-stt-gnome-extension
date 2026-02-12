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

export function getToneEvents(kind) {
    if (kind === 'error')
        return [...ERROR_EVENTS];

    return [...SUCCESS_EVENTS];
}
