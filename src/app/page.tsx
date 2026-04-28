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
} from 'lucide-react';

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
  positivo: 'bg-emerald-100 text-emerald-800',
  negativo: 'bg-red-100 text-red-800',
  neutral: 'bg-stone-100 text-stone-700',
  critico: 'bg-red-200 text-red-900',
  elogioso: 'bg-green-200 text-green-900',
  no_clasificado: 'bg-stone-50 text-stone-500',
};

const TIPO_MENCION_LABELS: Record<string, string> = {
  cita_directa: 'Cita directa',
  mencion_pasiva: 'Mención pasiva',
  cobertura_declaracion: 'Cobertura declaración',
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

  /* ─── loading skeleton ─── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-stone-500" />
          <p className="text-stone-500 text-lg font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const maxPartidoCount = data?.mencionesPorPartido?.[0]?.count || 1;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* ─── Header ─── */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-stone-900 flex items-center justify-center">
                <Radio className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-stone-900">
                  Monitor de Presencia en Medios
                </h1>
                <p className="text-xs text-stone-500">
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
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-stone-200">
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
          </TabsList>

          {/* ═══ TAB RESUMEN ═══ */}
          <TabsContent value="resumen" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-900">
                        {data?.totalPersonas || 0}
                      </p>
                      <p className="text-xs text-stone-500">Personas monitoreadas</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 text-[10px] text-stone-400">
                    <span>{data?.distribucionCamara?.diputados || 0} Dip.</span>
                    <span>·</span>
                    <span>{data?.distribucionCamara?.senadores || 0} Sen.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center">
                      <Newspaper className="h-5 w-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-900">
                        {data?.mencionesSemana || 0}
                      </p>
                      <p className="text-xs text-stone-500">Menciones esta semana</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-900">
                        {data?.totalReportes || 0}
                      </p>
                      <p className="text-xs text-stone-500">Reportes generados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center">
                      <Radio className="h-5 w-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-stone-900">
                        {data?.totalMedios || 0}
                      </p>
                      <p className="text-xs text-stone-500">Medios monitoreados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Personas */}
              <Card className="border-stone-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-stone-500" />
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
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-600 shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">
                              {p.nombre}
                            </p>
                            <p className="text-[11px] text-stone-400">
                              {p.camara} · {p.partidoSigla}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-stone-900 text-white text-xs shrink-0"
                          >
                            {p.mencionesCount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-stone-400 text-sm">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Sin menciones registradas esta semana
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gráfico por Partido (CSS bars) */}
              <Card className="border-stone-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-stone-500" />
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
                            <span className="text-sm font-medium text-stone-700">
                              {p.partido}
                            </span>
                            <span className="text-sm font-bold text-stone-900">
                              {p.count}
                            </span>
                          </div>
                          <div className="h-6 bg-stone-100 rounded overflow-hidden">
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
                    <div className="text-center py-8 text-stone-400 text-sm">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Sin datos de menciones por partido
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Últimas Menciones */}
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-stone-500" />
                  Últimas menciones registradas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {data?.ultimasMenciones && data.ultimasMenciones.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs text-stone-500">Legislador</TableHead>
                          <TableHead className="text-xs text-stone-500">Medio</TableHead>
                          <TableHead className="text-xs text-stone-500 hidden md:table-cell">
                            Título
                          </TableHead>
                          <TableHead className="text-xs text-stone-500">Tipo</TableHead>
                          <TableHead className="text-xs text-stone-500 hidden sm:table-cell">
                            Sentimiento
                          </TableHead>
                          <TableHead className="text-xs text-stone-500 hidden lg:table-cell">
                            Fecha
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ultimasMenciones.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="py-2.5">
                              <div>
                                <p className="text-sm font-medium text-stone-900 max-w-[160px] truncate">
                                  {m.persona?.nombre || '—'}
                                </p>
                                <p className="text-[11px] text-stone-400">
                                  {m.persona?.partidoSigla}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-sm text-stone-600">{m.medio?.nombre || '—'}</span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden md:table-cell">
                              <p className="text-sm text-stone-600 max-w-[220px] truncate">
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
                            <TableCell className="py-2.5 hidden lg:table-cell text-xs text-stone-400">
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
                  <div className="text-center py-12 text-stone-400">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Aún no hay menciones registradas</p>
                    <p className="text-xs mt-1">
                      Usa la pestaña de búsqueda para buscar menciones en medios
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB BÚSQUEDA ═══ */}
          <TabsContent value="busqueda" className="space-y-6">
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4 text-stone-500" />
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
                    className="bg-stone-900 hover:bg-stone-800 text-white"
                  >
                    {searchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="text-[11px] text-stone-400">
                  Fuentes: La Razón, Página Siete, El Deber, Los Tiempos, Opinión, Correo del Sur,
                  El Potosí, La Patria, El Diario, Jornada, Unitel, Red Uno, ATB Digital, Bolivia
                  Verifica, ABI
                </div>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <Card className="border-stone-200">
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
                        className="p-3 rounded-lg border border-stone-100 hover:border-stone-300 transition-colors"
                      >
                        <a
                          href={result.url || result.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <p className="text-sm font-medium text-stone-900 hover:text-stone-700 line-clamp-2">
                            {result.title || result.titulo || 'Sin título'}
                          </p>
                          <p className="text-[11px] text-stone-400 mt-1 line-clamp-1">
                            {result.snippet || result.description || ''}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-stone-400">
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
            <Card className="border-stone-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-stone-500" />
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
                          <TableHead className="text-xs text-stone-500">Legislador</TableHead>
                          <TableHead className="text-xs text-stone-500">Cámara</TableHead>
                          <TableHead className="text-xs text-stone-500">Partido</TableHead>
                          <TableHead className="text-xs text-stone-500">Medio</TableHead>
                          <TableHead className="text-xs text-stone-500 hidden md:table-cell">
                            Título
                          </TableHead>
                          <TableHead className="text-xs text-stone-500">Tipo</TableHead>
                          <TableHead className="text-xs text-stone-500">Sentimiento</TableHead>
                          <TableHead className="text-xs text-stone-500 hidden lg:table-cell">
                            Fecha
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ultimasMenciones.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium text-stone-900 max-w-[160px] truncate">
                                {m.persona?.nombre || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-stone-600">
                              {m.persona?.camara || '—'}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                                {m.persona?.partidoSigla || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-stone-600">
                              {m.medio?.nombre || '—'}
                            </TableCell>
                            <TableCell className="py-2.5 hidden md:table-cell">
                              <p className="text-sm text-stone-600 max-w-[200px] truncate">
                                {m.titulo || m.texto?.substring(0, 60) || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-[10px] text-stone-600">
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
                            <TableCell className="py-2.5 hidden lg:table-cell text-xs text-stone-400">
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
                  <div className="text-center py-12 text-stone-400">
                    <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay menciones registradas aún</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-stone-400">
              Monitor de Presencia en Medios · Asamblea Legislativa Plurinacional de Bolivia ·
              Periodo 2025-2030
            </p>
            <p className="text-xs text-stone-400">
              {data?.totalPersonas || 0} legisladores · {data?.totalMedios || 0} medios
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
