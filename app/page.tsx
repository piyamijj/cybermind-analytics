"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BatteryLow,
  Brain,
  Camera,
  Crosshair,
  Cpu,
  Eye,
  FileCheck2,
  Fingerprint,
  HeartPulse,
  Info,
  Move3d,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Smile,
  Sparkles,
  SplitSquareHorizontal,
  SwitchCamera,
  Target,
} from "lucide-react";
import RadialGauge from "@/components/RadialGauge";
import StatBar from "@/components/StatBar";
import ScanOverlay from "@/components/ScanOverlay";
import RecordingOverlay from "@/components/RecordingOverlay";
import MeasuredStat from "@/components/MeasuredStat";
import ReportSection from "@/components/ReportSection";
import { computeWellbeingIndex } from "@/lib/ui-helpers";
import { FaceMetricsAnalyzer } from "@/lib/face-metrics";
import type { AnalysisResult, AnalyzeApiResponse, MeasuredMetrics } from "@/lib/types";

type Phase = "idle" | "countdown" | "recording" | "analyzing" | "result" | "error";

const RECORDING_DURATION_MS = 7000;
const SAMPLE_INTERVAL_MS = 90;
const FRAME_CAPTURE_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9];
const VIDEO_BITRATE = 500_000;
const COUNTDOWN_STEPS = [3, 2, 1];

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // ignore and try next
    }
  }
  return "video/webm";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Video okunamadı."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Video okunamadı."));
    reader.readAsDataURL(blob);
  });
}

function formatBpm(rppg: MeasuredMetrics["rppg"]): { value: string; sublabel: string } {
  if (rppg.bpm === null) {
    return { value: "Yetersiz Sinyal", sublabel: "Deneysel rPPG tahmini için sinyal çok zayıf/gürültülü" };
  }
  return { value: `${rppg.bpm} BPM`, sublabel: `Güven: ${rppg.confidence}/100 (deneysel tahmin)` };
}

