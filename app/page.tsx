"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BatteryLow,
  Camera,
  Cpu,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Smile,
  Sparkles,
  SwitchCamera,
  Target,
} from "lucide-react";
import RadialGauge from "@/components/RadialGauge";
import StatBar from "@/components/StatBar";
import ScanOverlay from "@/components/ScanOverlay";
import { computeWellbeingIndex } from "@/lib/ui-helpers";
import type { AnalysisResult, AnalyzeApiResponse } from "@/lib/types";

type Phase = "idle" | "analyzing" | "result" | "error";

export default function Home() {
  const webcamRef = useRef<Webcam>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoConstraints = useMemo(
    () => ({
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 854 },
    }),
    [facingMode]
  );

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

  const handleScan = useCallback(async () => {
    const webcam = webcamRef.current;
    if (!webcam) {
      setErrorMessage("Kamera henüz hazır değil. Lütfen birkaç saniye bekleyip tekrar deneyin.");
      setPhase("error");
      return;
    }

    const screenshot = webcam.getScreenshot({ width: 480, height: 640 });
    if (!screenshot) {
      setErrorMessage("Görüntü yakalanamadı. Lütfen kameranın yüzünüzü net gördüğünden emin olun.");
      setPhase("error");
      return;
    }

    setCapturedImage(screenshot);
    setResult(null);
    setErrorMessage(null);
    setPhase("analyzing");

    try {
      const base64Data = screenshot.split(",")[1] ?? screenshot;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          mimeType: "image/jpeg",
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
        analysisNote: data.analysisNote,
      });
      setPhase("result");
    } catch {
      setErrorMessage(
        "Sunucuya bağlanırken bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin."
      );
      setPhase("error");
    }
  }, []);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setCapturedImage(null);
    setResult(null);
    setErrorMessage(null);
    setCameraReady(false);
  }, []);

  const wellbeingIndex = result ? computeWellbeingIndex(result) : 50;
  const isBusy = phase === "analyzing";

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-10 sm:py-14">
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyber-cyan/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyber-magenta/10 blur-[100px]" />

      <header className="relative z-10 mb-10 flex flex-col items-center text-center">
        <div className="mb-3 flex items-center gap-2 rounded-full border border-cyber-border bg-cyber-panel/60 px-4 py-1.5 backdrop-blur-md">
          <Cpu className="h-3.5 w-3.5 text-cyber-cyan2 animate-pulse-glow" />
          <span className="font-body text-xs uppercase tracking-[0.25em] text-cyber-cyan2">
            Yapay Zeka Destekli Analiz Sistemi
          </span>
        </div>
        <h1 className="hud-heading neon-text text-3xl font-bold sm:text-4xl">
          CyberMind <span className="text-cyber-magenta neon-text-magenta">Analytics</span>
        </h1>
        <p className="mt-3 max-w-xl font-body text-sm text-cyber-muted sm:text-base">
          Yüzünüzü tarayın, yapay zeka mikro ifadelerinizi analiz ederek anlık ruh halinizi,
          stresinizi ve odaklanma seviyenizi saniyeler içinde ortaya çıkarsın.
        </p>
      </header>

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* LEFT: Camera / captured image panel */}
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
              {phase === "idle" && (
                <Webcam
                  key={facingMode}
                  ref={webcamRef}
                  audio={false}
                  mirrored={facingMode === "user"}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.85}
                  videoConstraints={videoConstraints}
                  onUserMedia={() => setCameraReady(true)}
                  onUserMediaError={handleUserMediaError}
                  className="h-full w-full object-cover"
                />
              )}

              {phase !== "idle" && capturedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedImage}
                  alt="Yakalanan selfie görüntüsü"
                  className="h-full w-full object-cover"
                />
              )}

              {phase === "idle" && !cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cyber-bg/90 text-center">
                  <Camera className="h-6 w-6 animate-pulse text-cyber-cyan2" />
                  <span className="font-body text-xs text-cyber-muted">
                    Kamera başlatılıyor...
                  </span>
                </div>
              )}

              {/* Idle face-alignment guide */}
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

            {/* Bottom control bar mimicking a phone camera UI */}
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
              <button
                onClick={handleScan}
                disabled={phase === "idle" && !cameraReady}
                className="btn-primary w-full"
              >
                <ScanFace className="h-4 w-4" />
                {phase === "error" ? "Tekrar Dene" : "Yüzü Tara"}
              </button>
            )}

            {phase === "analyzing" && (
              <button disabled className="btn-primary w-full">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Analiz Ediliyor...
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
                <RadialGauge value={isBusy ? 50 : 0} moodLabel={isBusy ? "Analiz Sürüyor..." : "Beklemede"} />
                <p className="max-w-xs font-body text-sm text-cyber-muted">
                  {phase === "analyzing"
                    ? "Yüz ifadeleriniz taranıyor, sinir ağı verileri işliyor. Lütfen bekleyin."
                    : phase === "error"
                    ? "Analiz tamamlanamadı. Kameradan yeniden tarama yaparak tekrar deneyebilirsiniz."
                    : "Sonuçların burada görüntülenmesi için önce sol taraftan yüzünüzü tarayın."}
                </p>
              </motion.div>
            )}

            {phase === "result" && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-1 flex-col"
              >
                <div className="mb-5 flex justify-center">
                  <RadialGauge value={wellbeingIndex} moodLabel={result.mood} />
                </div>

                <div className="flex flex-col gap-4">
                  <StatBar
                    icon={Activity}
                    label="Stres Seviyesi"
                    value={result.stress}
                    colorFrom="#ff4d6d"
                    colorTo="#ff8a65"
                    delay={0.05}
                  />
                  <StatBar
                    icon={BatteryLow}
                    label="Yorgunluk"
                    value={result.fatigue}
                    colorFrom="#ffb547"
                    colorTo="#ffe08a"
                    delay={0.15}
                  />
                  <StatBar
                    icon={Smile}
                    label="Anlık Mutluluk"
                    value={result.happiness}
                    colorFrom="#38e2ff"
                    colorTo="#39ff9d"
                    delay={0.25}
                  />
                  <StatBar
                    icon={Target}
                    label="Odaklanma"
                    value={result.focus}
                    colorFrom="#8b5cf6"
                    colorTo="#38e2ff"
                    delay={0.35}
                  />
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="glass-panel-inner mt-5 p-4"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-cyber-cyan2" />
                    <span className="font-display text-xs uppercase tracking-[0.15em] text-cyber-cyan2">
                      Analiz Notu
                    </span>
                  </div>
                  <p className="font-body text-sm leading-relaxed text-white/85">
                    {result.analysisNote}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className="relative z-10 mt-10 flex flex-col items-center gap-1 text-center">
        <p className="font-body text-xs text-cyber-muted">
          CyberMind Analytics, yapay zeka modelleri kullanarak yüz ifadelerinizden yola çıkan
          eğlence ve farkındalık amaçlı bir psikolojik durum tahmini sunar.
        </p>
        <p className="font-body text-[11px] text-cyber-muted/70">
          Bu uygulama tıbbi teşhis niteliği taşımaz ve profesyonel bir değerlendirmenin yerini tutmaz.
        </p>
      </footer>
    </main>
  );
}