import { buildVideoPrompt } from "./prompt";
import { parseAnalysisJson } from "./analysis-schema";
import type { AnalysisResult, MeasuredMetrics } from "./types";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 22000;

export interface GeminiAttemptLog {
  keyLabel: string;
  ok: boolean;
  status?: number;
  message?: string;
}

/**
 * Orders API keys so plausible Gemini keys (the "AIzaSy..." format issued
 * for Generative Language API access) are tried first, and OAuth-style or
 * otherwise malformed tokens (e.g. "AQ.Ab8..." style tokens) are pushed to
 * the end since they are very unlikely to authenticate against the plain
 * REST API key auth scheme used here. Nothing is dropped outright: every
 * non-empty key is still attempted, just in a smarter order.
 */
export function prioritizeGeminiKeys(keys: (string | undefined | null)[]): string[] {
  const cleaned = keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  const looksLikeApiKey = (k: string) => /^AIzaSy/.test(k.trim());
  const preferred = cleaned.filter(looksLikeApiKey);
  const deprioritized = cleaned.filter((k) => !looksLikeApiKey(k));
  return [...preferred, ...deprioritized];
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function callGeminiOnce(
  apiKey: string,
  videoBase64: string,
  mimeType: string,
  metrics: MeasuredMetrics
): Promise<{ result: AnalysisResult } | { error: string; status?: number }> {
  const { signal, cancel } = withTimeout(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: buildVideoPrompt(metrics) },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: videoBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 3072,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return { error: `HTTP ${response.status}: ${bodyText.slice(0, 300)}`, status: response.status };
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason;
      return { error: blockReason ? `Content blocked: ${blockReason}` : "Empty response from Gemini" };
    }

    const parsed = parseAnalysisJson(text);
    if (!parsed) {
      return { error: "Gemini response failed JSON contract validation" };
    }

    return { result: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini request error";
    return { error: message };
  } finally {
    cancel();
  }
}

export async function callGeminiWithRotation(
  videoBase64: string,
  mimeType: string,
  metrics: MeasuredMetrics,
  rawKeys: (string | undefined | null)[]
): Promise<{ result: AnalysisResult; logs: GeminiAttemptLog[] } | { result: null; logs: GeminiAttemptLog[] }> {
  const keys = prioritizeGeminiKeys(rawKeys);
  const logs: GeminiAttemptLog[] = [];

  for (const key of keys) {
    const label = maskKey(key);
    const outcome = await callGeminiOnce(key, videoBase64, mimeType, metrics);

    if ("result" in outcome) {
      logs.push({ keyLabel: label, ok: true });
      return { result: outcome.result, logs };
    }

    logs.push({ keyLabel: label, ok: false, status: outcome.status, message: outcome.error });

    // Auth errors (400/401/403) on a malformed/OAuth-style key are expected;
    // continue rotating regardless of the specific status so every key gets
    // a fair try before falling back to Groq.
  }

  return { result: null, logs };
}