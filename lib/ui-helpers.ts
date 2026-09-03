export type MetricTone = "positive" | "neutral" | "warning" | "critical";

/**
 * Maps a 0-100 numeric value to a Turkish qualitative tag.
 * `invert` = true means a HIGH raw value is actually a GOOD outcome
 * (e.g. happiness, focus) while false means a HIGH raw value is a
 * WORSE outcome (e.g. stress, fatigue). This only changes the tone
 * returned alongside the tag, not the tag thresholds themselves.
 */
export function getQualitativeTag(value: number): string {
  const v = clamp(value);
  if (v < 20) return "Çok Düşük";
  if (v < 40) return "Düşük";
  if (v < 50) return "Düşük-Orta";
  if (v < 60) return "Orta";
  if (v < 75) return "Orta-Yüksek";
  if (v < 90) return "Yüksek";
  return "Çok Yüksek";
}

export function getMetricTone(value: number, invert: boolean): MetricTone {
  const v = clamp(value);
  const score = invert ? v : 100 - v;
  if (score >= 65) return "positive";
  if (score >= 45) return "neutral";
  if (score >= 25) return "warning";
  return "critical";
}

export function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

/**
 * Overall "wellbeing index" (0-100) driving the radial gauge needle.
 * Stress and fatigue are inverted (lower is better), happiness and
 * focus counted directly (higher is better).
 */
export function computeWellbeingIndex(metrics: {
  stress: number;
  fatigue: number;
  happiness: number;
  focus: number;
}): number {
  const { stress, fatigue, happiness, focus } = metrics;
  const inverted = (100 - clamp(stress) + (100 - clamp(fatigue))) / 2;
  const direct = (clamp(happiness) + clamp(focus)) / 2;
  return Math.round((inverted + direct) / 2);
}

export function gaugeAngleFromValue(value: number): number {
  const v = clamp(value);
  return -90 + (v / 100) * 180;
}