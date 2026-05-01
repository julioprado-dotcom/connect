'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  TrendingUp,
  Radio,
  Loader2,
  Eye,
  AlertCircle,
  Database,
  Zap,
  FileBarChart,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  RefreshCw,
  Tag,
  Settings,
  Activity,
  Globe,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface PersonaStat {
  id: string;
  nombre: string;
  partidoSigla: string;
  camara: string;
  departamento: string;
  mencionesCount: number;
}

interface PartidoStat {
  partido: string;
  count: number;
}

interface MencionRow {
  id: string;
  titulo: string;
  texto: string;
  url: string;
  tipoMencion: string;
  sentimiento: string;
  temas: string;
  fechaCaptura: string;
  enlaceActivo: boolean;
  fechaVerificacion: string | null;
  textoCompleto: string;
  comentariosCount: number;
  comentariosResumen: string;
  persona: { id: string; nombre: string; partidoSigla: string; camara: string };
  medio: { id: string; nombre: string; tipo: string };
}

interface DashboardData {
  totalPersonas: number;
  totalMedios: number;
  mencionesHoy: number;
  mencionesSemana: number;
  totalReportes: number;
  enlacesRotos: number;
  totalComentarios: number;
  totalEjes: number;
  topPersonas: PersonaStat[];
  mencionesPorPartido: PartidoStat[];
  ultimasMenciones: MencionRow[];
  distribucionCamara: { diputados: number; senadores: number };
}

interface PersonaListItem {
  id: string;
  nombre: string;
  camara: string;
  departamento: string;
  partido: string;
  partidoSigla: string;
}

interface MedioItem {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  nivel: string;
  departamento: string | null;
  plataformas: string;
  activo: boolean;
  mencionesCount: number;
}

