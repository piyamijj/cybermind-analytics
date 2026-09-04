"use client";

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

import type { MeasuredMetrics } from "./types";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Standard 6-point EAR (eye aspect ratio) landmark index sets for the
// MediaPipe FaceMesh 468/478-point topology. Order per set:
// [outerCorner, upperLid1, upperLid2, innerCorner, lowerLid2, lowerLid1]
const EYE_SET_A = [33, 160, 158, 133, 153, 144];
const EYE_SET_B = [362, 385, 387, 263, 373, 380];

// Iris center landmarks (only present when refineLandmarks/478-point output
// is enabled, which FaceLandmarker provides by default).
const IRIS_A_CENTER = 468;
const IRIS_B_CENTER = 473;

// Eye corner landmarks used as the horizontal/vertical reference frame for
// gaze-offset estimation.
const EYE_A_OUTER = 33;
const EYE_A_INNER = 133;
const EYE_B_OUTER = 362;
const EYE_B_INNER = 263;

// Landmarks used for the forehead rPPG region of interest and for
// scale-normalizing ROI size against face size.
const FOREHEAD_LANDMARK = 10;
const BROW_MID_LANDMARK = 9;
const FACE_LEFT = 234;
const FACE_RIGHT = 454;

// Landmark pairs used for the left/right structural asymmetry score.
// Each pair is [pointOnSideA, pointOnSideB]; distances from a stable
// midline reference (nose bridge, index 168) are compared.
const ASYMMETRY_PAIRS: Array<[number, number]> = [
  [50, 280], // cheek
  [61, 291], // mouth corners
  [105, 334], // eyebrow
  [234, 454], // face edge
  [33, 263], // eye outer corners
];
const NOSE_BRIDGE = 168;

const EAR_CLOSE_THRESHOLD = 0.19;
const EAR_OPEN_THRESHOLD = 0.23;

const RPPG_MIN_BPM = 42;
const RPPG_MAX_BPM = 180;
const RPPG_MIN_SAMPLES = 40; // ~4s at 10Hz sampling

interface Point3 {
  x: number;
  y: number;
  z: number;
}

function dist(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return mean(values.map((v) => (v - m) * (v - m)));
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function computeEar(landmarks: Point3[], indices: number[]): number | null {
  const pts = indices.map((i) => landmarks[i]);
  if (pts.some((p) => !p)) return null;
  const [p1, p2, p3, p4, p5, p6] = pts;
  const horizontal = dist(p1, p4);
  if (horizontal < 1e-6) return null;
  const vertical = dist(p2, p6) + dist(p3, p5);
  const ear = vertical / (2 * horizontal);
  if (!Number.isFinite(ear)) return null;
  return ear;
}

/**
 * Decomposes a MediaPipe facial transformation matrix (column-major 4x4,
 * as documented by FaceLandmarker) into pitch/yaw/roll Euler angles in
 * degrees, using the standard rotation-matrix-to-Euler-angles formula for
 * an R = Rz(roll) * Ry(yaw) * Rx(pitch) composition. Returns null if the
 * matrix is missing or numerically degenerate, so callers can skip the
 * frame instead of recording a garbage angle.
 */
function decomposeHeadPose(matrixData: number[] | undefined): { pitch: number; yaw: number; roll: number } | null {
  if (!matrixData || matrixData.length < 16) return null;

  // Column-major -> row-major rotation submatrix.
  const r00 = matrixData[0];
  const r10 = matrixData[1];
  const r20 = matrixData[2];
  const r01 = matrixData[4];
  const r11 = matrixData[5];
  const r21 = matrixData[6];
  const r02 = matrixData[8];
  const r12 = matrixData[9];
  const r22 = matrixData[10];

  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const singular = sy < 1e-6;

  let pitch: number;
  let yaw: number;
  let roll: number;

  if (!singular) {
    pitch = Math.atan2(r21, r22);
    yaw = Math.atan2(-r20, sy);
    roll = Math.atan2(r10, r00);
  } else {
    pitch = Math.atan2(-r12, r11);
    yaw = Math.atan2(-r20, sy);
    roll = 0;
  }

  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const result = { pitch: toDeg(pitch), yaw: toDeg(yaw), roll: toDeg(roll) };

  if (!Number.isFinite(result.pitch) || !Number.isFinite(result.yaw) || !Number.isFinite(result.roll)) {
    return null;
  }
  return result;
}

/** Goertzel algorithm: power of a single target frequency bin in a signal. */
function goertzelPower(signal: number[], targetFreqHz: number, sampleRateHz: number): number {
  const n = signal.length;
  if (n === 0) return 0;
  const k = Math.round((n * targetFreqHz) / sampleRateHz);
  const omega = (2 * Math.PI * k) / n;
  const cosine = Math.cos(omega);
  const coeff = 2 * cosine;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    s0 = signal[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const real = s1 - s2 * cosine;
  const imag = s2 * Math.sin(omega);
  return real * real + imag * imag;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    try {
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
    } catch {
      // Some browsers/devices reject the GPU delegate (no WebGL2, driver
      // issues, etc.) - retry once on CPU before giving up entirely.
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
    }
  })();

  return landmarkerPromise;
}

