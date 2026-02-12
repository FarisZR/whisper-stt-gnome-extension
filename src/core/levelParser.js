function _dbToLinear(db) {
    if (db <= -60)
        return 0;

    if (db >= 0)
        return 1;

    return (db + 60) / 60;
}

export function parseLevelLine(line) {
    if (typeof line !== 'string' || !line.includes('peak='))
        return null;

    const sectionMatch = line.match(/peak=\(GValueArray\)<([^>]+)>/);

    if (!sectionMatch)
        return null;

    const matches = [...sectionMatch[1].matchAll(/-?\d+(?:\.\d+)?/g)];

    if (matches.length === 0)
        return null;

    const values = matches.map(match => Number.parseFloat(match[0]));

    const peakDb = Math.max(...values);
    return _dbToLinear(peakDb);
}

export function smoothLevel(previous, current, factor = 0.35) {
    const clampedFactor = Math.max(0, Math.min(1, factor));
    return previous * (1 - clampedFactor) + current * clampedFactor;
}
