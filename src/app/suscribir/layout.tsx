import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suscripción Gratuita — DECODEX Bolivia',
  description:
    'Suscríbete gratis a El Radar, Voz y Voto, El Hilo y más boletines de inteligencia de señales.',
};

export default function SuscribirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-start justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
