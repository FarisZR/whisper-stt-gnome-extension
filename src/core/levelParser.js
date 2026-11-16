function _amplitude(line, name) {
    const section = line.match(new RegExp(`${name}\\s*=\\s*\\(GValueArray\\)\\s*<([^>]+)>`, 'i'));
    if (!section)
        return null;
    const values = section[1].match(/-?(?:\d+(?:[.,]\d+)?(?:e[+-]?\d+)?|inf)/gi);
    if (!values)
        return null;
    const db = Math.max(...values.map(value => value.toLowerCase() === '-inf'
        ? -Infinity : Number.parseFloat(value.replace(',', '.'))));
    return Math.pow(10, db / 20);
}

export function parseLevelLine(line) {
    if (typeof line !== 'string')
        return null;
    const peak = _amplitude(line, 'peak');
    if (peak === null)
        return null;
    const rms = _amplitude(line, 'rms') ?? peak;
    const normalizedRms = Math.min(1, Math.max(0, rms - 0.0008) * 20);
    const normalizedPeak = Math.min(1, Math.max(0, peak - 0.002) * 8);
    return Math.pow(Math.max(normalizedRms, normalizedPeak * 0.8), 0.65);
}
