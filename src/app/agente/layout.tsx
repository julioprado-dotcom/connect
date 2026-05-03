import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal Agente — DECODEX Bolivia',
  description: 'Portal de agentes comerciales ONION200',
};

export default function AgenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with DECODEX branding */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded flex items-center justify-center" style={{ backgroundColor: '#0F2027' }}>
            <span className="text-[10px] font-bold" style={{ color: '#FF862F' }}>D</span>
          </div>
          <div>
            <p className="text-xs font-bold text-foreground leading-none">DECODEX BOLIVIA</p>
            <p className="text-[9px] text-muted-foreground">Portal Agente</p>
          </div>
        </div>
        <Link href="/" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          &larr; Admin
        </Link>
      </header>
      {/* Main content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {children}
      </main>
      {/* Bottom branding */}
      <footer className="bg-card/80 backdrop-blur border-t border-border px-4 py-2 text-center">
        <p className="text-[10px] text-muted-foreground">DECODEX Bolivia &middot; Inteligencia de Medios</p>
      </footer>
    </div>
  );
}
