import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#05070d",
          panel: "#0a0f1c",
          panel2: "#0d1425",
          border: "#2a5670",
          cyan: "#38e2ff",
          cyan2: "#7ef7ff",
          magenta: "#ff2ec4",
          violet: "#8b5cf6",
          green: "#39ff9d",
          amber: "#ffb547",
          red: "#ff4d6d",
          muted: "#5a6b8c",
        },
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "sans-serif"],
        body: ["var(--font-rajdhani)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(56, 226, 255, 0.35), 0 0 60px rgba(56, 226, 255, 0.15)",
        "glow-magenta": "0 0 20px rgba(255, 46, 196, 0.35), 0 0 60px rgba(255, 46, 196, 0.15)",
        "inner-glow": "inset 0 0 30px rgba(56, 226, 255, 0.08)",
      },
      backgroundImage: {
        "grid-lines":
          "linear-gradient(rgba(56, 226, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 226, 255, 0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "28px 28px",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-10%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(110%)", opacity: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55", filter: "brightness(1)" },
          "50%": { opacity: "1", filter: "brightness(1.4)" },
        },
        "border-flicker": {
          "0%, 100%": { opacity: "1" },
          "45%": { opacity: "0.6" },
          "50%": { opacity: "1" },
          "55%": { opacity: "0.7" },
        },
        "sweep-rotate": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        scanline: "scanline 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "border-flicker": "border-flicker 3.5s ease-in-out infinite",
        "sweep-rotate": "sweep-rotate 6s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;