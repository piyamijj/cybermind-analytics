"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Circle } from "lucide-react";

interface RecordingOverlayProps {
  mode: "countdown" | "recording";
  countdownValue?: number | null;
  progressPercent?: number;
  secondsLeft?: number;
}

export default function RecordingOverlay({
  mode,
  countdownValue = null,
  progressPercent = 0,
  secondsLeft = 0,
}: RecordingOverlayProps) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progressPercent)) / 100) * circumference;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-cyber-bg/40">
      <div className="absolute inset-0 scan-grid opacity-30" />

      <AnimatePresence mode="wait">
        {mode === "countdown" && countdownValue !== null && (
          <motion.div
            key={countdownValue}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            <span className="font-display text-7xl font-bold text-cyber-cyan2 neon-text">
              {countdownValue}
            </span>
            <span className="font-body text-xs uppercase tracking-[0.25em] text-cyber-muted">
              Hazırlanın...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {mode === "recording" && (
        <>
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-cyber-red/50 bg-cyber-bg/70 px-2.5 py-1 backdrop-blur-md">
            <motion.span
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Circle className="h-2.5 w-2.5 fill-cyber-red text-cyber-red" />
            </motion.span>
            <span className="font-body text-[10px] font-semibold uppercase tracking-widest text-cyber-red">
              Kayıt
            </span>
          </div>

          <div className="absolute right-3 top-3">
            <svg width="64" height="64" viewBox="0 0 80 80" className="-rotate-90">
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="#38e2ff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ filter: "drop-shadow(0 0 6px rgba(56,226,255,0.8))" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center rotate-0 font-display text-sm font-bold text-white">
              {secondsLeft}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-cyber-bg/90 to-transparent px-4 pb-4 pt-10 text-center">
            <span className="font-body text-xs font-medium text-cyber-cyan2">
              Sabit durun, kameraya bakın
            </span>
            <span className="font-body text-[10px] text-cyber-muted">
              Normal ışıkta kalın, yüzünüz net görünsün
            </span>
          </div>

          {["top-3 left-20 border-t-2 border-l-0", "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map(
            (pos) => (
              <div key={pos} className={`absolute h-6 w-6 border-cyber-cyan2/50 ${pos}`} />
            )
          )}
        </>
      )}
    </div>
  );
}