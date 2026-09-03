import { ANALYSIS_SYSTEM_PROMPT, ANALYSIS_TEXT_ONLY_FALLBACK_PROMPT } from "./prompt";
import { parseAnalysisJson } from "./analysis-schema";
import type { AnalysisResult } from "./types";

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 25000;

export interface GroqAttemptLog {
  keyLabel: string;
  ok: boolean;
  status?: number;
  message?: string;
  mode: "multimodal" | "text-only";
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

function buildMultimodalBody(imageBase64: string, mimeType: string): Record<string, unknown> {
  return {
    model: GROQ_MODEL,
    temperature: 0.6,
    max_tokens: 1100,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Lütfen ekteki selfie fotoğrafını analiz et ve sözleşmeye uygun JSON çıktısını üret." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
  };
}

function buildTextOnlyBody(): Record<string, unknown> {
  return {
    model: GROQ_MODEL,
    temperature: 0.9,
    max_tokens: 1100,
    messages: [
      { role: "system", content: ANALYSIS_TEXT_ONLY_FALLBACK_PROMPT },
      {
        role: "user",
        content:
          "Görsel şu anda işlenemiyor; lütfen sözleşmeye uygun, makul ve çeşitlilik gösteren bir JSON tahmini üret.",
      },
    ],
  };
}

/**
 * Attempts the Groq fallback provider. First tries the exact same
 * multimodal (image + prompt) request across every provided key, rotating
 * on any failure (auth error, rate limit, server error, or an image
 * modality rejection from the model). If every key fails in multimodal
 * mode, a second pass rotates the same keys again using a text-only
 * heuristic prompt, so the API always has a final safety net and never
 * needs to hand the client a hard failure unless Groq itself is fully
 * unreachable on all keys in both modes.
 */
export async function callGroqWithRotation(
  imageBase64: string,
  mimeType: string,
  rawKeys: (string | undefined | null)[]
): Promise<{ result: AnalysisResult; logs: GroqAttemptLog[] } | { result: null; logs: GroqAttemptLog[] }> {
  const keys = cleanKeys(rawKeys);
  const logs: GroqAttemptLog[] = [];

  const multimodalBody = buildMultimodalBody(imageBase64, mimeType);
  for (const key of keys) {
    const label = maskKey(key);
    const outcome = await callGroqOnce(key, multimodalBody);

    if ("result" in outcome) {
      logs.push({ keyLabel: label, ok: true, mode: "multimodal" });
      return { result: outcome.result, logs };
    }

    logs.push({ keyLabel: label, ok: false, status: outcome.status, message: outcome.error, mode: "multimodal" });
  }

  const textOnlyBody = buildTextOnlyBody();
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