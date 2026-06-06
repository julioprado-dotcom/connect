'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, CheckCircle2, Clock, Circle, Target } from 'lucide-react';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface EstrategiaWidgetProps {
  onNavigate: (viewId: string) => void;
}

interface RoadmapFase {
  id: string;
  nombre: string;
  descripcion: string;
  estado: 'completada' | 'en_progreso' | 'pendiente';
  hitos: { label: string; completado: boolean }[];
}

// ─── Roadmap Data (hardcoded from docs/HOJA_DE_RUTA) ─────────

const FASES: RoadmapFase[] = [
  {
    id: 'fase-1',
    nombre: 'Fase 1: Fundacion',
    descripcion: 'Infraestructura base, modelos de datos, scraping elemental',
    estado: 'completada',
    hitos: [
      { label: 'Prisma schema + 27 modelos', completado: true },
      { label: 'Scraping headlines Check-First', completado: true },
      { label: 'Worker + Scheduler + Jobs', completado: true },
      { label: 'Dashboard v1 (10 componentes)', completado: true },
    ],
  },
  {
    id: 'fase-2',
    nombre: 'Fase 2: Catalogo',
    descripcion: 'Scraping full-text, extraccion de menciones con IA, ejes tematicos',
    estado: 'en_progreso',
    hitos: [
      { label: 'Full-text extraction (Capa 3)', completado: true },
      { label: 'Menciones con IA (Capa 4)', completado: true },
      { label: 'Marco conceptual: ejes + temas', completado: true },
      { label: '173 personas en seguimiento', completado: true },
      { label: '30 fuentes configuradas', completado: true },
      { label: 'Boletines automaticos ONION200', completado: true },
    ],
  },
  {
    id: 'fase-3',
    nombre: 'Fase 3: Escalabilidad',
    descripcion: 'Gestion comercial, contratos, suscriptores, entregas programadas',
    estado: 'en_progreso',
    hitos: [
      { label: 'Modulo clientes + contratos', completado: true },
      { label: 'Suscriptores (pago + gratuito)', completado: true },
      { label: 'Entregas multi-canal', completado: true },
      { label: 'Reportes personalizados', completado: true },
      { label: 'Dashboard completo 18 widgets', completado: true },
    ],
  },
  {
    id: 'fase-4',
    nombre: 'Fase 4: Inteligencia',
    descripcion: 'Generadores ONION200 (Termometro, Saldo, Foco, Radar)',
    estado: 'en_progreso',
    hitos: [
      { label: 'Generador Termometro (configurado)', completado: true },
      { label: 'Generador Saldo (configurado)', completado: true },
      { label: 'Generador El Foco (configurado)', completado: true },
      { label: 'Generador El Radar (configurado)', completado: true },
    ],
  },
  {
    id: 'fase-5',
    nombre: 'Fase 5: Expansion',
    descripcion: 'API publica, integraciones, multi-tenant, movil',
    estado: 'pendiente',
    hitos: [
      { label: 'API REST publica documentada', completado: false },
      { label: 'Webhooks para integraciones', completado: false },
      { label: 'Multi-tenant (organizaciones)', completado: false },
      { label: 'App movil (PWA)', completado: false },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: RoadmapFase['estado'] }) {
  if (estado === 'completada') {
    return (
      <Badge className="text-[9px] px-2 py-0.5 h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
        Completada
      </Badge>
    );
  }
  if (estado === 'en_progreso') {
    return (
      <Badge className="text-[9px] px-2 py-0.5 h-4 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
        <Clock className="h-2.5 w-2.5 mr-1" />
        En progreso
      </Badge>
    );
  }
  return (
    <Badge className="text-[9px] px-2 py-0.5 h-4 bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
      <Circle className="h-2.5 w-2.5 mr-1" />
      Pendiente
    </Badge>
  );
}

function totalProgress(fases: RoadmapFase[]): number {
  const totalHitos = fases.reduce((s, f) => s + f.hitos.length, 0);
  const completados = fases.reduce(
    (s, f) => s + f.hitos.filter((h) => h.completado).length,
    0,
  );
  return totalHitos > 0 ? Math.round((completados / totalHitos) * 100) : 0;
}

// ─── Component ────────────────────────────────────────────────

export function EstrategiaWidget({ onNavigate }: EstrategiaWidgetProps) {
  const status: WidgetStatus = 'ok'; // Always informational
  const progress = totalProgress(FASES);
  const completadas = FASES.filter((f) => f.estado === 'completada').length;
  const enProgreso = FASES.filter((f) => f.estado === 'en_progreso').length;

  return (
    <CollapsibleWidget
      id="widget-estrategia"
      title="Estrategia"
      icon={Rocket}
      status={status}
      badge={`${progress}%`}
      badgeLabel="progreso"
      targetView="estrategia"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Progreso general</span>
              <span className="text-xs font-bold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-3 text-[9px] text-muted-foreground">
              <span>{completadas} completadas</span>
              <span>{enProgreso} en progreso</span>
              <span>{FASES.length - completadas - enProgreso} pendientes</span>
            </div>
          </div>

          {/* Phases */}
          <div className="space-y-2">
            {FASES.map((fase) => {
              const faseProgress = fase.hitos.filter((h) => h.completado).length;
              const faseTotal = fase.hitos.length;

              return (
                <div
                  key={fase.id}
                  className="rounded-lg border border-border/50 p-2.5 space-y-1.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-medium text-foreground">{fase.nombre}</span>
                    </div>
                    <EstadoBadge estado={fase.estado} />
                  </div>

                  <p className="text-[9px] text-muted-foreground">{fase.descripcion}</p>

                  {/* Hitos */}
                  <div className="space-y-0.5 pl-5">
                    {fase.hitos.map((hito, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        {hito.completado ? (
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={`text-[9px] ${hito.completado ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                          {hito.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mini progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${faseTotal > 0 ? (faseProgress / faseTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground tabular-nums">
                      {faseProgress}/{faseTotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Version tag */}
          <div className="text-center pt-1">
            <Badge variant="outline" className="text-[9px] px-2 py-0.5">
              {typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_VERSION
                ? `v${process.env.NEXT_PUBLIC_APP_VERSION} · DECODEX Bolivia`
                : 'DECODEX Bolivia · ONION200 v0.14.0'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </CollapsibleWidget>
  );
}
