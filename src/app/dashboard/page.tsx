'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Users,
  Newspaper,
  FileText,
  Radio,
  Loader2,
  TrendingUp,
  Shield,
  ArrowLeft,
  FileBarChart,
  Eye,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface MencionRow {
  id: string;
  titulo: string;
  texto: string;
  tipoMencion: string;
  sentimiento: string;
  fechaCaptura: string;
  persona: { nombre: string; partidoSigla: string; camara: string };
  medio: { nombre: string };
}

interface PartidoStat {
  partido: string;
  count: number;
}

interface PersonaStat {
  id: string;
  nombre: string;
  partidoSigla: string;
  camara: string;
  mencionesCount: number;
}

interface ReporteRow {
  id: string;
  tipo: string;
  totalMenciones: number;
  fechaCreacion: string;
}

interface ClientData {
  totalPersonas: number;
  totalMedios: number;
  mencionesSemana: number;
  totalEjes: number;
  topPersonas: PersonaStat[];
  mencionesPorPartido: PartidoStat[];
  ultimasMenciones: MencionRow[];
  distribucionCamara: { diputados: number; senadores: number };
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const PARTIDO_COLORS: Record<string, string> = {
  PDC: 'bg-red-600',
  LIBRE: 'bg-emerald-600',
  UNIDAD: 'bg-sky-700',
  AP: 'bg-amber-600',
  'APB SÚMATE': 'bg-purple-600',
  'APB SUMATE': 'bg-purple-600',
  'MAS IPSP': 'bg-orange-500',
  'BIA YUQUI': 'bg-teal-600',
};

const PARTIDO_TEXT_COLORS: Record<string, string> = {
  PDC: 'text-red-600',
  LIBRE: 'text-emerald-600',
  UNIDAD: 'text-sky-700',
  AP: 'text-amber-600',
  'APB SÚMATE': 'text-purple-600',
  'APB SUMATE': 'text-purple-600',
  'MAS IPSP': 'text-orange-500',
  'BIA YUQUI': 'text-teal-600',
};

const TIPO_MENCION_LABELS: Record<string, string> = {
  cita_directa: 'Cita directa',
  mencion_pasiva: 'Mención pasiva',
  cobertura_declaracion: 'Cob. declaración',
  contexto: 'En contexto',
  foto_video: 'Foto/Video',
};

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DashboardCliente() {
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Error al cargar datos');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const fetchReportes = async () => {
      try {
        const res = await fetch('/api/reportes');
        const json = await res.json();
        setReportes(json.reportes || json || []);
      } catch {
        // silent
      }
    };
    fetchReportes();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Radio className="h-6 w-6 text-primary-foreground" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  const maxPartidoCount = data?.mencionesPorPartido?.[0]?.count || 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Radio className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-foreground">
                  Monitor de Presencia en Medios
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Inteligencia mediática — Legisladores bolivianos 2025-2030
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ArrowLeft className="h-3 w-3" />
                  Admin
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ClientKPICard
            icon={<Newspaper className="h-5 w-5" />}
            value={data?.mencionesSemana || 0}
            label="Menciones esta semana"
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <ClientKPICard
            icon={<TrendingUp className="h-5 w-5" />}
            value={data?.topPersonas?.[0]?.mencionesCount || 0}
            label="Mayor presencia"
            subtext={data?.topPersonas?.[0]?.nombre?.split(' ').slice(-1).join(' ') || ''}
            colorClass="text-primary"
          />
          <ClientKPICard
            icon={<Users className="h-5 w-5" />}
            value={data?.totalPersonas || 0}
            label="Legisladores monitoreados"
            subtext={`${data?.distribucionCamara?.diputados || 0} dip. · ${data?.distribucionCamara?.senadores || 0} sen.`}
            colorClass="text-sky-600 dark:text-sky-400"
          />
          <ClientKPICard
            icon={<Radio className="h-5 w-5" />}
            value={data?.totalMedios || 0}
            label="Fuentes monitoreadas"
            colorClass="text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Ranking presencia */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Ranking de presencia mediática
              </CardTitle>
              <CardDescription className="text-xs">Top 10 esta semana</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.topPersonas && data.topPersonas.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.topPersonas.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        i === 1 ? 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' :
                        i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">{p.camara} · {p.partidoSigla}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{p.mencionesCount}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin datos disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distribución por partido */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Distribución por partido
              </CardTitle>
              <CardDescription className="text-xs">Menciones esta semana</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.mencionesPorPartido && data.mencionesPorPartido.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.mencionesPorPartido.map((p) => (
                    <div key={p.partido}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${PARTIDO_TEXT_COLORS[p.partido] || 'text-foreground'}`}>
                          {p.partido}
                        </span>
                        <span className="text-xs font-bold text-foreground">{p.count}</span>
                      </div>
                      <div className="h-5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${PARTIDO_COLORS[p.partido] || 'bg-stone-500'}`}
                          style={{ width: `${Math.max((p.count / maxPartidoCount) * 100, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin datos disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Últimas menciones */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Últimas menciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {data?.ultimasMenciones && data.ultimasMenciones.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Legislador</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Medio</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Título</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ultimasMenciones.slice(0, 10).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="py-2.5">
                          <div>
                            <p className="text-sm font-medium text-foreground max-w-[140px] truncate">{m.persona?.nombre || '—'}</p>
                            <p className="text-[10px] text-muted-foreground">{m.persona?.partidoSigla}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                          {m.medio?.nombre || '—'}
                        </TableCell>
                        <TableCell className="py-2.5 hidden md:table-cell">
                          <p className="text-xs text-foreground/80 max-w-[200px] truncate">{m.titulo || m.texto?.substring(0, 60) || '—'}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[10px] text-muted-foreground">{TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aún no hay menciones registradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boletines y reportes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileBarChart className="h-4 w-4 text-muted-foreground" />
              Boletines y reportes
            </CardTitle>
            <CardDescription className="text-xs">Reportes generados por el sistema</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {reportes.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {reportes.slice(0, 5).map((r, i) => (
                  <div key={String(r.id || i)} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground capitalize">
                        {(r.tipo as string)?.replace(/_/g, ' ') || 'Reporte'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.totalMenciones ? `${r.totalMenciones} menciones · ` : ''}
                        {r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileBarChart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aún no hay reportes disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer disclaimer */}
        <footer className="mt-8 pb-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Nota sobre el marco filosófico</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Este sistema opera bajo los principios de pluralismo político y libertad de expresión
                consagrados en la Constitución Política del Estado Plurinacional de Bolivia (2009).
                Los datos presentados son informativos y no constituyen juicio de valor sobre las opiniones
                de legisladores, partidos políticos ni medios de comunicación.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function ClientKPICard({
  icon,
  value,
  label,
  subtext,
  colorClass,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  subtext?: string;
  colorClass?: string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${colorClass || 'text-muted-foreground'}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
        {subtext && (
          <p className="mt-2 text-[10px] text-muted-foreground/70 truncate">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
