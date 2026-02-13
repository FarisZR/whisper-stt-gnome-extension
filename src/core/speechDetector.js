const DEFAULT_LEVEL_THRESHOLD = 0.12;
const DEFAULT_MIN_ACTIVE_SAMPLES = 4;
const DEFAULT_PEAK_SHORTCUT = 0.3;

function _normalizeLevel(level) {
    const numeric = Number(level);

    if (!Number.isFinite(numeric))
        return 0;

    return Math.max(0, Math.min(1, numeric));
}

export function createSpeechDetector({
    levelThreshold = DEFAULT_LEVEL_THRESHOLD,
    minActiveSamples = DEFAULT_MIN_ACTIVE_SAMPLES,
    peakShortcut = DEFAULT_PEAK_SHORTCUT,
} = {}) {
    let sampleCount = 0;
    let activeSampleCount = 0;
    let peak = 0;

    return {
        pushLevel(level) {
            const normalized = _normalizeLevel(level);

            sampleCount += 1;
            peak = Math.max(peak, normalized);

            if (normalized >= levelThreshold)
                activeSampleCount += 1;
        },

        hasSpeech() {
            if (peak >= peakShortcut)
                return true;

            return activeSampleCount >= minActiveSamples;
        },

        getStats() {
            return {
                sampleCount,
                activeSampleCount,
                peak,
            };
        },
    };
}
