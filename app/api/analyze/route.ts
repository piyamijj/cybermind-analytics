import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRotation } from "@/lib/gemini-client";
import { callGroqWithRotation } from "@/lib/groq-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6MB raw image ceiling, generous for a compressed selfie JPEG

interface AnalyzeRequestBody {
  image?: unknown;
  mimeType?: unknown;
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

function stripDataUrlPrefix(image: string): string {
  const commaIndex = image.indexOf(",");
  if (image.startsWith("data:") && commaIndex !== -1) {
    return image.slice(commaIndex + 1);
  }
  return image;
}

function isLikelyBase64(value: string): boolean {
  if (value.length === 0) return false;
  const sample = value.length > 4000 ? value.slice(0, 4000) : value;
  return /^[A-Za-z0-9+/=\s]+$/.test(sample);
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "İstek gövdesi okunamadı. Lütfen geçerli bir görüntü gönderin." },
      { status: 400 }
    );
  }

  const rawImage = body.image;
  const rawMimeType = body.mimeType;

  if (typeof rawImage !== "string" || rawImage.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Görüntü verisi eksik. Lütfen yüzünüzü tekrar tarayın." },
      { status: 400 }
    );
  }

  const mimeType = typeof rawMimeType === "string" && rawMimeType.trim().length > 0 ? rawMimeType.trim() : "image/jpeg";
  const imageBase64 = stripDataUrlPrefix(rawImage.trim());

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json(
      { success: false, error: "Görüntü dosyası çok büyük. Lütfen tekrar tarama yapın." },
      { status: 413 }
    );
  }

  if (!isLikelyBase64(imageBase64)) {
    return NextResponse.json(
      { success: false, error: "Görüntü verisi bozuk görünüyor. Lütfen yüzünüzü tekrar tarayın." },
      { status: 400 }
    );
  }

  const geminiKeys = getGeminiKeys();
  const geminiOutcome = await callGeminiWithRotation(imageBase64, mimeType, geminiKeys);

  if (geminiOutcome.result) {
    return NextResponse.json({ success: true, ...geminiOutcome.result }, { status: 200 });
  }

  console.warn(
    "[analyze] Gemini rotation exhausted, falling back to Groq.",
    JSON.stringify(geminiOutcome.logs)
  );

  const groqKeys = getGroqKeys();
  const groqOutcome = await callGroqWithRotation(imageBase64, mimeType, groqKeys);

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