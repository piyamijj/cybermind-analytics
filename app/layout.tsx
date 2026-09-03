import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CyberMind Analytics | Psikolojik Durum Analizi",
  description:
    "Selfie tabanlı yapay zeka destekli psikolojik durum analiz sistemi. Yüzünüzü tarayın, anlık ruh halinizi, stres, yorgunluk, mutluluk ve odaklanma seviyenizi saniyeler içinde öğrenin.",
  keywords: [
    "psikolojik durum analizi",
    "yüz analizi",
    "yapay zeka",
    "ruh hali",
    "stres analizi",
    "CyberMind Analytics",
  ],
  authors: [{ name: "CyberMind Analytics" }],
};

export const viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`dark ${orbitron.variable} ${rajdhani.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}