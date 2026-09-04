"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface MeasuredStatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  delay?: number;
}

export default function MeasuredStat({ icon: Icon, label, value, sublabel, delay = 0 }: MeasuredStatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="glass-panel-inner flex flex-col gap-2 p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-cyber-cyan2" strokeWidth={1.75} />
          <span className="font-body text-[11px] font-medium uppercase tracking-wide text-cyber-muted">
            {label}
          </span>
        </div>
        <span className="rounded-full border border-cyber-green/40 bg-cyber-green/10 px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-cyber-green">
          Ölçülen
        </span>
      </div>

      <span className="font-display text-lg font-bold text-white">{value}</span>

      {sublabel && (
        <span className="font-body text-[10px] leading-snug text-cyber-muted">{sublabel}</span>
      )}
    </motion.div>
  );
}