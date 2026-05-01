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
  title: "CONNECT Bolivia — Inteligencia Mediática",
  description:
    "CONNECT Bolivia: SaaS de inteligencia mediática que monitorea presencia de legisladores en medios. Pluralismo y transparencia conforme a la Constitución Política del Estado.",
  keywords: [
    "CONNECT Bolivia",
    "inteligencia mediática",
    "Bolivia",
    "legisladores",
    "medios",
    "monitoreo",
    "ONION200",
    "Asamblea Legislativa",
    "2025-2030",
  ],
  authors: [{ name: "CONNECT Bolivia" }],
  openGraph: {
    title: "CONNECT Bolivia — Inteligencia Mediática",
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
