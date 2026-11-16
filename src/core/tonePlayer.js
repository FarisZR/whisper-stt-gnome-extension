export async function playTone(kind, deps) {
    const event = kind === 'error' ? 'dialog-warning' : 'message-new-instant';
    try {
        await deps.runCommand(['canberra-gtk-play', '-i', event], null, {timeoutMs: 700});
    } catch (_error) {
        // Playback can time out after making a sound; never retry with another cue.
    }
}