interface EjeItem {
  id: string;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  descripcion: string;
  keywords: string;
  mencionesCount: number;
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

const SENTIMIENTO_STYLES: Record<string, string> = {
  positivo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  negativo: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  critico: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
  elogioso: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-300',
  no_clasificado: 'bg-stone-50 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
};

const TIPO_MENCION_LABELS: Record<string, string> = {
  cita_directa: 'Cita directa',
  mencion_pasiva: 'Mención pasiva',
  cobertura_declaracion: 'Cob. declaración',
  contexto: 'En contexto',
  foto_video: 'Foto/Video',
};

const NIVEL_LABELS: Record<string, string> = {
  '1': 'Corporativos',
  '2': 'Regionales',
  '3': 'Alternativos',
  '4': 'Redes',
  '5': 'Extendidos',
};

const NIVEL_COLORS: Record<string, string> = {
  '1': 'bg-primary text-primary-foreground',
  '2': 'bg-sky-600 text-white',
  '3': 'bg-amber-600 text-white',
  '4': 'bg-purple-600 text-white',
  '5': 'bg-stone-500 text-white',
};

const CAMARAS = ['Todas', 'Diputados', 'Senado'];
const DEPARTAMENTOS = [
  'Todos', 'La Paz', 'Santa Cruz', 'Cochabamba', 'Potosí', 'Tarija',
  'Oruro', 'Beni', 'Chuquisaca', 'Pando',
];
const PARTIDOS = [
  'Todos', 'PDC', 'LIBRE', 'UNIDAD', 'AP', 'APB SÚMATE', 'MAS IPSP', 'BIA YUQUI',
];

/* ═══════════════════════════════════════════════════════════
   NAV ITEMS
   ═══════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'menciones', label: 'Menciones', icon: Newspaper },
  { id: 'clasificadores', label: 'Clasificadores', icon: Tag },
  { id: 'reportes', label: 'Reportes', icon: FileBarChart },
  { id: 'captura', label: 'Captura', icon: Zap },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  // ─── State ───
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('resumen');

  // Stats
  const [seedLoading, setSeedLoading] = useState(false);

  // Personas
  const [personaList, setPersonaList] = useState<PersonaListItem[]>([]);
  const [personaTotal, setPersonaTotal] = useState(0);
  const [personaPage, setPersonaPage] = useState(1);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [filtroCamara, setFiltroCamara] = useState('Todas');
  const [filtroDepto, setFiltroDepto] = useState('Todos');
  const [filtroPartido, setFiltroPartido] = useState('Todos');
  const [personaSearch, setPersonaSearch] = useState('');

  // Medios
  const [medios, setMedios] = useState<MedioItem[]>([]);
  const [mediosLoading, setMediosLoading] = useState(false);
  const [mediosNivel, setMediosNivel] = useState('todos');

  // Ejes
  const [ejes, setEjes] = useState<EjeItem[]>([]);
  const [ejesLoading, setEjesLoading] = useState(false);

  // Captura
  const [captureCount, setCaptureCount] = useState(5);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<{
    busquedas: number;
    mencionesNuevas: number;
    errores: number;
    detalles: string[];
  } | null>(null);

  // Menciones
  const [menciones, setMenciones] = useState<MencionRow[]>([]);
  const [mencionesTotal, setMencionesTotal] = useState(0);
  const [mencionesPage, setMencionesPage] = useState(1);
  const [mencionesLoading, setMencionesLoading] = useState(false);

  // Reportes
  const [reportes, setReportes] = useState<Record<string, unknown>[]>([]);
  const [reportesLoading, setReportesLoading] = useState(false);
  const [generarReporteLoading, setGenerarReporteLoading] = useState(false);

  // ─── Fetch data ───
  // Track which views have been loaded
  const loadedViews = useRef<Set<string>>(new Set());

  // ─── Load functions ───
  const loadPersonas = useCallback(async () => {
    setPersonaLoading(true);
    try {
      const params = new URLSearchParams({ page: String(personaPage), limit: '20' });
      if (filtroCamara !== 'Todas') params.set('camara', filtroCamara);
      if (filtroDepto !== 'Todos') params.set('departamento', filtroDepto);
      if (filtroPartido !== 'Todos') params.set('partido', filtroPartido);
      if (personaSearch) params.set('search', personaSearch);
      const res = await fetch(`/api/personas?${params}`);
      const json = await res.json();
      setPersonaList(json.personas || []);
      setPersonaTotal(json.total || 0);
    } catch {
      // silent
    } finally {
      setPersonaLoading(false);
    }
  }, [personaPage, filtroCamara, filtroDepto, filtroPartido, personaSearch]);

  const loadMedios = useCallback(async () => {
    setMediosLoading(true);
    try {
      const params = new URLSearchParams();
      if (mediosNivel !== 'todos') params.set('nivel', mediosNivel);
      const res = await fetch(`/api/medios?${params}`);
      const json = await res.json();
      setMedios(json.medios || []);
    } catch {
      // silent
    } finally {
      setMediosLoading(false);
    }
  }, [mediosNivel]);

  const loadEjes = useCallback(async () => {
    setEjesLoading(true);
    try {
      const res = await fetch('/api/ejes');
      const json = await res.json();
      setEjes(json.ejes || []);
    } catch {
      // silent
    } finally {
      setEjesLoading(false);
    }
  }, []);

  const loadMenciones = useCallback(async () => {
    setMencionesLoading(true);
    try {
      const res = await fetch(`/api/menciones?page=${mencionesPage}&limit=15`);
      const json = await res.json();
      setMenciones(json.menciones || []);
      setMencionesTotal(json.total || 0);
    } catch {
      // silent
    } finally {
      setMencionesLoading(false);
    }
  }, [mencionesPage]);

  const loadReportes = useCallback(async () => {
    setReportesLoading(true);
    try {
      const res = await fetch('/api/reportes');
      const json = await res.json();
      setReportes(json.reportes || json || []);
    } catch {
      // silent
    } finally {
      setReportesLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const controller = new AbortController();
    const loadInitial = async () => {
      try {
        const res = await fetch('/api/stats', { signal: controller.signal });
        if (!res.ok) throw new Error('Error al cargar datos');
        const json = await res.json();
        if (!controller.signal.aborted) {
          setData(json);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadInitial();
    return () => controller.abort();
  }, []);

  // ─── Handlers ───
  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        try {
          const statsRes = await fetch('/api/stats');
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            setData(statsJson);
            setError('');
          }
        } catch { /* silent */ }
      }
    } catch {
      setError('Error al ejecutar seed');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleCapture = async () => {
    setCaptureLoading(true);
    setCaptureResult(null);
    setError('');
    try {
      const res = await fetch(`/api/capture?count=${captureCount}`, { method: 'POST' });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        setCaptureResult(json);
        // Refresh stats
        try {
          const statsRes = await fetch('/api/stats');
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            setData(statsJson);
          }
        } catch { /* silent */ }
      }
    } catch {
      setError('Error al ejecutar captura');
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleGenerarReporte = async () => {
    setGenerarReporteLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'semanal' }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else await loadReportes();
    } catch {
      setError('Error al generar reporte');
    } finally {
      setGenerarReporteLoading(false);
    }
  };

  const handleViewChange = (viewId: string) => {
    setActiveView(viewId);
    setSidebarOpen(false);
    // Reset page for mentions when switching to menciones view
    if (viewId === 'menciones') setMencionesPage(1);
    // Load data for the view if not yet loaded
    if (!loadedViews.current.has(viewId)) {
      loadedViews.current.add(viewId);
      if (viewId === 'personas') loadPersonas();
      else if (viewId === 'medios') loadMedios();
      else if (viewId === 'clasificadores') loadEjes();
      else if (viewId === 'menciones') loadMenciones();
      else if (viewId === 'reportes') loadReportes();
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Radio className="h-6 w-6 text-primary-foreground" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const maxPartidoCount = data?.mencionesPorPartido?.[0]?.count || 1;

  return (
    <div className="min-h-screen flex bg-background">
      {/* ═══ MOBILE OVERLAY ═══ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Radio className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
                Monitor de Presencia
              </h2>
              <p className="text-[10px] text-sidebar-foreground/60">en Medios — Bolivia</p>
            </div>
            <button
              className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleViewChange(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-sidebar-border">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <Globe className="h-4 w-4 shrink-0" />
              Vista cliente
            </Link>
            <div className="mt-2 px-3">
              <p className="text-[10px] text-sidebar-foreground/40">
                Pluralismo · Constitución 2009
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-foreground">
                  {NAV_ITEMS.find((n) => n.id === activeView)?.label || 'Resumen'}
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  Legisladores bolivianos — Periodo 2025-2030
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hidden sm:inline">
                  Sistema activo
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto hover:opacity-70">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: RESUMEN
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'resumen' && (
            <div className="space-y-6">
              {/* Seed button if no data */}
              {data && data.totalPersonas === 0 && (
                <div className="flex justify-center">
                  <Button onClick={handleSeed} disabled={seedLoading} className="gap-2">
                    {seedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    Cargar datos de ejemplo
                  </Button>
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <KPICard
                  icon={<Users className="h-5 w-5" />}
                  value={data?.totalPersonas || 0}
                  label="Legisladores"
                  subtext={`${data?.distribucionCamara?.diputados || 0} dip. · ${data?.distribucionCamara?.senadores || 0} sen.`}
                  colorClass="text-primary"
                />
                <KPICard
                  icon={<Newspaper className="h-5 w-5" />}
                  value={data?.mencionesHoy || 0}
                  label="Menciones hoy"
                  subtext={`${data?.mencionesSemana || 0} esta semana`}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <KPICard
                  icon={<Radio className="h-5 w-5" />}
                  value={data?.totalMedios || 0}
                  label="Medios monitoreados"
                  subtext={`${data?.totalEjes || 0} ejes temáticos`}
                  colorClass="text-sky-600 dark:text-sky-400"
                />
                <KPICard
                  icon={<FileText className="h-5 w-5" />}
                  value={data?.totalReportes || 0}
                  label="Reportes generados"
                  subtext={data?.enlacesRotos ? `${data.enlacesRotos} enlaces rotos` : ''}
                  colorClass="text-amber-600 dark:text-amber-400"
                />
              </div>

              {/* Distribution + Top personas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Menciones por partido */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Distribución por partido
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Menciones esta semana por agrupación política
                    </CardDescription>
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
                                className={`h-full rounded-full ${
                                  PARTIDO_COLORS[p.partido] || 'bg-stone-500'
                                }`}
                                style={{
                                  width: `${Math.max((p.count / maxPartidoCount) * 100, 3)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<BarChart3 className="h-8 w-8" />} text="Sin menciones por partido esta semana" />
                    )}
                  </CardContent>
                </Card>

                {/* Top 10 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      Top 10 presencia mediática
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Legisladores más mencionados esta semana
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {data?.topPersonas && data.topPersonas.length > 0 ? (
                      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {data.topPersonas.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
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
                      <EmptyState icon={<Users className="h-8 w-8" />} text="Sin menciones registradas esta semana" />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Últimas menciones */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-muted-foreground" />
                      Últimas menciones capturadas
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveView('menciones')} className="text-xs text-muted-foreground">
                      Ver todas <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
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
                            <TableHead className="text-xs hidden lg:table-cell">Sentimiento</TableHead>
                            <TableHead className="text-xs hidden xl:table-cell">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.ultimasMenciones.slice(0, 8).map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="text-sm font-medium text-foreground max-w-[140px] truncate">{m.persona?.nombre || '—'}</p>
                                  <p className="text-[10px] text-muted-foreground">{m.persona?.partidoSigla}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground">{m.medio?.nombre || '—'}</span>
                              </TableCell>
                              <TableCell className="py-2.5 hidden md:table-cell">
                                <p className="text-xs text-foreground/80 max-w-[200px] truncate">{m.titulo || m.texto?.substring(0, 60) || '—'}</p>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 hidden lg:table-cell">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                                  {m.sentimiento.replace('_', ' ')}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 hidden xl:table-cell text-xs text-muted-foreground">
                                {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState icon={<Newspaper className="h-10 w-10" />} text="Aún no hay menciones registradas" subtext="Usa la sección de Captura para buscar menciones automáticamente" />
                  )}
                </CardContent>
              </Card>

              {/* Fuentes status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Estado de fuentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {['1', '2', '3', '4', '5'].map((n) => (
                      <div key={n} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{NIVEL_LABELS[n]}</p>
                          <p className="text-[10px] text-muted-foreground">Nivel {n}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: MENCIONES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'menciones' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        Registro de menciones
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Total: {mencionesTotal} menciones
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={loadMenciones} className="text-xs gap-1">
                        <RefreshCw className="h-3 w-3" /> Actualizar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {mencionesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : menciones.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs">Legislador</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Cámara</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Partido</TableHead>
                            <TableHead className="text-xs">Medio</TableHead>
                            <TableHead className="text-xs hidden lg:table-cell">Título</TableHead>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Sentimiento</TableHead>
                            <TableHead className="text-xs hidden lg:table-cell">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {menciones.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="py-2.5">
                                <p className="text-sm font-medium text-foreground max-w-[140px] truncate">{m.persona?.nombre || '—'}</p>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{m.persona?.camara || '—'}</TableCell>
                              <TableCell className="py-2.5 hidden md:table-cell">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{m.persona?.partidoSigla || '—'}</Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground">{m.medio?.nombre || '—'}</TableCell>
                              <TableCell className="py-2.5 hidden lg:table-cell">
                                <p className="text-xs text-foreground/80 max-w-[180px] truncate">{m.titulo || m.texto?.substring(0, 50) || '—'}</p>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="text-[10px] text-muted-foreground">{TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}</span>
                              </TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                                  {m.sentimiento.replace('_', ' ')}
                                </span>
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
                    <EmptyState icon={<Newspaper className="h-10 w-10" />} text="No hay menciones registradas" />
                  )}
                  {/* Pagination */}
                  {mencionesTotal > 15 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Página {mencionesPage} de {Math.ceil(mencionesTotal / 15)}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={mencionesPage <= 1} onClick={() => setMencionesPage((p) => p - 1)} className="text-xs">
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={mencionesPage >= Math.ceil(mencionesTotal / 15)} onClick={() => setMencionesPage((p) => p + 1)} className="text-xs">
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: PERSONAS
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'personas' && (
            <div className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="Buscar legislador..."
                      value={personaSearch}
                      onChange={(e) => setPersonaSearch(e.target.value)}
                      className="sm:max-w-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <FilterSelect value={filtroCamara} onChange={setFiltroCamara} options={CAMARAS} />
                      <FilterSelect value={filtroDepto} onChange={setFiltroDepto} options={DEPARTAMENTOS} />
                      <FilterSelect value={filtroPartido} onChange={setFiltroPartido} options={PARTIDOS} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Legisladores registrados
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Total: {personaTotal} personas
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {personaLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : personaList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs">Nombre</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Cámara</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Departamento</TableHead>
                            <TableHead className="text-xs">Partido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {personaList.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="py-2.5">
                                <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{p.camara}</TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">{p.departamento}</TableCell>
                              <TableCell className="py-2.5">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] ${
                                    PARTIDO_COLORS[p.partidoSigla]
                                      ? `${PARTIDO_COLORS[p.partidoSigla]} text-white`
                                      : ''
                                  }`}
                                >
                                  {p.partidoSigla}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState icon={<Users className="h-10 w-10" />} text="No se encontraron legisladores" />
                  )}
                  {/* Pagination */}
                  {personaTotal > 20 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Página {personaPage} de {Math.ceil(personaTotal / 20)}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={personaPage <= 1} onClick={() => setPersonaPage((p) => p - 1)} className="text-xs">
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={personaPage >= Math.ceil(personaTotal / 20)} onClick={() => setPersonaPage((p) => p + 1)} className="text-xs">
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: MEDIOS
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'medios' && (
            <div className="space-y-4">
              {/* Level tabs */}
              <div className="flex flex-wrap gap-2">
                <LevelTab active={mediosNivel === 'todos'} onClick={() => setMediosNivel('todos')} label="Todos" />
                {['1', '2', '3', '4', '5'].map((n) => (
                  <LevelTab key={n} active={mediosNivel === n} onClick={() => setMediosNivel(n)} label={NIVEL_LABELS[n]} nivel={n} />
                ))}
              </div>

              <Card>
                <CardContent className="p-4">
                  {mediosLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : medios.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {medios.map((m) => (
                        <div key={m.id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{m.nombre}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{m.tipo}</p>
                            </div>
                            <Badge variant="secondary" className={`text-[10px] shrink-0 ${NIVEL_COLORS[m.nivel]}`}>
                              N{m.nivel}
                            </Badge>
                          </div>
                          {m.departamento && (
                            <p className="text-[11px] text-muted-foreground mt-1">{m.departamento}</p>
                          )}
                          {m.plataformas && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{m.plataformas}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{m.mencionesCount} menciones</span>
                            {m.url && (
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                                Visitar <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={<Radio className="h-10 w-10" />} text="No hay medios registrados" />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: CLASIFICADORES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'clasificadores' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Ejes temáticos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {ejes.length} clasificadores activos para análisis de menciones
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {ejesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : ejes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ejes.map((eje) => (
                        <div key={eje.id} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {eje.color && (
                                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eje.color }} />
                                )}
                                <p className="text-sm font-semibold text-foreground truncate">{eje.nombre}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{eje.descripcion || eje.slug}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0 bg-primary/10 text-primary">
                              {eje.mencionesCount}
                            </Badge>
                          </div>
                          {eje.keywords && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {eje.keywords.split(',').slice(0, 4).map((kw, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {kw.trim()}
                                </span>
                              ))}
                              {eje.keywords.split(',').length > 4 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  +{eje.keywords.split(',').length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={<Tag className="h-10 w-10" />} text="No hay clasificadores registrados" />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: REPORTES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'reportes' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileBarChart className="h-4 w-4 text-muted-foreground" />
                        Reportes generados
                      </CardTitle>
                    </div>
                    <Button onClick={handleGenerarReporte} disabled={generarReporteLoading} size="sm" className="gap-2 text-xs">
                      {generarReporteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      Generar reporte semanal
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {reportesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : reportes.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {reportes.map((r: Record<string, unknown>, i: number) => (
                        <div key={String(r.id || i)} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize">
                              {(r.tipo as string)?.replace(/_/g, ' ') || 'Reporte'}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {r.totalMenciones ? `${r.totalMenciones} menciones · ` : ''}
                              {r.fechaCreacion ? new Date(r.fechaCreacion as string).toLocaleDateString('es-BO') : ''}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {String(r.totalMenciones || 0)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={<FileBarChart className="h-10 w-10" />} text="No hay reportes generados" subtext="Genera tu primer reporte semanal" />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: CAPTURA
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'captura' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    Captura de menciones
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Busca menciones de legisladores en medios bolivianos automáticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Cantidad de búsquedas</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={captureCount}
                        onChange={(e) => setCaptureCount(parseInt(e.target.value) || 5)}
                        className="w-32"
                      />
                    </div>
                    <Button onClick={handleCapture} disabled={captureLoading} className="gap-2">
                      {captureLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Ejecutar captura
                    </Button>
                  </div>

                  {captureResult && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                      <p className="text-sm font-semibold text-foreground">Resultado de la captura</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">{captureResult.busquedas}</p>
                          <p className="text-[11px] text-muted-foreground">Búsquedas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-emerald-600">{captureResult.mencionesNuevas}</p>
                          <p className="text-[11px] text-muted-foreground">Nuevas</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-red-600">{captureResult.errores}</p>
                          <p className="text-[11px] text-muted-foreground">Errores</p>
                        </div>
                      </div>
                      {captureResult.detalles && captureResult.detalles.length > 0 && (
                        <div className="max-h-40 overflow-y-auto custom-scrollbar">
                          {captureResult.detalles.map((d, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground py-0.5">{d}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground">
                    <p className="font-medium mb-1">Fuentes disponibles:</p>
                    <p>La Razón, Página Siete, El Deber, Los Tiempos, Opinión, Correo del Sur, El Potosí, La Patria, El Diario, Jornada, Unitel, Red Uno, ATB Digital, Bolivia Verifica, ABI</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: CONFIGURACIÓN
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'configuracion' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Configuración del sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Marco filosófico</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Este sistema opera bajo los principios de pluralismo político y libertad de expresión
                      consagrados en la Constitución Política del Estado Plurinacional de Bolivia (2009).
                      No emitimos juicios de valor sobre las opiniones de legisladores ni partidos.
                      Nuestro objetivo es proporcionar datos objetivos sobre la presencia mediática.
                    </p>
                  </div>

                  <Separator />

                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Datos del sistema</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <StatItem label="Legisladores" value={String(data?.totalPersonas || 0)} />
                      <StatItem label="Medios" value={String(data?.totalMedios || 0)} />
                      <StatItem label="Ejes temáticos" value={String(data?.totalEjes || 0)} />
                      <StatItem label="Reportes" value={String(data?.totalReportes || 0)} />
                    </div>
                  </div>

                  <Separator />

                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Acciones de administración</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleSeed} disabled={seedLoading} className="text-xs gap-1">
                        {seedLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                        Cargar datos de ejemplo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function KPICard({
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

function EmptyState({ icon, text, subtext }: { icon: React.ReactNode; text: string; subtext?: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-muted-foreground">
      <div className="opacity-40">{icon}</div>
      <p className="text-sm mt-2">{text}</p>
      {subtext && <p className="text-xs mt-1 text-muted-foreground/60">{subtext}</p>}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function LevelTab({
  active,
  onClick,
  label,
  nivel,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  nivel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium transition-colors
        ${active
          ? nivel ? NIVEL_COLORS[nivel] : 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }
      `}
    >
      {label}
    </button>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-background">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
