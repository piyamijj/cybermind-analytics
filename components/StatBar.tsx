"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { getQualitativeTag } from "@/lib/ui-helpers";

interface StatBarProps {
  icon: LucideIcon;
  label: string;
  value: number;
  colorFrom: string;
  colorTo: string;
  delay?: number;
}

export default function StatBar({
  icon: Icon,
  label,
  value,
  colorFrom,
  colorTo,
  delay = 0,
}: StatBarProps) {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const tag = getQualitativeTag(safeValue);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="w-full"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyber-cyan2" strokeWidth={1.75} />
          <span className="font-body text-sm font-medium tracking-wide text-cyber-cyan2/90">
            {label}
          </span>
        </div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3, duration: 0.3 }}
          className="font-display text-sm font-bold text-white"
        >
          %{Math.round(safeValue)}
        </motion.span>
      </div>

      <div className="stat-track">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
            boxShadow: `0 0 10px ${colorTo}`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${safeValue}%` }}
          transition={{ delay: delay + 0.1, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="mt-1 flex justify-end">
        <span className="font-body text-xs uppercase tracking-wider text-cyber-muted">
          {tag}
        </span>
      </div>
    </motion.div>
  );
}