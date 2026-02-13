export function pcmS16Level(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 2)
        return 0;

    const frameCount = Math.floor(bytes.length / 2);

    let sumSquares = 0;

    for (let i = 0; i < frameCount; i += 1) {
        const lo = bytes[i * 2];
        const hi = bytes[i * 2 + 1];

        let sample = (hi << 8) | lo;
        if (sample & 0x8000)
            sample -= 0x10000;

        const normalized = sample / 32768;
        sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / frameCount);
    const boosted = Math.pow(Math.min(1, rms * 6), 0.7);
    return Math.max(0, Math.min(1, boosted));
}
