"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface ReportSectionProps {
  icon: LucideIcon;
  title: string;
  text: string;
  delay?: number;
  measuredBadgeLabel?: string;
  measuredBadgeValue?: string;
}

export default function ReportSection({
  icon: Icon,
  title,
  text,
  delay = 0,
  measuredBadgeLabel,
  measuredBadgeValue,
}: ReportSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-panel-inner flex flex-col gap-2 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyber-magenta" strokeWidth={1.75} />
          <span className="font-display text-xs uppercase tracking-[0.15em] text-white/90">
            {title}
          </span>
        </div>
        <span className="rounded-full border border-cyber-magenta/40 bg-cyber-magenta/10 px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-cyber-magenta">
          AI Tahmini
        </span>
      </div>

      {measuredBadgeLabel && measuredBadgeValue && (
        <div className="flex items-center gap-2 rounded-lg border border-cyber-green/30 bg-cyber-green/5 px-2.5 py-1.5">
          <span className="rounded-full border border-cyber-green/40 bg-cyber-green/10 px-1.5 py-0.5 font-body text-[9px] font-semibold uppercase tracking-wider text-cyber-green">
            Ölçülen
          </span>
          <span className="font-body text-xs text-cyber-green/90">
            {measuredBadgeLabel}: <span className="font-display font-bold">{measuredBadgeValue}</span>
          </span>
        </div>
      )}

      <p className="font-body text-sm leading-relaxed text-white/80">{text}</p>
    </motion.div>
  );
}