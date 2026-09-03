"use client";

import { motion } from "framer-motion";
import { gaugeAngleFromValue } from "@/lib/ui-helpers";

interface RadialGaugeProps {
  value: number;
  moodLabel: string;
}

const ARC_RADIUS = 90;
const ARC_CX = 110;
const ARC_CY = 110;
const STROKE_WIDTH = 14;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function RadialGauge({ value, moodLabel }: RadialGaugeProps) {
  const needleAngle = gaugeAngleFromValue(value);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[130px] w-[220px]">
        <svg
          viewBox="0 0 220 130"
          width="220"
          height="130"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="gaugeCyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38e2ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7ef7ff" stopOpacity="1" />
            </linearGradient>
            <filter id="needleGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track */}
          <path
            d={describeArc(ARC_CX, ARC_CY, ARC_RADIUS, 0, 180)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />

          {/* Zone: critical (red) */}
          <path
            d={describeArc(ARC_CX, ARC_CY, ARC_RADIUS, 0, 45)}
            fill="none"
            stroke="#ff4d6d"
            strokeOpacity={0.55}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
          {/* Zone: warning (amber) */}
          <path
            d={describeArc(ARC_CX, ARC_CY, ARC_RADIUS, 45, 90)}
            fill="none"
            stroke="#ffb547"
            strokeOpacity={0.5}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
          {/* Zone: neutral/positive (cyan) */}
          <path
            d={describeArc(ARC_CX, ARC_CY, ARC_RADIUS, 90, 180)}
            fill="none"
            stroke="url(#gaugeCyan)"
            strokeOpacity={0.85}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[0, 45, 90, 135, 180].map((tick) => {
            const outer = polarToCartesian(ARC_CX, ARC_CY, ARC_RADIUS + 12, tick);
            const inner = polarToCartesian(ARC_CX, ARC_CY, ARC_RADIUS + 4, tick);
            return (
              <line
                key={tick}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(126, 247, 255, 0.35)"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Needle */}
          <g style={{ transformOrigin: `${ARC_CX}px ${ARC_CY}px` }}>
            <motion.g
              initial={{ rotate: -90 }}
              animate={{ rotate: needleAngle }}
              transition={{ type: "spring", stiffness: 55, damping: 12, delay: 0.15 }}
              style={{ transformOrigin: `${ARC_CX}px ${ARC_CY}px` }}
            >
              <line
                x1={ARC_CX}
                y1={ARC_CY}
                x2={ARC_CX}
                y2={ARC_CY - ARC_RADIUS + 16}
                stroke="#e6f6ff"
                strokeWidth={3}
                strokeLinecap="round"
                filter="url(#needleGlow)"
              />
            </motion.g>
            <circle cx={ARC_CX} cy={ARC_CY} r={7} fill="#0d1425" stroke="#38e2ff" strokeWidth={2} />
          </g>
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-1 font-display text-lg font-semibold text-cyber-cyan2 neon-text text-center"
      >
        {moodLabel}
      </motion.div>
    </div>
  );
}