const DEFAULT_LEVEL_THRESHOLD = 0.12;
const DEFAULT_MIN_ACTIVE_SAMPLES = 4;
const DEFAULT_PEAK_SHORTCUT = 0.3;

function _normalizeLevel(level) {
    const numeric = Number(level);

    if (!Number.isFinite(numeric))
        return 0;

    return Math.max(0, Math.min(1, numeric));
}

export function createSpeechDetector() {
    let activeSampleCount = 0;
    let peak = 0;

    return {
        pushLevel(level) {
            const normalized = _normalizeLevel(level);

            peak = Math.max(peak, normalized);

            if (normalized >= DEFAULT_LEVEL_THRESHOLD)
                activeSampleCount += 1;
        },

        hasSpeech() {
            if (peak >= DEFAULT_PEAK_SHORTCUT)
                return true;

            return activeSampleCount >= DEFAULT_MIN_ACTIVE_SAMPLES;
        },
    };
}
