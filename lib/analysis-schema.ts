import type { AnalysisResult } from "./types";

function clampNumber(value: unknown, min = 0, max = 100): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * Parses raw text produced by an LLM and validates it against the strict
 * AnalysisResult contract:
 *   { mood: string, stress: number, fatigue: number, happiness: number,
 *     focus: number, authenticity: number, analysisNote: string }
 * Returns null if the text cannot be parsed or does not satisfy the
 * contract after normalization, so the caller can move on to the next
 * provider/key instead of returning malformed data to the client.
 */
export function parseAnalysisJson(raw: string | null | undefined): AnalysisResult | null {
  if (!raw || typeof raw !== "string") return null;

  const jsonCandidate = extractJsonBlock(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const mood = typeof obj.mood === "string" ? obj.mood.trim() : "";
  const analysisNote = typeof obj.analysisNote === "string" ? obj.analysisNote.trim() : "";

  const stress = clampNumber(obj.stress);
  const fatigue = clampNumber(obj.fatigue);
  const happiness = clampNumber(obj.happiness);
  const focus = clampNumber(obj.focus);
  // authenticity is validated leniently: if the model omits it or returns an
  // unparsable value, fall back to a neutral 50 rather than discarding an
  // otherwise valid analysis.
  const authenticityRaw = clampNumber(obj.authenticity);
  const authenticity = authenticityRaw === null ? 50 : authenticityRaw;

  if (!mood || !analysisNote) return null;
  if (stress === null || fatigue === null || happiness === null || focus === null) return null;

  return {
    mood,
    stress,
    fatigue,
    happiness,
    focus,
    authenticity,
    analysisNote,
  };
}