export class FaceMetricsAnalyzer {
  private landmarker: FaceLandmarker | null = null;
  private ready = false;
  private failed = false;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private totalSamples = 0;
  private faceDetectedSamples = 0;

  private pitchValues: number[] = [];
  private yawValues: number[] = [];
  private rollValues: number[] = [];

  private eyeClosed = false;
  private blinkCount = 0;
  private firstSampleTs: number | null = null;
  private lastSampleTs: number | null = null;

  private onCameraSamples = 0;
  private gazeSamples = 0;

  private asymmetrySamples: number[] = [];

  private rppgSignal: number[] = [];

  async init(): Promise<void> {
    try {
      this.landmarker = await getLandmarker();
      this.ready = true;
    } catch {
      // Model failed to load (offline, blocked CDN, unsupported browser).
      // The capture flow must still work without measured metrics.
      this.failed = true;
      this.ready = false;
    }
  }

  get isAvailable(): boolean {
    return this.ready && !this.failed;
  }

  private ensureCanvas(video: HTMLVideoElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!this.ctx) return null;
    return { canvas: this.canvas, ctx: this.ctx };
  }

  /** Captures the current video frame as a downscaled JPEG data URL (used for the Groq multi-frame fallback). */
  captureJpeg(video: HTMLVideoElement, maxWidth = 480): string | null {
    try {
      const targetWidth = Math.min(maxWidth, video.videoWidth || maxWidth);
      const scale = targetWidth / (video.videoWidth || targetWidth);
      const targetHeight = Math.round((video.videoHeight || targetWidth) * scale);
      const off = document.createElement("canvas");
      off.width = targetWidth;
      off.height = targetHeight;
      const ctx = off.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      return off.toDataURL("image/jpeg", 0.82);
    } catch {
      return null;
    }
  }

  /** Processes one video frame. Safe to call on a fixed interval (e.g. every ~80-100ms) during recording. */
  sample(video: HTMLVideoElement, timestampMs: number): void {
    this.totalSamples += 1;
    if (this.firstSampleTs === null) this.firstSampleTs = timestampMs;
    this.lastSampleTs = timestampMs;

    if (!this.isAvailable || !this.landmarker) return;
    if (video.readyState < 2) return;

    const surface = this.ensureCanvas(video);
    if (!surface) return;
    const { canvas, ctx } = surface;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }

    // rPPG: sample forehead ROI green-channel mean regardless of landmark
    // success, using a generic centered ROI as a reasonable default; it is
    // refined below once landmarks are available for this frame.
    let roi: { x: number; y: number; w: number; h: number } | null = null;

    let result: FaceLandmarkerResult | null = null;
    try {
      result = this.landmarker.detectForVideo(canvas, timestampMs);
    } catch {
      result = null;
    }

    const landmarks = result?.faceLandmarks?.[0] as Point3[] | undefined;

    if (landmarks && landmarks.length > 0) {
      this.faceDetectedSamples += 1;

      // --- Head pose ---
      const matrix = result?.facialTransformationMatrixes?.[0]?.data;
      const pose = decomposeHeadPose(matrix as unknown as number[] | undefined);
      if (pose) {
        this.pitchValues.push(pose.pitch);
        this.yawValues.push(pose.yaw);
        this.rollValues.push(pose.roll);
      }

      // --- Blink via EAR ---
      const earA = computeEar(landmarks, EYE_SET_A);
      const earB = computeEar(landmarks, EYE_SET_B);
      if (earA !== null && earB !== null) {
        const earAvg = (earA + earB) / 2;
        if (!this.eyeClosed && earAvg < EAR_CLOSE_THRESHOLD) {
          this.eyeClosed = true;
        } else if (this.eyeClosed && earAvg > EAR_OPEN_THRESHOLD) {
          this.eyeClosed = false;
          this.blinkCount += 1;
        }
      }

      // --- Gaze (iris offset relative to eye corners) ---
      const irisA = landmarks[IRIS_A_CENTER];
      const irisB = landmarks[IRIS_B_CENTER];
      const outerA = landmarks[EYE_A_OUTER];
      const innerA = landmarks[EYE_A_INNER];
      const outerB = landmarks[EYE_B_OUTER];
      const innerB = landmarks[EYE_B_INNER];
      if (irisA && irisB && outerA && innerA && outerB && innerB) {
        const ratioA = (irisA.x - outerA.x) / (innerA.x - outerA.x || 1e-6);
        const ratioB = (irisB.x - outerB.x) / (innerB.x - outerB.x || 1e-6);
        const avgRatio = (ratioA + ratioB) / 2;
        this.gazeSamples += 1;
        if (avgRatio > 0.32 && avgRatio < 0.68) {
          this.onCameraSamples += 1;
        }
      }

      // --- Asymmetry ---
      const noseBridge = landmarks[NOSE_BRIDGE];
      if (noseBridge) {
        const ratios: number[] = [];
        for (const [idxA, idxB] of ASYMMETRY_PAIRS) {
          const a = landmarks[idxA];
          const b = landmarks[idxB];
          if (!a || !b) continue;
          const da = dist(a, noseBridge);
          const db = dist(b, noseBridge);
          const denom = (da + db) / 2;
          if (denom < 1e-6) continue;
          ratios.push(Math.abs(da - db) / denom);
        }
        if (ratios.length > 0) {
          this.asymmetrySamples.push(mean(ratios));
        }
      }

      // --- rPPG forehead ROI, scaled by face size ---
      const forehead = landmarks[FOREHEAD_LANDMARK];
      const browMid = landmarks[BROW_MID_LANDMARK];
      const faceLeft = landmarks[FACE_LEFT];
      const faceRight = landmarks[FACE_RIGHT];
      if (forehead && browMid && faceLeft && faceRight) {
        const faceWidthPx = Math.abs(faceRight.x - faceLeft.x) * canvas.width;
        const boxSize = clamp(faceWidthPx * 0.28, 8, canvas.width * 0.5);
        const cx = ((forehead.x + browMid.x) / 2) * canvas.width;
        const cy = ((forehead.y + browMid.y) / 2) * canvas.height;
        roi = {
          x: clamp(cx - boxSize / 2, 0, canvas.width - 1),
          y: clamp(cy - boxSize / 2, 0, canvas.height - 1),
          w: clamp(boxSize, 1, canvas.width),
          h: clamp(boxSize, 1, canvas.height),
        };
      }
    }

    if (roi) {
      try {
        const w = Math.max(1, Math.min(Math.round(roi.w), canvas.width - Math.round(roi.x)));
        const h = Math.max(1, Math.min(Math.round(roi.h), canvas.height - Math.round(roi.y)));
        const imageData = ctx.getImageData(Math.round(roi.x), Math.round(roi.y), w, h);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          sum += imageData.data[i + 1]; // green channel
          count += 1;
        }
        if (count > 0) {
          this.rppgSignal.push(sum / count);
        }
      } catch {
        // getImageData can throw on a tainted canvas in rare setups; skip.
      }
    }
  }

  private estimateRppg(): { bpm: number | null; confidence: number } {
    const n = this.rppgSignal.length;
    if (n < RPPG_MIN_SAMPLES || this.firstSampleTs === null || this.lastSampleTs === null) {
      return { bpm: null, confidence: 0 };
    }

    const durationSec = (this.lastSampleTs - this.firstSampleTs) / 1000;
    if (durationSec < 3) return { bpm: null, confidence: 0 };
    const sampleRateHz = n / durationSec;
    if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) return { bpm: null, confidence: 0 };

    // Detrend with a simple moving-average subtraction, then normalize.
    const windowSize = Math.max(3, Math.round(sampleRateHz * 1.5));
    const detrended: number[] = [];
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(n, i + windowSize + 1);
      let sum = 0;
      for (let j = start; j < end; j++) sum += this.rppgSignal[j];
      const localMean = sum / (end - start);
      detrended.push(this.rppgSignal[i] - localMean);
    }
    const sd = Math.sqrt(variance(detrended)) || 1;
    const normalized = detrended.map((v) => v / sd);

    let bestBpm = RPPG_MIN_BPM;
    let bestPower = -Infinity;
    let totalPower = 0;
    let bins = 0;
    for (let bpm = RPPG_MIN_BPM; bpm <= RPPG_MAX_BPM; bpm += 1) {
      const freqHz = bpm / 60;
      if (freqHz >= sampleRateHz / 2) break;
      const power = goertzelPower(normalized, freqHz, sampleRateHz);
      totalPower += power;
      bins += 1;
      if (power > bestPower) {
        bestPower = power;
        bestBpm = bpm;
      }
    }

    if (bins === 0 || !Number.isFinite(bestPower)) return { bpm: null, confidence: 0 };

    const avgPower = totalPower / bins;
    const peakRatio = avgPower > 0 ? bestPower / avgPower : 0;
    // A peakRatio well above 1 means the signal has a clear dominant
    // frequency; scale into a rough 0-100 confidence, capped conservatively
    // since this is an experimental, non-clinical estimate either way.
    const confidence = clamp(Math.round((peakRatio - 1) * 18), 0, 70);

    if (confidence < 12) {
      return { bpm: null, confidence };
    }

    return { bpm: bestBpm, confidence };
  }

  finalize(): MeasuredMetrics {
    const stabilityRaw = variance(this.pitchValues) + variance(this.yawValues) + variance(this.rollValues);
    // Empirically, a very stable head across a short clip has combined
    // variance well under ~10 (deg^2); scale that into a 0-100 score.
    const stabilityScore = clamp(100 - stabilityRaw * 2.5, 0, 100);

    const durationMinutes =
      this.firstSampleTs !== null && this.lastSampleTs !== null
        ? Math.max((this.lastSampleTs - this.firstSampleTs) / 60000, 1 / 60)
        : 1 / 60;

    const faceDetectedPercent = this.totalSamples > 0 ? (this.faceDetectedSamples / this.totalSamples) * 100 : 0;
    const gazeOnCameraPercent = this.gazeSamples > 0 ? (this.onCameraSamples / this.gazeSamples) * 100 : 0;
    const asymmetryScore = this.asymmetrySamples.length > 0 ? clamp(mean(this.asymmetrySamples) * 400, 0, 100) : 0;

    const rppg = this.estimateRppg();

    // Overall capture-quality proxy: weighted mix of how much of the clip
    // had a clearly detected frontal face, how stable the head pose was
    // (less motion blur / better landmark tracking), and whether enough
    // frames were collected at all for the aggregates above to be meaningful.
    const frameCoverageScore = clamp((this.totalSamples / 50) * 100, 0, 100);
    const confidenceScore = clamp(
      faceDetectedPercent * 0.5 + stabilityScore * 0.3 + frameCoverageScore * 0.2,
      0,
      100
    );

    return {
      headPose: {
        pitchMeanDeg: Math.round(mean(this.pitchValues) * 10) / 10,
        yawMeanDeg: Math.round(mean(this.yawValues) * 10) / 10,
        rollMeanDeg: Math.round(mean(this.rollValues) * 10) / 10,
        stabilityScore: Math.round(stabilityScore),
      },
      blink: {
        count: this.blinkCount,
        perMinute: Math.round(this.blinkCount / durationMinutes),
      },
      gaze: {
        onCameraPercent: Math.round(gazeOnCameraPercent),
      },
      asymmetryScore: Math.round(asymmetryScore),
      rppg: {
        bpm: rppg.bpm,
        confidence: Math.round(rppg.confidence),
      },
      signalQuality: {
        confidenceScore: Math.round(confidenceScore),
        framesAnalyzed: this.totalSamples,
        faceDetectedPercent: Math.round(faceDetectedPercent),
      },
    };
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }
}