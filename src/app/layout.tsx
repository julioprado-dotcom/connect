import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DECODEX — Inteligencia de Señales",
  description:
    "DECODEX: Plataforma de inteligencia de señales mediáticas impulsada por ONION200 que monitorea presencia de legisladores en medios. Pluralismo y transparencia conforme a la Constitución Política del Estado.",
  icons: {
    icon: '/favicon.png',
  },
  keywords: [
    "DECODEX",
    "inteligencia mediática",
    "Bolivia",
    "legisladores",
    "medios",
    "monitoreo",
    "ONION200",
    "Asamblea Legislativa",
    "2025-2030",
  ],
  authors: [{ name: "DECODEX" }],
  openGraph: {
    title: "DECODEX — Inteligencia de Señales",
    description:
      "Conectate con inteligencia de señales del Sur Global — Periodo 2025-2030",
    type: "website",
    locale: "es_BO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" style={{'--brand-mint': '#00E5A0', '--brand-navy': '#0A1628', '--brand-night': '#1A2744', '--brand-sand': '#F5F5F0', '--brand-amber': '#F59E0B'} as React.CSSProperties}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
