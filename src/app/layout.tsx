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
  title: "Monitor de Presencia en Medios | Bolivia 2025-2030",
  description:
    "Sistema de inteligencia mediática que monitorea la presencia de legisladores bolivianos en medios de comunicación. Pluralismo y transparencia conforme a la Constitución Política del Estado.",
  keywords: [
    "Bolivia",
    "legisladores",
    "medios",
    "monitoreo",
    "prensa",
    "Asamblea Legislativa",
    "2025-2030",
  ],
  authors: [{ name: "Monitor de Presencia en Medios" }],
  openGraph: {
    title: "Monitor de Presencia en Medios | Bolivia",
    description:
      "Inteligencia mediática sobre legisladores bolivianos — Periodo 2025-2030",
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
