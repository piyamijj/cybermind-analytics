import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRotation } from "@/lib/gemini-client";
import { callGroqWithRotation } from "@/lib/groq-client";
import type { MeasuredMetrics } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_VIDEO_BASE64_LENGTH = 12_000_000; // ~9MB raw video ceiling, generous for a compressed short clip
const MAX_FRAMES = 6;

interface AnalyzeRequestBody {
  video?: unknown;
  mimeType?: unknown;
  frames?: unknown;
  measured?: unknown;
}

function getGeminiKeys(): (string | undefined)[] {
  return [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4,
    process.env.GEMINI_KEY_5,
  ];
}

function getGroqKeys(): (string | undefined)[] {
  return [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4,
    process.env.GROQ_KEY_5,
  ];
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1);
  }
  return value;
}

function isLikelyBase64(value: string): boolean {
  if (value.length === 0) return false;
  const sample = value.length > 4000 ? value.slice(0, 4000) : value;
  return /^[A-Za-z0-9+/=\s]+$/.test(sample);
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function safeNullableNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

/**
 * Defensively sanitizes the client-reported measured metrics object.
 * The client-side computer-vision pipeline can legitimately fail (no
 * WebGL, blocked CDN, low light, etc.); in that case we still want the
 * request to proceed with honest, low-confidence defaults instead of
 * rejecting the whole analysis or trusting unvalidated client input.
 */
function sanitizeMeasuredMetrics(raw: unknown): MeasuredMetrics {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const headPoseRaw =
    obj.headPose && typeof obj.headPose === "object" && !Array.isArray(obj.headPose)
      ? (obj.headPose as Record<string, unknown>)
      : {};
  const blinkRaw =
    obj.blink && typeof obj.blink === "object" && !Array.isArray(obj.blink) ? (obj.blink as Record<string, unknown>) : {};
  const gazeRaw =
    obj.gaze && typeof obj.gaze === "object" && !Array.isArray(obj.gaze) ? (obj.gaze as Record<string, unknown>) : {};
  const rppgRaw =
    obj.rppg && typeof obj.rppg === "object" && !Array.isArray(obj.rppg) ? (obj.rppg as Record<string, unknown>) : {};
  const signalQualityRaw =
    obj.signalQuality && typeof obj.signalQuality === "object" && !Array.isArray(obj.signalQuality)
      ? (obj.signalQuality as Record<string, unknown>)
      : {};

  return {
    headPose: {
      pitchMeanDeg: safeNumber(headPoseRaw.pitchMeanDeg, 0, -90, 90),
      yawMeanDeg: safeNumber(headPoseRaw.yawMeanDeg, 0, -90, 90),
      rollMeanDeg: safeNumber(headPoseRaw.rollMeanDeg, 0, -90, 90),
      stabilityScore: safeNumber(headPoseRaw.stabilityScore, 0, 0, 100),
    },
    blink: {
      count: Math.round(safeNumber(blinkRaw.count, 0, 0, 500)),
      perMinute: Math.round(safeNumber(blinkRaw.perMinute, 0, 0, 200)),
    },
    gaze: {
      onCameraPercent: safeNumber(gazeRaw.onCameraPercent, 0, 0, 100),
    },
    asymmetryScore: safeNumber(obj.asymmetryScore, 0, 0, 100),
    rppg: {
      bpm: safeNullableNumber(rppgRaw.bpm, 30, 220),
      confidence: safeNumber(rppgRaw.confidence, 0, 0, 100),
    },
    signalQuality: {
      confidenceScore: safeNumber(signalQualityRaw.confidenceScore, 0, 0, 100),
      framesAnalyzed: Math.round(safeNumber(signalQualityRaw.framesAnalyzed, 0, 0, 100000)),
      faceDetectedPercent: safeNumber(signalQualityRaw.faceDetectedPercent, 0, 0, 100),
    },
  };
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "İstek gövdesi okunamadı. Lütfen geçerli bir video gönderin." },
      { status: 400 }
    );
  }

  const rawVideo = body.video;
  const rawMimeType = body.mimeType;
  const rawFrames = body.frames;

  if (typeof rawVideo !== "string" || rawVideo.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Video verisi eksik. Lütfen yüzünüzü tekrar tarayın." },
      { status: 400 }
    );
  }

  const mimeType = typeof rawMimeType === "string" && rawMimeType.trim().length > 0 ? rawMimeType.trim() : "video/webm";
  const videoBase64 = stripDataUrlPrefix(rawVideo.trim());

  if (videoBase64.length > MAX_VIDEO_BASE64_LENGTH) {
    return NextResponse.json(
      { success: false, error: "Video dosyası çok büyük. Lütfen daha kısa bir tarama yapın." },
      { status: 413 }
    );
  }

  if (!isLikelyBase64(videoBase64)) {
    return NextResponse.json(
      { success: false, error: "Video verisi bozuk görünüyor. Lütfen yüzünüzü tekrar tarayın." },
      { status: 400 }
    );
  }

  const frames: string[] = Array.isArray(rawFrames)
    ? rawFrames.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, MAX_FRAMES)
    : [];

  const measured = sanitizeMeasuredMetrics(body.measured);

  const geminiKeys = getGeminiKeys();
  const geminiOutcome = await callGeminiWithRotation(videoBase64, mimeType, measured, geminiKeys);

  if (geminiOutcome.result) {
    return NextResponse.json({ success: true, ...geminiOutcome.result }, { status: 200 });
  }

  console.warn(
    "[analyze] Gemini rotation exhausted, falling back to Groq.",
    JSON.stringify(geminiOutcome.logs)
  );

  const groqKeys = getGroqKeys();
  const groqOutcome = await callGroqWithRotation(frames, measured, groqKeys);

  if (groqOutcome.result) {
    return NextResponse.json({ success: true, ...groqOutcome.result }, { status: 200 });
  }

  console.error(
    "[analyze] Both Gemini and Groq providers failed.",
    JSON.stringify({ gemini: geminiOutcome.logs, groq: groqOutcome.logs })
  );

  return NextResponse.json(
    {
      success: false,
      error:
        "Analiz servislerine şu anda ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.",
    },
    { status: 502 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Bu uç nokta yalnızca POST isteklerini kabul eder.",
    },
    { status: 405 }
  );
}