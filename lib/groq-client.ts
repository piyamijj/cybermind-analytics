import { buildMultiFramePrompt, buildTextOnlyFallbackPrompt } from "./prompt";
import { parseAnalysisJson } from "./analysis-schema";
import type { AnalysisResult, MeasuredMetrics } from "./types";

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 25000;

export interface GroqAttemptLog {
  keyLabel: string;
  ok: boolean;
  status?: number;
  message?: string;
  mode: "multi-frame" | "text-only";
}

function cleanKeys(keys: (string | undefined | null)[]): string[] {
  return keys.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
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

async function callGroqOnce(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ result: AnalysisResult } | { error: string; status?: number }> {
  const { signal, cancel } = withTimeout(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return { error: `HTTP ${response.status}: ${bodyText.slice(0, 300)}`, status: response.status };
    }

    const data = await response.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;

    if (!text) {
      return { error: "Empty response from Groq" };
    }

    const parsed = parseAnalysisJson(text);
    if (!parsed) {
      return { error: "Groq response failed JSON contract validation" };
    }

    return { result: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Groq request error";
    return { error: message };
  } finally {
    cancel();
  }
}

/**
 * Builds a multi-image chat completion request from 3-5 representative
 * frames extracted client-side from the video clip (each a full
 * "data:image/jpeg;base64,..." data URL). Groq's chat completions API has
 * no video input, so this is the closest equivalent: several stills spread
 * across the clip instead of true temporal video understanding.
 */
function buildMultiFrameBody(frameDataUrls: string[], metrics: MeasuredMetrics): Record<string, unknown> {
  const imageParts = frameDataUrls
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url) => ({ type: "image_url", image_url: { url } }));

  return {
    model: GROQ_MODEL,
    temperature: 0.6,
    max_tokens: 2200,
    messages: [
      { role: "system", content: buildMultiFramePrompt(metrics) },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Ekteki, video klipten eşit aralıklarla alınmış temsili kareleri analiz et ve sözleşmeye uygun JSON çıktısını üret.",
          },
          ...imageParts,
        ],
      },
    ],
  };
}

function buildTextOnlyBody(metrics: MeasuredMetrics): Record<string, unknown> {
  return {
    model: GROQ_MODEL,
    temperature: 0.9,
    max_tokens: 2200,
    messages: [
      { role: "system", content: buildTextOnlyFallbackPrompt(metrics) },
      {
        role: "user",
        content:
          "Video şu anda işlenemiyor; lütfen sözleşmeye uygun, ölçülen verilerle tutarlı bir JSON tahmini üret.",
      },
    ],
  };
}

/**
 * Attempts the Groq fallback provider. First tries a multi-frame request
 * (3-5 representative stills extracted client-side from the video) across
 * every provided key, rotating on any failure (auth error, rate limit,
 * server error, or a modality rejection from the model). If every key
 * fails in multi-frame mode, a second pass rotates the same keys again
 * using a text-only prompt grounded in the real measured metrics, so the
 * API always has a final safety net and never needs to hand the client a
 * hard failure unless Groq itself is fully unreachable on all keys in
 * both modes.
 */
export async function callGroqWithRotation(
  frameDataUrls: string[],
  metrics: MeasuredMetrics,
  rawKeys: (string | undefined | null)[]
): Promise<{ result: AnalysisResult; logs: GroqAttemptLog[] } | { result: null; logs: GroqAttemptLog[] }> {
  const keys = cleanKeys(rawKeys);
  const logs: GroqAttemptLog[] = [];

  if (frameDataUrls.length > 0) {
    const multiFrameBody = buildMultiFrameBody(frameDataUrls, metrics);
    for (const key of keys) {
      const label = maskKey(key);
      const outcome = await callGroqOnce(key, multiFrameBody);

      if ("result" in outcome) {
        logs.push({ keyLabel: label, ok: true, mode: "multi-frame" });
        return { result: outcome.result, logs };
      }

      logs.push({ keyLabel: label, ok: false, status: outcome.status, message: outcome.error, mode: "multi-frame" });
    }
  }

  const textOnlyBody = buildTextOnlyBody(metrics);
  for (const key of keys) {
    const label = maskKey(key);
    const outcome = await callGroqOnce(key, textOnlyBody);

    if ("result" in outcome) {
      logs.push({ keyLabel: label, ok: true, mode: "text-only" });
      return { result: outcome.result, logs };
    }

    logs.push({ keyLabel: label, ok: false, status: outcome.status, message: outcome.error, mode: "text-only" });
  }

  return { result: null, logs };
}