export default function Home() {
  const webcamRef = useRef<Webcam>(null);
  const analyzerRef = useRef<FaceMetricsAnalyzer | null>(null);
  const sampleIntervalRef = useRef<number | null>(null);
  const capturedVideoUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(RECORDING_DURATION_MS / 1000));

  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);
  const [measured, setMeasured] = useState<MeasuredMetrics | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const videoConstraints = useMemo(
    () => ({
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 854 },
    }),
    [facingMode]
  );

  useEffect(() => {
    return () => {
      if (capturedVideoUrlRef.current) {
        URL.revokeObjectURL(capturedVideoUrlRef.current);
      }
      if (sampleIntervalRef.current !== null) {
        window.clearInterval(sampleIntervalRef.current);
      }
    };
  }, []);

  const handleUserMediaError = useCallback(() => {
    setErrorMessage(
      "Kameraya erişim sağlanamadı. Lütfen tarayıcı ayarlarından kamera iznini onaylayıp sayfayı yenileyin."
    );
    setPhase("error");
  }, []);

  const handleFlipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    setCameraReady(false);
  }, []);

  const handleReset = useCallback(() => {
    if (capturedVideoUrlRef.current) {
      URL.revokeObjectURL(capturedVideoUrlRef.current);
      capturedVideoUrlRef.current = null;
    }
    setPhase("idle");
    setCapturedVideoUrl(null);
    setResult(null);
    setMeasured(null);
    setErrorMessage(null);
    setCameraReady(false);
    setRecordingProgress(0);
    setCountdownValue(null);
  }, []);

  const handleStartScan = useCallback(async () => {
    const webcam = webcamRef.current;
    const videoEl = webcam?.video as HTMLVideoElement | undefined;
    const stream = (videoEl?.srcObject as MediaStream | null) ?? null;

    if (!videoEl || !stream) {
      setErrorMessage("Kamera henüz hazır değil. Lütfen birkaç saniye bekleyip tekrar deneyin.");
      setPhase("error");
      return;
    }

    setErrorMessage(null);
    setResult(null);
    setMeasured(null);
    if (capturedVideoUrlRef.current) {
      URL.revokeObjectURL(capturedVideoUrlRef.current);
      capturedVideoUrlRef.current = null;
      setCapturedVideoUrl(null);
    }

    setPhase("countdown");
    for (const step of COUNTDOWN_STEPS) {
      setCountdownValue(step);
      await sleep(800);
    }
    setCountdownValue(null);

    const analyzer = new FaceMetricsAnalyzer();
    analyzerRef.current = analyzer;
    try {
      await analyzer.init();
    } catch {
      // face-metrics degrade gracefully to low-confidence defaults; the
      // video capture and AI analysis must still proceed regardless.
    }

    const mimeType = pickSupportedMimeType();
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
    } catch {
      setErrorMessage("Bu tarayıcı video kaydını desteklemiyor. Lütfen güncel bir tarayıcı ile tekrar deneyin.");
      setPhase("error");
      return;
    }
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    setPhase("recording");
    setRecordingProgress(0);
    setSecondsLeft(Math.ceil(RECORDING_DURATION_MS / 1000));
    recorder.start();

    const startTs = performance.now();
    const frames: string[] = [];
    let frameCursor = 0;
    const frameCaptureTimes = FRAME_CAPTURE_FRACTIONS.map((f) => f * RECORDING_DURATION_MS);

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTs;

      try {
        analyzer.sample(videoEl, now);
      } catch {
        // never let a single bad frame break the recording loop
      }

      setRecordingProgress(Math.min(100, (elapsed / RECORDING_DURATION_MS) * 100));
      setSecondsLeft(Math.max(0, Math.ceil((RECORDING_DURATION_MS - elapsed) / 1000)));

      if (frameCursor < frameCaptureTimes.length && elapsed >= frameCaptureTimes[frameCursor]) {
        const jpeg = analyzer.captureJpeg(videoEl);
        if (jpeg) frames.push(jpeg);
        frameCursor += 1;
      }
    }, SAMPLE_INTERVAL_MS);
    sampleIntervalRef.current = intervalId;

    await sleep(RECORDING_DURATION_MS);

    window.clearInterval(intervalId);
    sampleIntervalRef.current = null;

    const videoBlob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunks, { type: mimeType }));
      }
    });

    let measuredMetrics: MeasuredMetrics;
    try {
      measuredMetrics = analyzer.finalize();
    } catch {
      measuredMetrics = {
        headPose: { pitchMeanDeg: 0, yawMeanDeg: 0, rollMeanDeg: 0, stabilityScore: 0 },
        blink: { count: 0, perMinute: 0 },
        gaze: { onCameraPercent: 0 },
        asymmetryScore: 0,
        rppg: { bpm: null, confidence: 0 },
        signalQuality: { confidenceScore: 0, framesAnalyzed: 0, faceDetectedPercent: 0 },
      };
    }
    analyzer.dispose();
    setMeasured(measuredMetrics);

    const objectUrl = URL.createObjectURL(videoBlob);
    capturedVideoUrlRef.current = objectUrl;
    setCapturedVideoUrl(objectUrl);

    setPhase("analyzing");

    try {
      const videoBase64 = await blobToBase64(videoBlob);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: videoBase64,
          mimeType,
          frames,
          measured: measuredMetrics,
        }),
      });

      const data: AnalyzeApiResponse = await response.json();

      if (!response.ok || data.success === false) {
        const message =
          data.success === false && data.error
            ? data.error
            : "Analiz servisinden geçerli bir yanıt alınamadı. Lütfen tekrar deneyin.";
        setErrorMessage(message);
        setPhase("error");
        return;
      }

      setResult({
        mood: data.mood,
        stress: data.stress,
        fatigue: data.fatigue,
        happiness: data.happiness,
        focus: data.focus,
        authenticity: data.authenticity,
        analysisNote: data.analysisNote,
        report: data.report,
      });
      setPhase("result");
    } catch {
      setErrorMessage(
        "Sunucuya bağlanırken bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin."
      );
      setPhase("error");
    }
  }, []);

  const wellbeingIndex = result ? computeWellbeingIndex(result) : 0;
  const isLiveWebcamPhase = phase === "idle" || phase === "countdown" || phase === "recording" || phase === "error";
  const showCapturedMedia = (phase === "analyzing" || phase === "result") && capturedVideoUrl;
  const rppgDisplay = measured ? formatBpm(measured.rppg) : null;

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-10 sm:py-14">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyber-cyan/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyber-magenta/10 blur-[100px]" />

      <header className="relative z-10 mb-10 flex flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-2 rounded-full border border-cyber-border bg-cyber-panel/60 px-4 py-1.5 backdrop-blur-md">
          <Cpu className="h-3.5 w-3.5 text-cyber-cyan2 animate-pulse-glow" />
          <span className="font-body text-xs uppercase tracking-[0.25em] text-cyber-cyan2">
            Yapay Zeka Destekli Biyometrik Analiz Sistemi
          </span>
        </div>
        <h1 className="hud-heading neon-text text-3xl font-bold sm:text-4xl">
          CyberMind <span className="text-cyber-magenta neon-text-magenta">Analytics</span>
        </h1>
        <p className="mt-3 max-w-xl font-body text-sm text-cyber-muted sm:text-base">
          Kameranıza {Math.round(RECORDING_DURATION_MS / 1000)} saniye bakın — tarayıcınızda çalışan gerçek
          bilgisayarlı görü baş pozunuzu, göz kırpmanızı ve nabız dalgalanmanızı ölçerken, yapay zeka
          mikro ifadelerinizi yorumlayarak derinlemesine bir biyometrik rapor çıkarsın.
        </p>
      </header>

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* LEFT: Camera / captured video panel */}
        <div className="glass-panel flex flex-col items-center gap-5 p-5 sm:p-6">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyber-red animate-blink" />
              <span className="font-body text-xs uppercase tracking-[0.2em] text-cyber-muted">
                Canlı Kamera Beslemesi
              </span>
            </div>
            <button
              onClick={handleFlipCamera}
              disabled={phase !== "idle"}
              className="rounded-lg border border-cyber-border/60 p-1.5 text-cyber-muted transition-colors hover:text-cyber-cyan2 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Kamerayı değiştir"
              title="Kamerayı Çevir"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </div>

          <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-cyber-border/70 bg-black shadow-inner-glow">
            <div className="relative aspect-[3/4] w-full">
              {isLiveWebcamPhase && (
                <Webcam
                  key={facingMode}
                  ref={webcamRef}
                  audio={false}
                  mirrored={facingMode === "user"}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={handleUserMediaError}
                  className="h-full w-full object-cover"
                />
              )}

              {showCapturedMedia && (
                <video
                  src={capturedVideoUrl ?? undefined}
                  loop
                  muted
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}

              {phase === "idle" && !cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cyber-bg/90 text-center">
                  <Camera className="h-6 w-6 animate-pulse text-cyber-cyan2" />
                  <span className="font-body text-xs text-cyber-muted">Kamera başlatılıyor...</span>
                </div>
              )}

              {phase === "idle" && cameraReady && (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/2 top-[42%] h-44 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[45%] border border-dashed border-cyber-cyan2/40" />
                  {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2", "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map(
                    (pos) => (
                      <div key={pos} className={`absolute h-6 w-6 border-cyber-cyan2/60 ${pos}`} />
                    )
                  )}
                </div>
              )}

              {phase === "countdown" && <RecordingOverlay mode="countdown" countdownValue={countdownValue} />}

              {phase === "recording" && (
                <RecordingOverlay mode="recording" progressPercent={recordingProgress} secondsLeft={secondsLeft} />
              )}

              {phase === "analyzing" && <ScanOverlay />}

              {phase === "result" && (
                <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full border border-cyber-green/40 bg-cyber-bg/70 px-2.5 py-1 backdrop-blur-md">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyber-green" />
                  <span className="font-body text-[10px] uppercase tracking-wider text-cyber-green">
                    Tarama Tamamlandı
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center border-t border-cyber-border/50 bg-cyber-panel/80 py-3">
              <div className="h-1 w-16 rounded-full bg-white/15" />
            </div>
          </div>

          {phase === "error" && errorMessage && (
            <div className="flex w-full max-w-[320px] items-start gap-2 rounded-xl border border-cyber-red/40 bg-cyber-red/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyber-red" />
              <p className="font-body text-xs leading-relaxed text-cyber-red">{errorMessage}</p>
            </div>
          )}

          <div className="flex w-full max-w-[320px] flex-col gap-2.5">
            {(phase === "idle" || phase === "error") && (
              <button onClick={handleStartScan} disabled={phase === "idle" && !cameraReady} className="btn-primary w-full">
                <ScanFace className="h-4 w-4" />
                {phase === "error" ? "Tekrar Dene" : "Yüzü Tara"}
              </button>
            )}

            {phase === "countdown" && (
              <button disabled className="btn-primary w-full">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Hazırlanıyor...
              </button>
            )}

            {phase === "recording" && (
              <button disabled className="btn-primary w-full">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Kayıt Yapılıyor... ({secondsLeft} sn)
              </button>
            )}

            {phase === "analyzing" && (
              <button disabled className="btn-primary w-full">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Video Analiz Ediliyor...
              </button>
            )}

            {phase === "result" && (
              <button onClick={handleReset} className="btn-secondary w-full">
                <RefreshCw className="h-3.5 w-3.5" />
                Tekrar Tara
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: HUD results panel */}
        <div className="glass-panel relative flex flex-col p-5 sm:p-6">
          <div className="hud-corner top-3 left-3 border-t-2 border-l-2 animate-border-flicker" />
          <div className="hud-corner top-3 right-3 border-t-2 border-r-2 animate-border-flicker" />
          <div className="hud-corner bottom-3 left-3 border-b-2 border-l-2 animate-border-flicker" />
          <div className="hud-corner bottom-3 right-3 border-b-2 border-r-2 animate-border-flicker" />

          <h2 className="hud-heading mb-5 text-lg">Psikolojik Durum Analizi</h2>

          <AnimatePresence mode="wait">
            {phase !== "result" && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center"
              >
                <RadialGauge
                  value={phase === "recording" ? recordingProgress : phase === "analyzing" ? 50 : 0}
                  moodLabel={
                    phase === "recording"
                      ? "Kayıt Yapılıyor..."
                      : phase === "analyzing"
                      ? "Analiz Sürüyor..."
                      : "Beklemede"
                  }
                />
                <p className="max-w-xs font-body text-sm text-cyber-muted">
                  {phase === "recording"
                    ? "Baş pozunuz, göz kırpmanız ve nabız dalgalanmanız tarayıcınızda gerçek zamanlı ölçülüyor."
                    : phase === "analyzing"
                    ? "Video yapay zekaya iletildi, mikro ifadeler ve biyometrik sinyaller işleniyor. Lütfen bekleyin."
                    : phase === "error"
                    ? "Analiz tamamlanamadı. Kameradan yeniden tarama yaparak tekrar deneyebilirsiniz."
                    : "Sonuçların burada görüntülenmesi için önce sol taraftan yüzünüzü tarayın."}
                </p>
              </motion.div>
            )}

            {phase === "result" && result && measured && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-1 flex-col gap-6"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex justify-center">
                    <RadialGauge value={wellbeingIndex} moodLabel={result.mood} />
                  </div>

                  <span className="text-center font-body text-[11px] uppercase tracking-[0.2em] text-cyber-muted">
                    Hızlı Özet · AI Tahmini
                  </span>

                  <div className="flex flex-col gap-4">
                    <StatBar icon={Activity} label="Stres Seviyesi" value={result.stress} colorFrom="#ff4d6d" colorTo="#ff8a65" delay={0.05} />
                    <StatBar icon={BatteryLow} label="Yorgunluk" value={result.fatigue} colorFrom="#ffb547" colorTo="#ffe08a" delay={0.15} />
                    <StatBar icon={Smile} label="Anlık Mutluluk" value={result.happiness} colorFrom="#38e2ff" colorTo="#39ff9d" delay={0.25} />
                    <StatBar icon={Target} label="Odaklanma" value={result.focus} colorFrom="#8b5cf6" colorTo="#38e2ff" delay={0.35} />
                    <StatBar icon={Fingerprint} label="Doğallık" value={result.authenticity} colorFrom="#39ff9d" colorTo="#38e2ff" delay={0.45} />
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55, duration: 0.4 }}
                    className="glass-panel-inner p-4"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-cyber-cyan2" />
                      <span className="font-display text-xs uppercase tracking-[0.15em] text-cyber-cyan2">
                        Analiz Notu
                      </span>
                    </div>
                    <p className="font-body text-sm leading-relaxed text-white/85">{result.analysisNote}</p>
                  </motion.div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="font-body text-[11px] uppercase tracking-[0.2em] text-cyber-green">
                    Ölçülen Veriler · Tarayıcıda Hesaplanan Gerçek Sinyaller
                  </span>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MeasuredStat
                      icon={Move3d}
                      label="Baş Stabilitesi"
                      value={`${measured.headPose.stabilityScore}/100`}
                      sublabel={`Pitch ${measured.headPose.pitchMeanDeg}° · Yaw ${measured.headPose.yawMeanDeg}° · Roll ${measured.headPose.rollMeanDeg}°`}
                      delay={0.05}
                    />
                    <MeasuredStat
                      icon={Eye}
                      label="Göz Kırpma"
                      value={`${measured.blink.count} kez`}
                      sublabel={`${measured.blink.perMinute} kez/dakika`}
                      delay={0.1}
                    />
                    <MeasuredStat
                      icon={Crosshair}
                      label="Kameraya Bakış"
                      value={`%${measured.gaze.onCameraPercent}`}
                      sublabel="Klip boyunca kameraya dönük bakış oranı"
                      delay={0.15}
                    />
                    <MeasuredStat
                      icon={SplitSquareHorizontal}
                      label="Asimetri Skoru"
                      value={`${measured.asymmetryScore}/100`}
                      sublabel="Sol-sağ yapısal/kas tepki farkı"
                      delay={0.2}
                    />
                    <MeasuredStat
                      icon={HeartPulse}
                      label="Nabız Tahmini (rPPG)"
                      value={rppgDisplay?.value ?? "Yetersiz Sinyal"}
                      sublabel={rppgDisplay?.sublabel}
                      delay={0.25}
                    />
                    <MeasuredStat
                      icon={ShieldCheck}
                      label="Sinyal Kalitesi"
                      value={`${measured.signalQuality.confidenceScore}/100`}
                      sublabel={`${measured.signalQuality.framesAnalyzed} kare · %${measured.signalQuality.faceDetectedPercent} yüz net tespit`}
                      delay={0.3}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="font-body text-[11px] uppercase tracking-[0.2em] text-cyber-magenta">
                    Derinlemesine Biyometrik Rapor · AI Tahmini
                  </span>
                  <div className="flex flex-col gap-3">
                    <ReportSection
                      icon={Activity}
                      title="Fiziksel ve Fizyolojik Durum"
                      text={result.report.fizikselFizyolojik}
                      delay={0.1}
                    />
                    <ReportSection
                      icon={Brain}
                      title="Duygusal ve Psikolojik Analiz"
                      text={result.report.duygusalPsikolojik}
                      delay={0.2}
                    />
                    <ReportSection
                      icon={Target}
                      title="Bilişsel Yük ve Odak"
                      text={result.report.bilisselYukOdak}
                      delay={0.3}
                    />
                    <ReportSection
                      icon={FileCheck2}
                      title="Genel Değerlendirme ve Analiz Güven Skoru"
                      text={result.report.genelDegerlendirme}
                      measuredBadgeLabel="Analiz Güven Skoru"
                      measuredBadgeValue={`${measured.signalQuality.confidenceScore}/100`}
                      delay={0.4}
                    />
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.85, duration: 0.4 }}
                  className="flex items-start gap-2 rounded-lg border border-cyber-border/50 bg-cyber-panel2/50 p-2.5"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyber-muted" />
                  <p className="font-body text-[11px] leading-relaxed text-cyber-muted">
                    Bu sonuçlar yalnızca eğlence ve farkındalık amaçlıdır; tıbbi veya klinik bir psikolojik
                    değerlendirme niteliği taşımaz ve profesyonel bir değerlendirmenin yerini tutmaz. Nabız
                    (rPPG) değeri deneysel, laboratuvar doğruluğunda olmayan bir tahmindir; FACS/mikro ifade
                    ve pupillometri yorumları ise yapay zekanın görsel izlenimidir, ölçülen "Ölçülen"
                    etiketli veriler dışındaki tüm değerler AI tahminidir.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className="relative z-10 mt-10 flex flex-col items-center gap-1 text-center">
        <p className="font-body text-xs text-cyber-muted">
          CyberMind Analytics, tarayıcınızda çalışan gerçek bilgisayarlı görü ölçümlerini ve yapay zeka
          modellerini birleştirerek eğlence ve farkındalık amaçlı bir biyometrik durum tahmini sunar.
        </p>
        <p className="font-body text-[11px] text-cyber-muted/70">
          Bu uygulama tıbbi teşhis niteliği taşımaz ve profesyonel bir değerlendirmenin yerini tutmaz.
        </p>
      </footer>
    </main>
  );
}