function _asBytes(value) {
    if (value instanceof Uint8Array)
        return value;

    if (ArrayBuffer.isView(value))
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

    return null;
}

export function pcmS16Level(value) {
    const bytes = _asBytes(value);

    if (!bytes || bytes.length < 2)
        return 0;

    const frameCount = Math.floor(bytes.length / 2);

    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < frameCount; i += 1) {
        const lo = bytes[i * 2] & 0xff;
        const hi = bytes[i * 2 + 1] & 0xff;

        let sample = (hi << 8) | lo;
        if (sample & 0x8000)
            sample -= 0x10000;

        const normalized = sample / 32768;
        const absolute = Math.abs(normalized);

        peak = Math.max(peak, absolute);
        sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / frameCount);
    const adjustedRms = Math.max(0, rms - 0.0008);
    const normalizedRms = Math.min(1, adjustedRms * 12);
    const normalizedPeak = Math.min(1, Math.max(0, peak - 0.01) * 1.5);
    const combined = Math.max(normalizedRms, normalizedPeak * 0.65);
    const boosted = Math.pow(combined, 0.75);

    return Math.max(0, Math.min(1, boosted));
}
