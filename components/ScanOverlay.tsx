"use client";

import { motion } from "framer-motion";

export default function ScanOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {/* Dim scan-grid backdrop */}
      <div className="absolute inset-0 scan-grid opacity-40" />

      {/* Sweeping laser line */}
      <motion.div
        className="absolute left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(56,226,255,0.9) 20%, rgba(126,247,255,1) 50%, rgba(56,226,255,0.9) 80%, transparent 100%)",
          boxShadow: "0 0 16px 4px rgba(56,226,255,0.7)",
        }}
        initial={{ top: "0%" }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
      />

      {/* Secondary faint trailing line */}
      <motion.div
        className="absolute left-0 right-0 h-6 opacity-30"
        style={{
          background:
            "linear-gradient(180deg, rgba(56,226,255,0.5) 0%, transparent 100%)",
        }}
        initial={{ top: "0%" }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
      />

      {/* Center reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="h-40 w-40 rounded-full border border-cyber-cyan/40"
          animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.7, 0.15, 0.7] }}
          transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 m-auto h-28 w-28 rounded-full border border-dashed border-cyber-cyan2/50"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, ease: "linear", repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 m-auto h-16 w-16 rounded-full border border-cyber-magenta/40"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, delay: 0.3 }}
        />
      </div>

      {/* Rotating targeting corner brackets */}
      {[
        "top-3 left-3 border-t-2 border-l-2",
        "top-3 right-3 border-t-2 border-r-2",
        "bottom-3 left-3 border-b-2 border-l-2",
        "bottom-3 right-3 border-b-2 border-r-2",
      ].map((pos, i) => (
        <motion.div
          key={pos}
          className={`absolute h-8 w-8 border-cyber-cyan2 ${pos}`}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}

      {/* Floating data readout labels */}
      <div className="absolute left-3 top-3 translate-y-9 font-body text-[10px] uppercase tracking-widest text-cyber-cyan2/80">
        Yüz İzleniyor...
      </div>
      <div className="absolute bottom-3 right-3 translate-y-[-2.25rem] font-body text-[10px] uppercase tracking-widest text-cyber-cyan2/80">
        Mikro İfade Analizi
      </div>
    </div>
  );
}