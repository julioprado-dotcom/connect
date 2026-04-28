'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  Search,
  TrendingUp,
  Radio,
  Loader2,
  Eye,
  AlertCircle,
  Database,
  ArrowUpRight,
  Zap,
  FileBarChart,
  Brain,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

/* ─── types ─── */
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
  persona: { id: string; nombre: string; partidoSigla: string; camara: string };
  medio: { id: string; nombre: string; tipo: string };
}

interface DashboardData {
  totalPersonas: number;
  totalMedios: number;
  mencionesSemana: number;
  totalReportes: number;
  topPersonas: PersonaStat[];
  mencionesPorPartido: PartidoStat[];
  ultimasMenciones: MencionRow[];
  distribucionCamara: { diputados: number; senadores: number };
}

interface CaptureResult {
  busquedas: number;
  mencionesNuevas: number;
  errores: number;
  detalles: string[];
}

interface ReporteRow {
  id: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  resumen: string;
  totalMenciones: number;
  sentimientoPromedio: number;
  temasPrincipales: string;
  fechaCreacion: string;
  persona?: { nombre: string } | null;
}

/* ─── constants ─── */
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

/* ─── component ─── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('resumen');

  // Capture state
  const [captureCount, setCaptureCount] = useState(5);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [captureMenciones, setCaptureMenciones] = useState<MencionRow[]>([]);

  // Analyze state
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ analizadas: number } | null>(null);

  // Reportes state
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [reporteLoading, setReporteLoading] = useState(false);
  const [generarReporteLoading, setGenerarReporteLoading] = useState(false);
  const [selectedReporte, setSelectedReporte] = useState<ReporteRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Error al cargar datos');
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Error al cargar datos');
      const json = await res.json();
      setData(json);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        await refreshData();
      }
    } catch {
      setError('Error al ejecutar seed');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaNombre: searchTerm }),
      });
      const json = await res.json();
      setSearchResults(json?.results || json || []);
    } catch {
      setError('Error en la búsqueda');
    } finally {
      setSearchLoading(false);
    }
  };

  // Capture handler
  const handleCapture = async () => {
    setCaptureLoading(true);
    setCaptureResult(null);
    setCaptureMenciones([]);
    setAnalyzeResult(null);
    setError('');
    try {
      const res = await fetch(`/api/capture?count=${captureCount}`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setCaptureResult(json);
        // Fetch latest menciones
        const mencionesRes = await fetch('/api/menciones?limit=20');
        const mencionesJson = await mencionesRes.json();
        setCaptureMenciones(mencionesJson.menciones || []);
        await refreshData();
      }
    } catch {
      setError('Error al ejecutar captura');
    } finally {
      setCaptureLoading(false);
    }
  };

  // Analyze handler
  const handleAnalyze = async () => {
    setAnalyzeLoading(true);
    setAnalyzeResult(null);
    setError('');
    try {
      const res = await fetch('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setAnalyzeResult(json);
        await refreshData();
        // Refresh captured menciones
        const mencionesRes = await fetch('/api/menciones?limit=20');
        const mencionesJson = await mencionesRes.json();
        setCaptureMenciones(mencionesJson.menciones || []);
      }
    } catch {
      setError('Error al analizar menciones');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Load reportes
  const loadReportes = useCallback(async () => {
    setReporteLoading(true);
    try {
      const res = await fetch('/api/reportes');
      const json = await res.json();
      setReportes(json.reportes || json || []);
    } catch {
      // silently fail
    } finally {
      setReporteLoading(false);
    }
  }, []);

  // Generate reporte
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
      if (json.error) {
        setError(json.error);
      } else {
        await loadReportes();
        await refreshData();
        if (json.reporte) {
          setSelectedReporte(json.reporte);
        }
      }
    } catch {
      setError('Error al generar reporte');
    } finally {
      setGenerarReporteLoading(false);
    }
  };

  // Load reportes when switching to reportes tab (via tab change handler)
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (value === 'reportes' && reportes.length === 0) {
      loadReportes();
    }
  }, [reportes.length, loadReportes]);

  /* ─── loading skeleton ─── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-lg font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const maxPartidoCount = data?.mencionesPorPartido?.[0]?.count || 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── Header ─── */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-foreground flex items-center justify-center">
                <Radio className="h-5 w-5 text-background" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Monitor de Presencia en Medios
                </h1>
                <p className="text-xs text-muted-foreground">
                  Legisladores bolivianos — Periodo 2025-2030
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data && data.totalPersonas === 0 && (
                <Button
                  onClick={handleSeed}
                  disabled={seedLoading}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  {seedLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Database className="h-3 w-3 mr-1" />
                  )}
                  Cargar datos
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="resumen" className="text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 mr-1.5 hidden sm:block" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="busqueda" className="text-xs sm:text-sm">
              <Search className="h-4 w-4 mr-1.5 hidden sm:block" />
              Búsqueda
            </TabsTrigger>
            <TabsTrigger value="menciones" className="text-xs sm:text-sm">
              <Newspaper className="h-4 w-4 mr-1.5 hidden sm:block" />
              Menciones
            </TabsTrigger>
            <TabsTrigger value="captura" className="text-xs sm:text-sm">
              <Zap className="h-4 w-4 mr-1.5 hidden sm:block" />
              Captura
            </TabsTrigger>
            <TabsTrigger value="reportes" className="text-xs sm:text-sm">
              <FileBarChart className="h-4 w-4 mr-1.5 hidden sm:block" />
              Reportes
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB RESUMEN ═══ */}
          <TabsContent value="resumen" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {data?.totalPersonas || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Personas monitoreadas</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground/70">
                    <span>{data?.distribucionCamara?.diputados || 0} Dip.</span>
                    <span>·</span>
                    <span>{data?.distribucionCamara?.senadores || 0} Sen.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Newspaper className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {data?.mencionesSemana || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Menciones esta semana</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {data?.totalReportes || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Reportes generados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Radio className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {data?.totalMedios || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Medios monitoreados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Personas */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Top 10 con más menciones
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Legisladores más mencionados esta semana
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {data?.topPersonas && data.topPersonas.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {data.topPersonas.map((p, i) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {p.nombre}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.camara} · {p.partidoSigla}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-foreground text-background text-xs shrink-0"
                          >
                            {p.mencionesCount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Sin menciones registradas esta semana
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico por Partido (CSS bars) */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Menciones por partido
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribución semanal por agrupación política
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {data?.mencionesPorPartido && data.mencionesPorPartido.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {data.mencionesPorPartido.map((p) => (
                        <div key={p.partido}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {p.partido}
                            </span>
                            <span className="text-sm font-bold text-foreground">
                              {p.count}
                            </span>
                          </div>
                          <div className="h-6 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full rounded transition-all duration-500 ${
                                PARTIDO_COLORS[p.partido] || 'bg-stone-600'
                              }`}
                              style={{
                                width: `${Math.max((p.count / maxPartidoCount) * 100, 4)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Sin datos de menciones por partido
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Últimas Menciones */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  Últimas menciones registradas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {data?.ultimasMenciones && data.ultimasMenciones.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground">Legislador</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Medio</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden md:table-cell">
                            Título
                          </TableHead>
                          <TableHead className="text-xs text-muted-foreground">Tipo</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden sm:table-cell">
                            Sentimiento
                          </TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden lg:table-cell">
                            Fecha
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ultimasMenciones.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="py-2.5">
                              <div>
                                <p className="text-sm font-medium text-foreground max-w-[160px] truncate">
                                  {m.persona?.nombre || '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {m.persona?.partidoSigla}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-sm text-muted-foreground">{m.medio?.nombre || '—'}</span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden md:table-cell">
                              <p className="text-sm text-foreground/80 max-w-[220px] truncate">
                                {m.titulo || m.texto?.substring(0, 80) || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                                {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 hidden sm:table-cell">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado
                                }`}
                              >
                                {m.sentimiento.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                              {m.fechaCaptura
                                ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Aún no hay menciones registradas</p>
                    <p className="text-xs mt-1">
                      Usa la pestaña de Captura para buscar menciones automáticamente
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB BÚSQUEDA ═══ */}
          <TabsContent value="busqueda" className="space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Buscar en medios bolivianos
                </CardTitle>
                <CardDescription className="text-xs">
                  Busca menciones de legisladores en periódicos, portales y agencias de Bolivia
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del legislador, ej: María Elena Vildozo"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searchLoading || !searchTerm.trim()}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    {searchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Fuentes: La Razón, Página Siete, El Deber, Los Tiempos, Opinión, Correo del Sur,
                  El Potosí, La Patria, El Diario, Jornada, Unitel, Red Uno, ATB Digital, Bolivia
                  Verifica, ABI
                </div>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Resultados de búsqueda ({searchResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(searchResults as Array<Record<string, string>>).map((result, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors"
                      >
                        <a
                          href={result.url || result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <p className="text-sm font-medium text-foreground hover:text-foreground/70 line-clamp-2">
                            {result.title || result.titulo || 'Sin título'}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                            {result.snippet || result.description || ''}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                            <ArrowUpRight className="h-3 w-3" />
                            {(result.url || result.link || '').replace(/https?:\/\//, '').substring(0, 50)}
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ TAB MENCIONES ═══ */}
          <TabsContent value="menciones" className="space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Todas las menciones
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro completo de apariciones en medios
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {data?.ultimasMenciones && data.ultimasMenciones.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground">Legislador</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Cámara</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Partido</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Medio</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden md:table-cell">
                            Título
                          </TableHead>
                          <TableHead className="text-xs text-muted-foreground">Tipo</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Sentimiento</TableHead>
                          <TableHead className="text-xs text-muted-foreground hidden lg:table-cell">
                            Fecha
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ultimasMenciones.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium text-foreground max-w-[160px] truncate">
                                {m.persona?.nombre || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">
                              {m.persona?.camara || '—'}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                                {m.persona?.partidoSigla || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">
                              {m.medio?.nombre || '—'}
                            </TableCell>
                            <TableCell className="py-2.5 hidden md:table-cell">
                              <p className="text-sm text-foreground/80 max-w-[200px] truncate">
                                {m.titulo || m.texto?.substring(0, 60) || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-[10px] text-muted-foreground">
                                {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado
                                }`}
                              >
                                {m.sentimiento.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                              {m.fechaCaptura
                                ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay menciones registradas aún</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB CAPTURA ═══ */}
          <TabsContent value="captura" className="space-y-6">
            {/* Captura Card */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Captura automática
                </CardTitle>
                <CardDescription className="text-xs">
                  Busca menciones de legisladores en medios bolivianos y las registra automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Cantidad:
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={captureCount}
                      onChange={(e) => setCaptureCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-20"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      personas (1-20)
                    </span>
                  </div>
                  <Button
                    onClick={handleCapture}
                    disabled={captureLoading}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    {captureLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Capturando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Ejecutar captura
                      </>
                    )}
                  </Button>
                </div>

                {captureLoading && (
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Buscando en medios...</p>
                        <p className="text-xs text-muted-foreground">
                          Esto puede tomar unos momentos. Se están consultando {captureCount} legisladores.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {captureResult && (
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        Captura completada
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{captureResult.busquedas}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500">Búsquedas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{captureResult.mencionesNuevas}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500">Menciones nuevas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{captureResult.errores}</p>
                        <p className="text-[11px] text-red-500 dark:text-red-400">Errores</p>
                      </div>
                    </div>
                    {captureResult.detalles && captureResult.detalles.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {captureResult.detalles.slice(0, 5).map((d, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground">{d}</p>
                        ))}
                        {captureResult.detalles.length > 5 && (
                          <p className="text-[11px] text-muted-foreground">
                            ... y {captureResult.detalles.length - 5} más
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analyze Button */}
            {captureMenciones.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    Análisis con IA
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clasifica las menciones capturadas por tipo, sentimiento y temas
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzeLoading}
                    variant="outline"
                  >
                    {analyzeLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Analizar con IA
                      </>
                    )}
                  </Button>

                  {analyzeResult && (
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          {analyzeResult.analizadas} menciones analizadas correctamente
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Captured Menciones List */}
                  {captureMenciones.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Menciones más recientes
                      </p>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {captureMenciones.slice(0, 15).map((m) => (
                          <div
                            key={m.id}
                            className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {m.titulo || m.texto?.substring(0, 80) || 'Sin título'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {m.persona?.nombre || '—'} · {m.medio?.nombre || '—'}
                                </p>
                                {m.temas && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {m.temas.split(',').map((t, i) => (
                                      <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {t.trim()}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                    SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado
                                  }`}
                                >
                                  {m.sentimiento.replace('_', ' ')}
                                </span>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ TAB REPORTES ═══ */}
          <TabsContent value="reportes" className="space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-muted-foreground" />
                  Reportes
                </CardTitle>
                <CardDescription className="text-xs">
                  Genera reportes semanales y mensuales de presencia mediática
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerarReporte}
                    disabled={generarReporteLoading}
                    className="bg-foreground hover:bg-foreground/90 text-background"
                  >
                    {generarReporteLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <FileBarChart className="h-4 w-4 mr-2" />
                        Generar reporte semanal
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={loadReportes}
                    disabled={reporteLoading}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Actualizar
                  </Button>
                </div>

                {reportes.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {reportes.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer ${
                          selectedReporte?.id === r.id ? 'ring-2 ring-foreground/20' : ''
                        }`}
                        onClick={() => setSelectedReporte(r)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {r.persona?.nombre
                                ? `Reporte: ${r.persona.nombre}`
                                : `Reporte global ${r.tipo}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {r.totalMenciones} menciones · Sentimiento promedio: {r.sentimientoPromedio.toFixed(1)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(r.fechaCreacion).toLocaleDateString('es-BO', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0">
                            {r.tipo}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay reportes generados aún</p>
                    <p className="text-xs mt-1">
                      Haz clic en &quot;Generar reporte semanal&quot; para crear el primero
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reporte Preview */}
            {selectedReporte && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Vista previa del reporte
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          {selectedReporte.persona?.nombre
                            ? `Reporte de ${selectedReporte.persona.nombre}`
                            : 'Reporte Global de Presencia Mediática'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Período: {new Date(selectedReporte.fechaInicio).toLocaleDateString('es-BO', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })} — {new Date(selectedReporte.fechaFin).toLocaleDateString('es-BO', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-lg font-bold text-foreground">{selectedReporte.totalMenciones}</p>
                          <p className="text-[11px] text-muted-foreground">Total menciones</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-lg font-bold text-foreground">{selectedReporte.sentimientoPromedio.toFixed(1)}</p>
                          <p className="text-[11px] text-muted-foreground">Sentimiento promedio</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <Badge variant="secondary" className="text-xs">
                            {selectedReporte.tipo}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground mt-1">Tipo de reporte</p>
                        </div>
                      </div>

                      {selectedReporte.temasPrincipales && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">Temas principales</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedReporte.temasPrincipales.split(',').map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {t.trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedReporte.resumen && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-1">Resumen</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {selectedReporte.resumen}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Monitor de Presencia en Medios · Asamblea Legislativa Plurinacional de Bolivia ·
              Periodo 2025-2030
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.totalPersonas || 0} legisladores · {data?.totalMedios || 0} medios
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
