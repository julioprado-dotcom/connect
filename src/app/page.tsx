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
  UserCircle,
  FileCheck,
  Bell,
  Mail,
  Rocket,
  Target,
  Thermometer,
  Scale,
  Search,
  UserCheck,
  GraduationCap,
  Link2,
  ListChecks,
  Package,
  ArrowRight,
  AlertTriangle,
  Shield,
  Clock,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { PRODUCTOS, COMBOS } from '@/constants/products';
import {
  PARTIDO_COLORS, PARTIDO_TEXT_COLORS, SENTIMIENTO_STYLES,
  TIPO_MENCION_LABELS, NIVEL_LABELS, NIVEL_COLORS,
  CAMARAS, DEPARTAMENTOS, PARTIDOS,
} from '@/constants/ui';
import { NAV_ITEMS, ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import { ESTRATEGIA_SECCIONES } from '@/constants/strategy';
import Image from 'next/image';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface ActorStat {
  id: string;
  nombre: string;
  partidoSigla: string;
  camara: string;
  departamento: string;
  mencionesCount: number;
  sentimiento: {
    dominante: string;
    distribucion: Record<string, number>;
  };
  ejesTematicos: Array<{
    nombre: string;
    slug: string;
    color: string;
    count: number;
  }>;
  temasEspecificos: Array<{
    tema: string;
    count: number;
  }>;
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
  topActores: ActorStat[];
  mencionesPorPartido: PartidoStat[];
  ultimasMenciones: MencionRow[];
  distribucionCamara: { diputados: number; senadores: number };
  clientesActivos: number;
  contratosVigentes: number;
  entregasHoy: number;
  fuentesPorNivel: {
    nivel: string;
    mediosCount: number;
    ultimaCaptura: string | null;
    ultimaExitosa: boolean;
    ultimoTotalArticulos: number;
    ultimoMencionesEncontradas: number;
    capturasHoy: number;
  }[];
  mediosPorNivel: { nivel: string; total: number; activos: number }[];
  alertas: {
    negativasHoy: number;
    positivasHoy: number;
    neutrasHoy: number;
    ultimaAlerta: { id: string; fechaCreacion: string; resumen: string; sentimientoComentarios: string } | null;
  };
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
   CONSTANTS — imported from @/constants/*
   ═══════════════════════════════════════════════════════════ */

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
  const [mediosHealth, setMediosHealth] = useState<{
    resumen: { total: number; sanos: number; degradados: number; muertos: number; conErrores: number; porcentajeSalud: number };
    porNivel: Array<{ nivel: number; label: string; total: number; sanos: number; problematicos: number }>;
    medios: Array<{ id: string; nombre: string; url: string; tipo: string; nivel: string; nivelLabel: string; totalMenciones: number; menciones7dias: number; menciones30dias: number; errorRate: number; salud: string; alerta: string; ultimaCaptura: string | null }>;
  } | null>(null);
  const [mediosHealthLoading, setMediosHealthLoading] = useState(false);

  // Menciones
  const [menciones, setMenciones] = useState<MencionRow[]>([]);
  const [mencionesTotal, setMencionesTotal] = useState(0);
  const [mencionesPage, setMencionesPage] = useState(1);
  const [mencionesLoading, setMencionesLoading] = useState(false);

  // Reportes
  const [reportes, setReportes] = useState<Record<string, unknown>[]>([]);
  const [reportesLoading, setReportesLoading] = useState(false);
  const [generarReporteLoading, setGenerarReporteLoading] = useState(false);

  // Generadores
  const [genStats, setGenStats] = useState<{
    periodo: string;
    totalPeriodo: number;
    totalHistorico: number;
    enviadosPeriodo: number;
    porTipo: Array<{ tipo: string; count: number }>;
    porTipoHistorico: Array<{ tipo: string; count: number }>;
    ultimoPorTipo: Array<{
      tipo: string;
      ultimo: { id: string; fechaCreacion: string; totalMenciones: number; sentimientoPromedio: number; resumen: string; enviado: boolean } | null;
      totalGenerados: number;
    }>;
    tendencias: Array<{ fecha: string; total: number }>;
  } | null>(null);
  const [genStatsLoading, setGenStatsLoading] = useState(false);
  const [genPeriodo, setGenPeriodo] = useState('hoy');
  const [generandoTipo, setGenerandoTipo] = useState<string | null>(null);
  const [previewReporte, setPreviewReporte] = useState<Record<string, unknown> | null>(null);

  // Generadores dedicados (El Termómetro / Saldo del Día)
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(null);
  const [generatorFecha, setGeneratorFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatorFiltros, setGeneratorFiltros] = useState<Record<string, string[]>>({});
  const [generatorData, setGeneratorData] = useState<Record<string, unknown> | null>(null);
  const [generatorDataLoading, setGeneratorDataLoading] = useState(false);
  const [generatorGenerating, setGeneratorGenerating] = useState(false);

  // Clientes
  const [clientes, setClientes] = useState<Record<string, unknown>[]>([]);
  const [clientesTotal, setClientesTotal] = useState(0);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');

  // Contratos
  const [contratos, setContratos] = useState<Record<string, unknown>[]>([]);
  const [contratosTotal, setContratosTotal] = useState(0);
  const [contratosLoading, setContratosLoading] = useState(false);

  // Indicadores económicos
  const [indicadores, setIndicadores] = useState<Array<{
    slug: string;
    nombre: string;
    categoria: string;
    fuente: string;
    periodicidad: string;
    unidad: string;
    ultimoValor: {
      valor: string;
      valorRaw: number;
      fecha: string;
      confiable: boolean;
      fechaCaptura: string;
    } | null;
  }> | null>(null);
  const [indicadoresLoading, setIndicadoresLoading] = useState(false);
  const [capturaIndicadoresLoading, setCapturaIndicadoresLoading] = useState(false);
  const [indicadoresTab, setIndicadoresTab] = useState<'macro' | 'presencia' | 'conflictividad'>('macro');
  const [indicadoresPeriodo, setIndicadoresPeriodo] = useState('30d');
  const [indicadoresCategoria, setIndicadoresCategoria] = useState('');
  const [indicadoresHistorico, setIndicadoresHistorico] = useState<{
    periodo: string;
    fechaInicio: string;
    fechaFin: string;
    totalIndicadores: number;
    conDatos: number;
    porCategoria: Record<string, { total: number; conDatos: number }>;
    indicadores: Array<{
      slug: string; nombre: string; categoria: string; categoriaLabel: string;
      fuente: string; periodicidad: string; unidad: string; tier: number; activo: boolean;
      historial: Array<{ fecha: string; fechaHora: string; valor: string; valorRaw: number; confiable: boolean }>;
      ultimoValor: { valor: string; valorRaw: number; fecha: string; confiable: boolean; fechaCaptura: string } | null;
      estadisticas: { periodo: string; puntos: number; min: number; max: number; promedio: number; variacionPeriodo: string; tendencia: string; diffPct: number } | null;
    }>;
  } | null>(null);

  // Entregas (Boletines)
  const [entregas, setEntregas] = useState<Array<{
    id: string;
    tipoBoletin: string;
    contenido: string;
    fechaProgramada: string | null;
    fechaEnvio: string | null;
    estado: string;
    canal: string;
    destinatarios: string;
    error: string | null;
    fechaCreacion: string;
    contrato: { cliente: { id: string; nombre: string; organizacion: string } } | null;
  }> | null>(null);
  const [entregasLoading, setEntregasLoading] = useState(false);
  const [entregasStats, setEntregasStats] = useState<{ enviadasHoy: number; fallidasHoy: number; pendientes: number } | null>(null);
  const [entregasFilterTipo, setEntregasFilterTipo] = useState('todos');
  const [entregasFilterEstado, setEntregasFilterEstado] = useState('todos');
  const [previewEntrega, setPreviewEntrega] = useState<{
    id: string;
    tipoBoletin: string;
    contenido: string;
    fechaEnvio: string | null;
    canal: string;
    contrato: { cliente: { nombre: string; organizacion: string } } | null;
  } | null>(null);

  // Estrategia
  const [estrategiaSeccion, setEstrategiaSeccion] = useState(0);

  // Medios toggle
  const [toggleMedioId, setToggleMedioId] = useState<string | null>(null);

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

  const loadIndicadores = useCallback(async () => {
    setIndicadoresLoading(true);
    try {
      // Cargar datos actuales (último valor por indicador)
      const res = await fetch('/api/indicadores/capture');
      const json = await res.json();
      if (json.exito) setIndicadores(json.indicadores || []);
    } catch { /* silent */ } finally {
      setIndicadoresLoading(false);
    }
  }, []);

  const loadIndicadoresHistorico = useCallback(async () => {
    setIndicadoresLoading(true);
    try {
      const params = new URLSearchParams({ periodo: indicadoresPeriodo });
      if (indicadoresCategoria) params.set('categoria', indicadoresCategoria);
      const res = await fetch(`/api/indicadores/historico?${params}`);
      const json = await res.json();
      if (!json.error) setIndicadoresHistorico(json);
    } catch { /* silent */ } finally {
      setIndicadoresLoading(false);
    }
  }, [indicadoresPeriodo, indicadoresCategoria]);

  const handleCapturaIndicadores = async () => {
    setCapturaIndicadoresLoading(true);
    setError('');
    try {
      const res = await fetch('/api/indicadores/capture', { method: 'POST' });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        await loadIndicadores();
        await loadIndicadoresHistorico();
      }
    } catch {
      setError('Error al capturar indicadores');
    } finally {
      setCapturaIndicadoresLoading(false);
    }
  };

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

  // ─── Generadores ───
  const loadGenStats = useCallback(async (periodo?: string) => {
    setGenStatsLoading(true);
    try {
      const p = periodo || genPeriodo;
      const res = await fetch(`/api/reportes/stats?periodo=${p}`);
      const json = await res.json();
      setGenStats(json);
    } catch {
      // silent
    } finally {
      setGenStatsLoading(false);
    }
  }, [genPeriodo]);

  const handleGenerarProducto = async (tipo: string) => {
    const config = PRODUCTOS[tipo as keyof typeof PRODUCTOS]?.generador;

    // Productos dedicados: abren panel con preview antes de generar
    if (config?.tipo === 'dedicado' && config.requierePreview) {
      const today = new Date().toISOString().slice(0, 10);
      setSelectedGenerator(tipo);
      setGeneratorFecha(today);
      setGeneratorFiltros({});
      setGeneratorData(null);
      loadGeneratorData(tipo, today);
      return;
    }

    // Productos genéricos: generan directamente sin preview
    setGenerandoTipo(tipo);
    setError('');
    try {
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        await loadGenStats();
      }
    } catch {
      setError('Error al generar producto');
    } finally {
      setGenerandoTipo(null);
    }
  };

  // Cargar datos del generador dedicado
  const loadGeneratorData = useCallback(async (tipo: string, fecha: string, ejeSlug?: string) => {
    setGeneratorDataLoading(true);
    setGeneratorData(null);
    try {
      let url = `/api/reportes/generator-data?tipo=${tipo}&fecha=${fecha}`;
      if (ejeSlug) url += `&ejeSlug=${encodeURIComponent(ejeSlug)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setGeneratorData(json);
      }
    } catch {
      setError('Error al cargar datos del generador');
    } finally {
      setGeneratorDataLoading(false);
    }
  }, []);

  // Seleccionar eje para El Foco
  const selectGeneratorEje = (ejeSlug: string) => {
    setGeneratorFiltros({ eje: [ejeSlug] });
    if (selectedGenerator) {
      loadGeneratorData(selectedGenerator, generatorFecha, ejeSlug);
    }
  };

  // Volver a selección de ejes en El Foco
  const clearGeneratorEje = () => {
    setGeneratorFiltros({});
    if (selectedGenerator) {
      loadGeneratorData(selectedGenerator, generatorFecha);
    }
  };

  // Toggle eje en filtros del generador
  const toggleGeneratorEje = (ejeSlug: string) => {
    setGeneratorFiltros(prev => {
      const current = prev.ejes || [];
      const updated = current.includes(ejeSlug)
        ? current.filter(s => s !== ejeSlug)
        : [...current, ejeSlug];
      return { ...prev, ejes: updated };
    });
  };

  // Generar desde el panel dedicado
  const handleGenerateFromPanel = async () => {
    if (!selectedGenerator) return;
    setGeneratorGenerating(true);
    setError('');
    try {
      const ejesSeleccionados = generatorFiltros.ejes?.length ? generatorFiltros.ejes : undefined;
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: selectedGenerator,
          fecha: generatorFecha,
          ejesSeleccionados,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setSelectedGenerator(null);
        setGeneratorFiltros({});
        setGeneratorData(null);
        await loadGenStats();
      }
    } catch {
      setError('Error al generar producto');
    } finally {
      setGeneratorGenerating(false);
    }
  };

  const closeGeneratorPanel = () => {
    setSelectedGenerator(null);
    setGeneratorFiltros({});
    setGeneratorData(null);
  };

  // Cambiar fecha del generador y recargar datos
  const handleGeneratorFechaChange = (newFecha: string) => {
    setGeneratorFecha(newFecha);
    if (selectedGenerator) {
      // For products with phases (e.g., El Foco), preserve the selected ejeSlug
      const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
      const currentEjeSlug = config?.tieneFases && generatorFiltros.eje?.length
        ? generatorFiltros.eje[0]
        : undefined;
      loadGeneratorData(selectedGenerator, newFecha, currentEjeSlug);
    }
  };

  const loadClientes = useCallback(async () => {
    setClientesLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (clienteSearch) params.set('search', clienteSearch);
      const res = await fetch(`/api/clientes?${params}`);
      const json = await res.json();
      setClientes(json.clientes || []);
      setClientesTotal(json.total || 0);
    } catch {
      // silent
    } finally {
      setClientesLoading(false);
    }
  }, [clienteSearch]);

  const loadContratos = useCallback(async () => {
    setContratosLoading(true);
    try {
      const res = await fetch('/api/contratos?page=1&limit=50');
      const json = await res.json();
      setContratos(json.contratos || []);
      setContratosTotal(json.total || 0);
    } catch {
      // silent
    } finally {
      setContratosLoading(false);
    }
  }, []);

  const loadEntregas = useCallback(async () => {
    setEntregasLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (entregasFilterTipo !== 'todos') params.set('tipoBoletin', entregasFilterTipo);
      if (entregasFilterEstado !== 'todos') params.set('estado', entregasFilterEstado);
      const res = await fetch(`/api/entregas?${params}`);
      const json = await res.json();
      setEntregas(json.entregas || []);
      setEntregasStats(json.stats || null);
    } catch {
      // silent
    } finally {
      setEntregasLoading(false);
    }
  }, [entregasFilterTipo, entregasFilterEstado]);

  const toggleMedioActivo = async (medioId: string, activo: boolean) => {
    setToggleMedioId(medioId);
    try {
      const res = await fetch(`/api/medios/${medioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !activo }),
      });
      const json = await res.json();
      if (json.medio) {
        setMedios((prev) => prev.map((m) => m.id === medioId ? { ...m, activo: !activo } : m));
      }
    } catch {
      // silent
    } finally {
      setToggleMedioId(null);
    }
  };

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
    // Cargar indicadores económicos al iniciar
    loadIndicadores();
    // Auto health-check de medios al cargar
    loadMediosHealth();
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

  // Cargar health check de medios
  const loadMediosHealth = useCallback(async () => {
    setMediosHealthLoading(true);
    try {
      const res = await fetch('/api/medios/health');
      if (res.ok) {
        const json = await res.json();
        setMediosHealth(json);
      }
    } catch { /* silent */ } finally {
      setMediosHealthLoading(false);
    }
  }, []);

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
      else if (viewId === 'generadores') loadGenStats();
      else if (viewId === 'clientes') loadClientes();
      else if (viewId === 'contratos') loadContratos();
      else if (viewId === 'boletines') loadEntregas();
      else if (viewId === 'captura') loadMediosHealth();
      else if (viewId === 'indicadores') { loadIndicadores(); loadIndicadoresHistorico(); }
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
            <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden" style={{backgroundColor: '#0A1628'}}>
              <Image src="/logo.png" alt="DECODEX" width={36} height={36} className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
                DECODEX
              </h2>
              <p className="text-[10px] text-sidebar-foreground/60">Bolivia · Inteligencia de Señales</p>
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
                DECODEX · ONION200 · Bolivia
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
                  {NAV_ITEMS.find((n) => n.id === activeView)?.label || 'Centro de Comando'}
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  DECODEX — Motor ONION200
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
              VIEW: CENTRO DE COMANDO
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

              {/* KPI Cards — Centro de Comando */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <KPICard
                  icon={<UserCircle className="h-5 w-5" />}
                  value={data?.clientesActivos || 0}
                  label="Clientes activos"
                  subtext={`${data?.contratosVigentes || 0} contratos vigentes`}
                  colorClass="text-primary"
                />
                <KPICard
                  icon={<Mail className="h-5 w-5" />}
                  value={data?.entregasHoy || 0}
                  label="Entregas hoy"
                  subtext="Boletines enviados"
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <KPICard
                  icon={<Newspaper className="h-5 w-5" />}
                  value={data?.mencionesHoy || 0}
                  label="Menciones hoy"
                  subtext={`${data?.mencionesSemana || 0} esta semana`}
                  colorClass="text-sky-600 dark:text-sky-400"
                />
                <KPICard
                  icon={<Radio className="h-5 w-5" />}
                  value={data?.totalMedios || 0}
                  label="Medios activos"
                  subtext={`${data?.totalEjes || 0} ejes · ${data?.totalPersonas || 0} legisladores`}
                  colorClass="text-amber-600 dark:text-amber-400"
                />
              </div>

              {/* Health Alert Banner — auto-cargado al inicio */}
              {mediosHealth && (mediosHealth.resumen.muertos > 0 || mediosHealth.resumen.conErrores > 0) && (
                <div className={`p-3 rounded-lg border flex items-start gap-3 ${
                  mediosHealth.resumen.muertos > 0
                    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                }`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${mediosHealth.resumen.muertos > 0 ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {mediosHealth.resumen.muertos > 0
                        ? `${mediosHealth.resumen.muertos} medio(s) sin respuesta (posiblemente cerrados o URL cambiada)`
                        : `${mediosHealth.resumen.conErrores} medio(s) con errores frecuentes de captura`
                      }
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {mediosHealth.medios.filter(m => m.salud !== 'sano').slice(0, 3).map(m => m.nombre).join(', ')}
                      {mediosHealth.medios.filter(m => m.salud !== 'sano').length > 3 ? ` y ${mediosHealth.medios.filter(m => m.salud !== 'sano').length - 3} más` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveView('captura')} className="text-xs text-muted-foreground shrink-0">
                    Ver detalle <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}



              {/* Alertas */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Bell className="h-4 w-4 text-red-500" />
                        Alertas
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Crisis, oportunidades y monitoreo · tiempo real
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-xs gap-1 opacity-60"
                        title="Captura automática pendiente de implementación"
                      >
                        <Zap className="h-3 w-3" />
                        Generar alertas
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setActiveView('alertas')} className="text-xs text-muted-foreground">
                        Ver historial <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Negativas */}
                    <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-center">
                      <div className="text-2xl mb-1">🔴</div>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">{data?.alertas?.negativasHoy || 0}</p>
                      <p className="text-[10px] font-medium text-red-600/80 dark:text-red-400/80">Negativas</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Crisis / Riesgo</p>
                    </div>
                    {/* Positivas */}
                    <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                      <div className="text-2xl mb-1">🟢</div>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{data?.alertas?.positivasHoy || 0}</p>
                      <p className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">Positivas</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Oportunidades</p>
                    </div>
                    {/* Neutras */}
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 text-center">
                      <div className="text-2xl mb-1">⚪</div>
                      <p className="text-xl font-bold text-slate-600 dark:text-slate-300">{data?.alertas?.neutrasHoy || 0}</p>
                      <p className="text-[10px] font-medium text-slate-600/80 dark:text-slate-400/80">Neutras</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Informativas</p>
                    </div>
                  </div>
                  {data?.alertas?.ultimaAlerta ? (
                    <div className="mt-3 p-2.5 rounded-lg bg-muted/50 border border-border">
                      <p className="text-[10px] text-muted-foreground">
                        Última alerta: {new Date(data.alertas.ultimaAlerta.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-foreground mt-0.5 line-clamp-1">{data.alertas.ultimaAlerta.resumen || 'Sin resumen'}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
                      No hay alertas registradas. La captura automática de alertas está pendiente de implementación.
                    </p>
                  )}
                </CardContent>
              </Card>





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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Estado de fuentes
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveView('captura')} className="text-xs text-muted-foreground">
                      Salud de fuentes <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {(data?.fuentesPorNivel || []).map((fuente) => {
                      const tieneCaptura = fuente.ultimaCaptura !== null;
                      const esReciente = tieneCaptura && (Date.now() - new Date(fuente.ultimaCaptura!).getTime()) < 86400000;
                      return (
                        <div key={fuente.nivel} className={`p-3 rounded-lg border transition-colors ${
                          esReciente && fuente.ultimaExitosa
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : tieneCaptura && !fuente.ultimaExitosa
                            ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                            : 'border-border bg-muted/50'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            {esReciente && fuente.ultimaExitosa ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : tieneCaptura && !fuente.ultimaExitosa ? (
                              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-stone-300 dark:border-stone-600 shrink-0" />
                            )}
                            <p className="text-xs font-medium text-foreground">{NIVEL_LABELS[fuente.nivel]}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {fuente.mediosCount} medios activos
                          </p>
                          {tieneCaptura && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Última: {new Date(fuente.ultimaCaptura!).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} · {fuente.ultimoMencionesEncontradas} menc.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Productos Vigentes */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Productos Vigentes
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveView('productos')} className="text-xs text-muted-foreground">
                      Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    {ALL_PRODUCTS.filter(p => p.estado === 'operativo').length} operativos · {ALL_PRODUCTS.length} productos totales
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_PRODUCTS.map((prod) => {
                      const ProdIcon = prod.icon;
                      const prodConfig = PRODUCTOS[prod.tipo];
                      return (
                        <div key={prod.tipo} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:border-primary/30 transition-colors">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: prod.color + '20' }}
                          >
                            <ProdIcon className="h-4 w-4" style={{ color: prod.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{prod.nombre}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                prod.estado === 'operativo'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}>
                                {prod.estado === 'operativo' ? '✅ Op.' : '⚠️ Def.'}
                              </span>
                              {prodConfig && (
                                <span className="text-[9px] text-muted-foreground">{prodConfig.horarioEnvio}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
              VIEW: CLIENTES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'clientes' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        Gestión de Clientes
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {clientesTotal} clientes registrados
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Buscar cliente..."
                        value={clienteSearch}
                        onChange={(e) => { setClienteSearch(e.target.value); loadedViews.current.delete('clientes'); }}
                        className="sm:max-w-xs text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={() => { loadedViews.current.delete('clientes'); loadClientes(); }} className="text-xs gap-1">
                        <RefreshCw className="h-3 w-3" /> Actualizar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {clientesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : clientes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs">Cliente</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Contacto</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Plan</TableHead>
                            <TableHead className="text-xs hidden lg:table-cell">Segmento</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Estado</TableHead>
                            <TableHead className="text-xs">Parlam.</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Contratos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientes.map((c: Record<string, unknown>, i: number) => (
                            <TableRow key={String(c.id || i)}>
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="text-sm font-medium text-foreground max-w-[160px] truncate">{String(c.nombre || '—')}</p>
                                  <p className="text-[10px] text-muted-foreground">{String(c.organizacion || '')}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                <p className="text-xs text-foreground">{String(c.nombreContacto || String(c.email || '—'))}</p>
                                <p className="text-[10px] text-muted-foreground">{String(c.email || '')}</p>
                              </TableCell>
                              <TableCell className="py-2.5 hidden md:table-cell">
                                <Badge variant="secondary" className="text-[10px]">{String(c.plan || 'basico')}</Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{String(c.segmento || 'otro')}</TableCell>
                              <TableCell className="py-2.5 hidden sm:table-cell">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  String(c.estado) === 'activo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                  String(c.estado) === 'suspendido' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                                  'bg-stone-100 text-stone-500'
                                }`}>
                                  {String(c.estado || 'activo')}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="secondary" className="text-[10px]">{Number(c.parlamentariosCount || 0)}</Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                                {Number(c.contratosActivos || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState icon={<UserCircle className="h-10 w-10" />} text="No hay clientes registrados" subtext="Agrega clientes desde la API o el seed" />
                  )}
                </CardContent>
              </Card>

              {/* Lista de Parlamentarios disponibles */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Parlamentarios disponibles para asignar
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Lista de legisladores que se pueden asignar a clientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {personaList.length > 0 ? personaList.slice(0, 30).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{p.nombre}</p>
                          <p className="text-[10px] text-muted-foreground">{p.camara} · {p.partidoSigla} · {p.departamento}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full text-center py-4">
                        <p className="text-xs text-muted-foreground">Carga datos de ejemplo primero (Resumen → Cargar datos)</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: CONTRATOS
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'contratos' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        Gestión de Contratos
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {contratosTotal} contratos registrados
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { loadedViews.current.delete('contratos'); loadContratos(); }} className="text-xs gap-1">
                      <RefreshCw className="h-3 w-3" /> Actualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {contratosLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : contratos.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs">Producto</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Cliente</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Frecuencia</TableHead>
                            <TableHead className="text-xs">Estado</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Entrega</TableHead>
                            <TableHead className="text-xs hidden lg:table-cell">Monto</TableHead>
                            <TableHead className="text-xs hidden lg:table-cell">Medios</TableHead>
                            <TableHead className="text-xs">Parlam.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contratos.map((c: Record<string, unknown>, i: number) => {
                            const cl = c.cliente as Record<string, unknown> | null;
                            return (
                              <TableRow key={String(c.id || i)}>
                                <TableCell className="py-2.5">
                                  <Badge variant="secondary" className="text-[10px]">{String(c.tipoProducto || '—').replace(/_/g, ' ')}</Badge>
                                </TableCell>
                                <TableCell className="py-2.5 hidden sm:table-cell">
                                  <p className="text-xs font-medium text-foreground">{cl ? String(cl.nombre || '—') : '—'}</p>
                                  <p className="text-[10px] text-muted-foreground">{cl ? String(cl.email || '') : ''}</p>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">{String(c.frecuencia || 'diario')}</TableCell>
                                <TableCell className="py-2.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    String(c.estado) === 'activo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                    String(c.estado) === 'pausado' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                                    'bg-stone-100 text-stone-500'
                                  }`}>
                                    {String(c.estado || 'activo')}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{String(c.formatoEntrega || 'whatsapp')}</TableCell>
                                <TableCell className="py-2.5 text-xs text-foreground hidden lg:table-cell font-medium">
                                  {Number(c.montoMensual || 0) > 0 ? `${Number(c.montoMensual).toFixed(0)} ${String(c.moneda || 'Bs')}` : '—'}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{Number(c.mediosCount || 0)}</TableCell>
                                <TableCell className="py-2.5">
                                  <Badge variant="secondary" className="text-[10px]">{Number(c.parlamentariosCount || 0)}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState icon={<FileCheck className="h-10 w-10" />} text="No hay contratos registrados" subtext="Crea contratos desde la API de /api/contratos" />
                  )}
                </CardContent>
              </Card>

              {/* Panel de Medios con Toggle ON/OFF */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                        Medios — Panel de Control
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Enciende o apaga medios para monitoreo por contrato
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadMedios} className="text-xs gap-1">
                      <RefreshCw className="h-3 w-3" /> Recargar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {mediosLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : medios.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {medios.map((m) => (
                        <div key={m.id} className={`p-3 rounded-lg border transition-all ${m.activo ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border opacity-60'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{m.nombre}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{m.tipo}</p>
                              {m.departamento && <p className="text-[10px] text-muted-foreground">{m.departamento}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className={`text-[10px] ${NIVEL_COLORS[m.nivel]}`}>N{m.nivel}</Badge>
                              <button
                                onClick={() => toggleMedioActivo(m.id, m.activo)}
                                disabled={toggleMedioId === m.id}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                                  m.activo ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'
                                } ${toggleMedioId === m.id ? 'opacity-50' : ''}`}
                                title={m.activo ? 'Desactivar medio' : 'Activar medio'}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                  m.activo ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">{m.mencionesCount} menciones</span>
                            <span className={`text-[10px] font-medium ${m.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                              {m.activo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={<Radio className="h-10 w-10" />} text="No hay medios registrados" subtext="Carga datos de ejemplo primero (Resumen → Cargar datos)" />
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
              VIEW: GENERADORES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'generadores' && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard icon={<FileBarChart className="h-5 w-5" />} value={genStats?.totalPeriodo || 0} label="Este periodo" colorClass="text-primary" />
                <KPICard icon={<CheckCircle2 className="h-5 w-5" />} value={genStats?.enviadosPeriodo || 0} label="Enviados" colorClass="text-emerald-600 dark:text-emerald-400" />
                <KPICard icon={<FileCheck className="h-5 w-5" />} value={genStats?.totalHistorico || 0} label="Total historico" colorClass="text-purple-600 dark:text-purple-400" />
                <KPICard icon={<Package className="h-5 w-5" />} value={ALL_PRODUCTS.filter(p => p.estado === 'operativo').length} label="Productos operativos" colorClass="text-amber-600 dark:text-amber-400" />
              </div>

              {/* Filtros de periodo + distribución por tipo */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Selector de periodo */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Filtros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Periodo</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(['hoy', 'semana', 'mes', 'historico'] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => { setGenPeriodo(p); loadedViews.current.delete('generadores'); }}
                            className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                              genPeriodo === p
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Historico'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => loadGenStats()} disabled={genStatsLoading} className="text-xs gap-1 w-full">
                      {genStatsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Actualizar
                    </Button>
                  </CardContent>
                </Card>

                {/* Distribución por tipo (periodo actual) */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        Generados por tipo
                      </CardTitle>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {genStats?.porTipo.length || 0} tipos con datos
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {genPeriodo === 'hoy' ? 'Hoy' : genPeriodo === 'semana' ? 'Esta semana' : genPeriodo === 'mes' ? 'Este mes' : 'Historico'} ({genStats?.totalPeriodo || 0}) · Historico: {genStats?.totalHistorico || 0}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {genStatsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : genStats && genStats.porTipo.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {genStats.porTipo.map((item) => {
                          const prodInfo = ALL_PRODUCTS.find(p => p.tipo === item.tipo);
                          const ProdIcon = prodInfo?.icon || FileText;
                          const maxCount = Math.max(...genStats.porTipo.map(t => t.count), 1);
                          const histItem = genStats.porTipoHistorico.find(h => h.tipo === item.tipo);
                          return (
                            <div key={item.tipo} className="flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (prodInfo?.color || '#6B7280') + '20' }}>
                                <ProdIcon className="h-3.5 w-3.5" style={{ color: prodInfo?.color || '#6B7280' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <p className="text-[11px] font-medium text-foreground truncate">{prodInfo?.nombre || item.tipo.replace(/_/g, ' ')}</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-foreground">{item.count}</span>
                                    {histItem && (
                                      <span className="text-[9px] text-muted-foreground">/ {histItem.count} total</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{
                                    width: `${Math.max((item.count / maxCount) * 100, 3)}%`,
                                    backgroundColor: prodInfo?.color || '#6B7280',
                                  }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-xs text-muted-foreground">Sin reportes generados en este periodo</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tendencia 7 días */}
              {genStats && genStats.tendencias.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Tendencia ultimos 7 dias
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-end gap-2 h-20">
                      {genStats.tendencias.map((t) => {
                        const maxT = Math.max(...genStats.tendencias.map(x => x.total), 1);
                        const h = Math.max((t.total / maxT) * 100, 4);
                        return (
                          <div key={t.fecha} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] font-bold text-foreground">{t.total}</span>
                            <div className="w-full rounded-t-sm bg-primary/80 transition-all" style={{ height: `${h}%` }} />
                            <span className="text-[8px] text-muted-foreground">
                              {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'short' }).slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tarjetas de generación de productos */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Productos
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Genera, previsualiza y entrega productos ONION200
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {ALL_PRODUCTS.filter(p => p.estado === 'operativo').map((prod) => {
                      const ProdIcon = prod.icon;
                      const prodConfig = PRODUCTOS[prod.tipo];
                      const statsProd = genStats?.ultimoPorTipo.find(s => s.tipo === prod.tipo);
                      const ultimo = statsProd?.ultimo;
                      const totalGen = statsProd?.totalGenerados || 0;
                      const isGenerating = generandoTipo === prod.tipo;
                      const catInfo = PRODUCT_CATEGORIES.find(c => c.id === prod.categoria);
                      const canales = prodConfig?.canales || [];
                      const frecuencia = prodConfig?.frecuencia || '';
                      return (
                        <div key={prod.tipo} className="p-4 rounded-xl border border-border hover:border-primary/30 transition-all hover:shadow-sm space-y-3">
                          {/* Header */}
                          <div className="flex items-start gap-3">
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: prod.color + '20' }}
                            >
                              <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                                {catInfo && (
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${catInfo.color}`}>{catInfo.label}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{prodConfig?.descripcion || ''}</p>
                            </div>
                          </div>

                          {/* Info: frecuencia + horario + formatos */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            {frecuencia && (
                              <span className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {FRECUENCIA_LABELS[frecuencia] || frecuencia}
                              </span>
                            )}
                            {prodConfig?.horarioEnvio && (
                              <span>{prodConfig.horarioEnvio}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {canales.map(c => CANAL_LABELS[c] || c).join(', ')}
                            </span>
                          </div>

                          {/* Último generado + total */}
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="text-muted-foreground">
                              {ultimo ? (
                                <span>
                                  Ultimo: {new Date(ultimo.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  {ultimo.totalMenciones > 0 && <span className="ml-1">· {ultimo.totalMenciones} menc.</span>}
                                </span>
                              ) : (
                                <span className="italic">Sin generar aun</span>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[9px]">{totalGen} total</Badge>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleGenerarProducto(prod.tipo)}
                              disabled={isGenerating}
                              className="flex-1 text-xs gap-1.5"
                              style={isGenerating ? {} : { backgroundColor: prod.color, borderColor: prod.color }}
                            >
                              {isGenerating
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Generando...</>
                                : <><Zap className="h-3 w-3" /> Generar ahora</>
                              }
                            </Button>
                            {ultimo && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewReporte(ultimo)}
                                className="text-xs gap-1"
                              >
                                <Eye className="h-3 w-3" /> Vista previa
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Modal Vista Previa */}
              {previewReporte && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewReporte(null)}>
                  <div className="bg-card rounded-xl shadow-xl border border-border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {(previewReporte.tipo as string)?.replace(/_/g, ' ') || 'Reporte'}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(previewReporte.fechaCreacion as string).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {(previewReporte.totalMenciones as number) > 0 && <span> · {(previewReporte.totalMenciones as number)} menciones</span>}
                          {(previewReporte.enviado as boolean) && <span className="text-emerald-500 ml-1">· Enviado</span>}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setPreviewReporte(null)} className="h-7 w-7 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {(previewReporte.resumen as string) || 'Sin contenido de resumen.'}
                        </p>
                      </div>
                      {(previewReporte.sentimientoPromedio as number) > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">Sentimiento promedio</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${((previewReporte.sentimientoPromedio as number) / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-foreground">{(previewReporte.sentimientoPromedio as number).toFixed(1)}/5</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
                      <Button variant="ghost" size="sm" onClick={() => setPreviewReporte(null)} className="text-xs">Cerrar</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ PANEL GENERADOR DEDICADO (El Termómetro / Saldo del Día / El Foco) ═══ */}
              {selectedGenerator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeGeneratorPanel}>
                  <div className="bg-card rounded-xl shadow-xl border border-border max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

                    {/* ── HEADER (data-driven desde ALL_PRODUCTS) ── */}
                    {(() => {
                      const prod = ALL_PRODUCTS.find(p => p.tipo === selectedGenerator);
                      const productColor = prod?.color || '#6B7280';
                      const ProductIcon = prod?.icon || Zap;
                      const productConfig = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS];
                      return (
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: productColor + '20' }}
                            >
                              <ProductIcon className="h-5 w-5" style={{ color: productColor }} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-foreground">
                                {prod?.nombre || selectedGenerator} — Generador
                              </h3>
                              <p className="text-[10px] text-muted-foreground">
                                {productConfig?.generador.descripcionVentana || productConfig?.descripcion || ''}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={closeGeneratorPanel} className="h-8 w-8 p-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })()}

                    {/* ── BODY ── */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {generatorDataLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Cargando datos del generador...</p>
                        </div>
                      ) : generatorData ? (
                        <>

                          {/* ═══ Panel FASE ANALISIS (productos con tieneFases, eje seleccionado) ═══ */}
                          {(() => {
                            const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                            return config?.tieneFases && (generatorData.fase as string) === 'analisis';
                          })() && (
                            <>
                              {/* Sub-header con eje seleccionado */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: (generatorData.ejeSeleccionado as { color: string })?.color || '#F59E0B' }} />
                                  <h4 className="text-sm font-bold text-foreground">{(generatorData.ejeSeleccionado as { nombre: string })?.nombre}</h4>
                                  <Badge variant="secondary" className="text-[9px]">{generatorData.totalMenciones as number} menciones</Badge>
                                </div>
                                <Button variant="ghost" size="sm" onClick={clearGeneratorEje} className="text-[10px] gap-1 h-7">
                                  <ChevronLeft className="h-3 w-3" /> Cambiar eje
                                </Button>
                              </div>

                              {/* 2x2 Deep Analysis Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                {/* 1. Sentimiento del Eje */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                                    Sentimiento del Eje
                                  </p>
                                  {(generatorData.sentimientoResumen as { promedio: number; label: string; distribucion: Record<string, number> }) && (
                                    <>
                                      <div className="flex items-center gap-3">
                                        <div className="text-2xl font-bold text-foreground">
                                          {(generatorData.sentimientoResumen as { promedio: number }).promedio.toFixed(1)}
                                        </div>
                                        <div className="flex-1">
                                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{
                                              width: `${((generatorData.sentimientoResumen as { promedio: number }).promedio / 5) * 100}%`,
                                              backgroundColor: (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5 ? '#10B981'
                                                : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5 ? '#F59E0B' : '#EF4444',
                                            }} />
                                          </div>
                                          <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[9px] text-muted-foreground">Negativo</span>
                                            <span className={`text-[10px] font-semibold ${
                                              (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5 ? 'text-emerald-600 dark:text-emerald-400'
                                                : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5 ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-red-600 dark:text-red-400'
                                            }`}>
                                              {(generatorData.sentimientoResumen as { label: string }).label.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">Positivo</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {Object.entries((generatorData.sentimientoResumen as { distribucion: Record<string, number> }).distribucion)
                                          .sort(([, a], [, b]) => b - a)
                                          .slice(0, 4)
                                          .map(([sent, count]) => (
                                            <span key={sent} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[sent] || 'bg-muted text-muted-foreground'}`}>
                                              {sent.replace('_', ' ')} ({count})
                                            </span>
                                          ))
                                        }
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* 2. Actividad del Eje */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Actividad del Eje
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-foreground">{generatorData.totalMenciones as number || 0}</span>
                                    <span className="text-xs text-muted-foreground">menciones</span>
                                  </div>
                                  {/* Mini bar chart by hour */}
                                  {(generatorData.evolucionHoraria as Array<{ hora: number; count: number }>)?.length > 0 && (
                                    <div className="flex items-end gap-0.5 h-12">
                                      {(generatorData.evolucionHoraria as Array<{ hora: number; count: number }>).map((ev) => {
                                        const maxCount = Math.max(...(generatorData.evolucionHoraria as Array<{ count: number }>).map(e => e.count), 1);
                                        const height = ev.count > 0 ? Math.max((ev.count / maxCount) * 100, 4) : 4;
                                        return (
                                          <div key={ev.hora} className="flex-1 flex flex-col items-center gap-0.5" title={`${ev.hora}:00 — ${ev.count} menc.`}>
                                            <div
                                              className="w-full rounded-t-sm transition-all"
                                              style={{
                                                height: `${height}%`,
                                                backgroundColor: ev.count > 0 ? '#F59E0B' : '#E4E4E720',
                                                minHeight: '2px',
                                              }}
                                            />
                                            <span className="text-[7px] text-muted-foreground leading-none">{String(ev.hora).padStart(2, '0')}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* 3. Actores en el Eje */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                    Actores en el Eje
                                  </p>
                                  <div className="space-y-1.5">
                                    {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>)?.length > 0
                                      ? (generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>).slice(0, 5).map((actor, i) => (
                                        <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                                          <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                            #{i + 1}
                                          </span>
                                          <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                                          <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                                          <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{actor.count}</Badge>
                                        </div>
                                      ))
                                      : <p className="text-[10px] text-muted-foreground italic">Sin actores en este eje</p>
                                    }
                                  </div>
                                </div>

                                {/* 4. Fuentes del Eje */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                                    Fuentes del Eje
                                  </p>
                                  <div className="space-y-1.5">
                                    {(generatorData.mediosDistribucion as Array<{ nombre: string; count: number }>)?.length > 0
                                      ? (generatorData.mediosDistribucion as Array<{ nombre: string; count: number }>).slice(0, 5).map((medio, i) => (
                                        <div key={medio.nombre} className="flex items-center gap-2 text-[10px]">
                                          <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                            #{i + 1}
                                          </span>
                                          <span className="text-foreground font-medium truncate">{medio.nombre}</span>
                                          <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{medio.count}</Badge>
                                        </div>
                                      ))
                                      : <p className="text-[10px] text-muted-foreground italic">Sin fuentes para este eje</p>
                                    }
                                  </div>
                                </div>
                              </div>

                              {/* Sub-temas */}
                              {(generatorData.subTemas as Array<{ tema: string; count: number }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                    Sub-temas en el eje
                                  </p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(generatorData.subTemas as Array<{ tema: string; count: number }>).map((st) => (
                                      <Badge key={st.tema} variant="secondary" className="text-[9px] gap-1">
                                        {st.tema} <span className="text-muted-foreground">({st.count})</span>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Preview de menciones */}
                              {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string } }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                                    Menciones del eje
                                    <span className="text-[9px] font-normal text-muted-foreground">
                                      (máx. 20 de {generatorData.totalMenciones as number})
                                    </span>
                                  </p>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string } }>).map((m) => (
                                      <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                                          {(m.sentimiento || '').replace('_', ' ')}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                                          <p className="text-[9px] text-muted-foreground">
                                            {m.persona?.nombre && <span>{m.persona.nombre} · </span>}
                                            {m.medio?.nombre && <span>{m.medio.nombre} · </span>}
                                            {m.fechaCaptura && <Clock className="h-2.5 w-2.5 inline mr-0.5" />}
                                            {m.fechaCaptura && new Date(m.fechaCaptura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* ═══ Panel SELECCION DE EJE (productos con tieneFases, sin eje seleccionado) ═══ */}
                          {(() => {
                            const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                            return config?.tieneFases && (generatorData.fase as string) !== 'analisis';
                          })() && (
                            <>
                              {/* Fecha */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                  Fecha del reporte
                                </label>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="date"
                                    value={generatorFecha}
                                    onChange={(e) => handleGeneratorFechaChange(e.target.value)}
                                    className="max-w-[200px] text-sm h-9"
                                  />
                                  {(generatorData.windowLabel as string) && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Ventana: {(generatorData.windowLabel as string)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Grid de ejes disponibles */}
                              {(generatorData.ejesDisponibles as Array<{ id: string; nombre: string; slug: string; color: string; descripcion: string; mencionesCount: number }>)?.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                      <Search className="h-3.5 w-3.5 text-amber-500" />
                                      Selecciona un eje temático
                                    </label>
                                    <span className="text-[9px] text-muted-foreground">
                                      {(generatorData.totalMencionesDia as number) || 0} menciones en el día
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    {(generatorData.ejesDisponibles as Array<{ id: string; nombre: string; slug: string; color: string; descripcion: string; mencionesCount: number }>).map((eje) => (
                                      <button
                                        key={eje.id}
                                        onClick={() => selectGeneratorEje(eje.slug)}
                                        className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all text-left"
                                      >
                                        <div className="h-3 w-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: eje.color || '#F59E0B' }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-bold text-foreground">{eje.nombre}</p>
                                          {eje.descripcion && (
                                            <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{eje.descripcion}</p>
                                          )}
                                          <div className="flex items-center gap-1.5 mt-1.5">
                                            <Badge variant="secondary" className="text-[8px]">
                                              {eje.mencionesCount} menc.
                                            </Badge>
                                          </div>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* ═══ Panel RADAR SEMANAL (productos con panelId === 'radar') ═══ */}
                          {(() => {
                            const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                            return config?.panelId === 'radar';
                          })() && (
                            <>
                              {/* Fecha + ventana semanal */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                  Semana del reporte
                                </label>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="date"
                                    value={generatorFecha}
                                    onChange={(e) => handleGeneratorFechaChange(e.target.value)}
                                    className="max-w-[200px] text-sm h-9"
                                  />
                                  {(generatorData.windowLabel as string) && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {(generatorData.windowLabel as string)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Hallazgo clave */}
                              {(generatorData.hallazgoClave as string) && (
                                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    <Radio className="h-3 w-3" /> Hallazgo clave
                                  </p>
                                  <p className="text-[11px] text-foreground leading-relaxed">{generatorData.hallazgoClave as string}</p>
                                </div>
                              )}

                              {/* KPIs rápidos */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 rounded-lg border border-border text-center">
                                  <p className="text-lg font-bold text-foreground">{generatorData.totalMenciones as number || 0}</p>
                                  <p className="text-[9px] text-muted-foreground">Menciones</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border text-center">
                                  <p className="text-lg font-bold text-foreground">{generatorData.totalEjesActivos as number || 0}</p>
                                  <p className="text-[9px] text-muted-foreground">Ejes activos</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border text-center">
                                  <div className="text-lg font-bold text-foreground">
                                    {(generatorData.sentimientoGlobal as { promedio: number })?.promedio?.toFixed(1) || '—'}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground">
                                    {(generatorData.sentimientoGlobal as { label: string })?.label || 'N/D'}
                                  </p>
                                </div>
                              </div>

                              {/* Evolución diaria */}
                              {(generatorData.evolucionDiaria as Array<{ dia: string; count: number }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Evolución diaria
                                  </p>
                                  <div className="flex items-end gap-2 h-20">
                                    {(generatorData.evolucionDiaria as Array<{ fecha: string; dia: string; count: number }>).map((d) => {
                                      const maxDay = Math.max(...(generatorData.evolucionDiaria as Array<{ count: number }>).map(x => x.count), 1);
                                      const h = Math.max((d.count / maxDay) * 100, 4);
                                      return (
                                        <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
                                          <span className="text-[9px] font-bold text-foreground">{d.count}</span>
                                          <div className="w-full rounded-t-sm bg-emerald-500/80 transition-all" style={{ height: `${h}%` }} />
                                          <span className="text-[8px] text-muted-foreground">{d.dia}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Radar de 11 ejes */}
                              {(generatorData.radarEjes as Array<{
                                nombre: string; slug: string; color: string; menciones: number;
                                sentimientoProm: number; sentimientoLabel: string;
                                topActor: string | null; hallazgo: string;
                                tendencia: 'ascendente' | 'estable' | 'descendente';
                              }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Radio className="h-3.5 w-3.5 text-emerald-500" />
                                    Radar de ejes temáticos
                                    <span className="text-[9px] font-normal text-muted-foreground">
                                      {(generatorData.radarEjes as unknown[]).length} ejes
                                    </span>
                                  </p>
                                  <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                                    {(generatorData.radarEjes as Array<{
                                      nombre: string; slug: string; color: string; menciones: number;
                                      sentimientoProm: number; sentimientoLabel: string;
                                      topActor: string | null; hallazgo: string;
                                      tendencia: 'ascendente' | 'estable' | 'descendente';
                                    }>).map((eje) => {
                                      const maxMenc = Math.max(...(generatorData.radarEjes as Array<{ menciones: number }>).map(e => e.menciones), 1);
                                      const barWidth = Math.max((eje.menciones / maxMenc) * 100, 2);
                                      const tendenciaIcon = eje.tendencia === 'ascendente' ? '↑' : eje.tendencia === 'descendente' ? '↓' : '→';
                                      const tendenciaColor = eje.tendencia === 'ascendente' ? 'text-emerald-500' : eje.tendencia === 'descendente' ? 'text-red-500' : 'text-muted-foreground';
                                      return (
                                        <div key={eje.slug} className="p-2.5 rounded-lg border border-border hover:border-primary/20 transition-all">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eje.color || '#22C55E' }} />
                                            <p className="text-[11px] font-bold text-foreground flex-1 truncate">{eje.nombre}</p>
                                            <span className={`text-[10px] font-mono font-bold ${tendenciaColor}`}>{tendenciaIcon}</span>
                                            <Badge variant="secondary" className="text-[8px] shrink-0">{eje.menciones} menc.</Badge>
                                          </div>
                                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: eje.color || '#22C55E' }} />
                                          </div>
                                          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                                            <span>Sentimiento: <span className={`font-medium ${eje.sentimientoLabel === 'positivo' ? 'text-emerald-600 dark:text-emerald-400' : eje.sentimientoLabel === 'negativo' ? 'text-red-600 dark:text-red-400' : ''}`}>{eje.sentimientoProm.toFixed(1)}</span></span>
                                            {eje.topActor && <span>Actor: <span className="font-medium text-foreground">{eje.topActor}</span></span>}
                                          </div>
                                          <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{eje.hallazgo}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Top actores de la semana */}
                              {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number; ejesPrincipales: string[] }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                                    Actores de la semana
                                  </p>
                                  <div className="space-y-1.5">
                                    {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; camara: string; count: number; ejesPrincipales: string[] }>).slice(0, 5).map((actor, i) => (
                                      <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                                        <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                          #{i + 1}
                                        </span>
                                        <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                                        <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                                        {actor.ejesPrincipales.length > 0 && (
                                          <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                            {actor.ejesPrincipales.slice(0, 2).map(ej => {
                                              const ejeInfo = (generatorData.radarEjes as Array<{ slug: string; color: string; nombre: string }>)?.find(e => e.slug === ej);
                                              return ejeInfo ? (
                                                <span key={ej} className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ejeInfo.color }} title={ejeInfo.nombre} />
                                              ) : null;
                                            })}
                                            {actor.ejesPrincipales.length > 2 && <span className="text-[8px] text-muted-foreground">+{actor.ejesPrincipales.length - 2}</span>}
                                          </div>
                                        )}
                                        <Badge variant="secondary" className="text-[8px] shrink-0">{actor.count}</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Preview menciones */}
                              {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string }; ejes: Array<{ nombre: string; color: string }> }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                                    Menciones recientes
                                    <span className="text-[9px] font-normal text-muted-foreground">
                                      (máx. 15 de {(generatorData.totalMenciones as number)})
                                    </span>
                                  </p>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string }; ejes: Array<{ nombre: string; color: string }> }>).map((m) => (
                                      <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                                          {(m.sentimiento || '').replace('_', ' ')}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                                          <div className="flex items-center gap-1 mt-0.5">
                                            {m.persona?.nombre && <span className="text-[9px] text-muted-foreground">{m.persona.nombre}</span>}
                                            {m.medio?.nombre && <span className="text-[9px] text-muted-foreground">· {m.medio.nombre}</span>}
                                            <span className="text-[9px] text-muted-foreground">
                                              <Clock className="h-2 w-2 inline mr-0.5" />
                                              {new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                                            </span>
                                          </div>
                                          {m.ejes?.length > 0 && (
                                            <div className="flex items-center gap-0.5 mt-0.5">
                                              {m.ejes.slice(0, 3).map(ej => (
                                                <span key={ej.nombre} className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ej.color }} title={ej.nombre} />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* ═══ Panel TERMOMETRO/SALDO (productos con panelId === 'termometro_saldo') ═══ */}
                          {(() => {
                            const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                            return config?.panelId === 'termometro_saldo';
                          })() && (
                            <>
                              {/* Fecha */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                  Fecha del reporte
                                </label>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="date"
                                    value={generatorFecha}
                                    onChange={(e) => handleGeneratorFechaChange(e.target.value)}
                                    className="max-w-[200px] text-sm h-9"
                                  />
                                  {(generatorData.windowLabel as string) && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Ventana: {(generatorData.windowLabel as string)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Ejes temáticos */}
                              {(generatorData.ejesTematicos as Array<{ id: string; nombre: string; slug: string; color: string }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                    Ejes temáticos a incluir
                                    <span className="text-[9px] font-normal text-muted-foreground">
                                      {(generatorFiltros.ejes?.length || 0)} de {(generatorData.ejesTematicos as Array<unknown>).length} seleccionados
                                    </span>
                                  </label>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {(generatorData.ejesTematicos as Array<{ id: string; nombre: string; slug: string; color: string }>).map((eje) => {
                                      const isSelected = (generatorFiltros.ejes || []).includes(eje.slug);
                                      const ejeMenciones = (generatorData.ejesConMenciones as Array<{ slug: string; count: number }>)?.find(ec => ec.slug === eje.slug);
                                      return (
                                        <button
                                          key={eje.id}
                                          onClick={() => toggleGeneratorEje(eje.slug)}
                                          className={`
                                            flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-[11px]
                                            ${isSelected
                                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                                            }
                                          `}
                                        >
                                          <div className="h-4 w-4 rounded flex items-center justify-center shrink-0 border"
                                            style={{
                                              borderColor: isSelected ? (eje.color || 'var(--primary)') : undefined,
                                              backgroundColor: isSelected ? (eje.color || 'var(--primary)') + '30' : undefined,
                                            }}
                                          >
                                            {isSelected && (
                                              <svg className="h-2.5 w-2.5" style={{ color: eje.color || 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-medium text-foreground truncate block">{eje.nombre}</span>
                                            {ejeMenciones && ejeMenciones.count > 0 && (
                                              <span className="text-[9px] text-muted-foreground">{ejeMenciones.count} menc.</span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Resumen de menciones y clima */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Clima / Sentimiento */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    {selectedGenerator === 'EL_TERMOMETRO'
                                      ? <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                                      : <Scale className="h-3.5 w-3.5 text-purple-500" />
                                    }
                                    {selectedGenerator === 'EL_TERMOMETRO' ? 'Indicador de Clima' : 'Balance de Sentimiento'}
                                  </p>
                                  {(generatorData.sentimientoResumen as { promedio: number; label: string; distribucion: Record<string, number> }) && (
                                    <>
                                      <div className="flex items-center gap-3">
                                        <div className="text-2xl font-bold text-foreground">
                                          {(generatorData.sentimientoResumen as { promedio: number }).promedio.toFixed(1)}
                                        </div>
                                        <div className="flex-1">
                                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{
                                                width: `${((generatorData.sentimientoResumen as { promedio: number }).promedio / 5) * 100}%`,
                                                backgroundColor: (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5
                                                  ? '#10B981'
                                                  : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5
                                                    ? '#F59E0B'
                                                    : '#EF4444',
                                              }}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[9px] text-muted-foreground">Negativo</span>
                                            <span className={`text-[10px] font-semibold ${
                                              (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5
                                                  ? 'text-amber-600 dark:text-amber-400'
                                                  : 'text-red-600 dark:text-red-400'
                                            }`}>
                                              {(generatorData.sentimientoResumen as { label: string }).label.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">Positivo</span>
                                          </div>
                                        </div>
                                      </div>
                                      {/* Distribución */}
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {Object.entries((generatorData.sentimientoResumen as { distribucion: Record<string, number> }).distribucion)
                                          .sort(([, a], [, b]) => b - a)
                                          .slice(0, 4)
                                          .map(([sent, count]) => (
                                            <span key={sent} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[sent] || 'bg-muted text-muted-foreground'}`}>
                                              {sent.replace('_', ' ')} ({count})
                                            </span>
                                          ))
                                        }
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Total menciones + top actores / ejes */}
                                <div className="p-4 rounded-xl border border-border space-y-3">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Resumen de actividad
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-foreground">{(generatorData.totalMenciones as number) || 0}</span>
                                    <span className="text-xs text-muted-foreground">menciones</span>
                                  </div>
                                  {selectedGenerator === 'EL_TERMOMETRO' && (
                                    <>
                                      <p className="text-[10px] font-medium text-muted-foreground">Top 3 actores nocturnos</p>
                                      <div className="space-y-1.5">
                                        {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>)?.slice(0, 3).map((actor, i) => (
                                          <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                                            <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                              #{i + 1}
                                            </span>
                                            <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                                            <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                                            <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{actor.count}</Badge>
                                          </div>
                                        )) || (
                                          <p className="text-[10px] text-muted-foreground italic">Sin actores en la ventana</p>
                                        )}
                                      </div>
                                    </>
                                  )}
                                  {selectedGenerator === 'SALDO_DEL_DIA' && (
                                    <>
                                      <p className="text-[10px] font-medium text-muted-foreground">Top 3 ejes del día</p>
                                      <div className="space-y-1.5">
                                        {(generatorData.topEjes as Array<{ nombre: string; slug: string; count: number; color: string }>)?.slice(0, 3).map((eje, i) => (
                                          <div key={eje.slug} className="flex items-center gap-2 text-[10px]">
                                            <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                              #{i + 1}
                                            </span>
                                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: eje.color || '#6B7280' }} />
                                            <span className="text-foreground font-medium truncate">{eje.nombre}</span>
                                            <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{eje.count}</Badge>
                                          </div>
                                        )) || (
                                          <p className="text-[10px] text-muted-foreground italic">Sin ejes con actividad</p>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Menciones recientes (preview) */}
                              {(generatorData.menciones as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string }>)?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                                    Menciones recientes
                                    <span className="text-[9px] font-normal text-muted-foreground">
                                      (máx. 50 de {(generatorData.totalMenciones as number)})
                                    </span>
                                  </p>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {(generatorData.menciones as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string }>).slice(0, 15).map((m) => (
                                      <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                                          {(m.sentimiento || '').replace('_', ' ')}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                                          <p className="text-[9px] text-muted-foreground">
                                            {m.persona?.nombre && <span>{m.persona.nombre} · </span>}
                                            {new Date(m.fechaCaptura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">No se pudieron cargar los datos</p>
                        </div>
                      )}
                    </div>

                    {/* ── FOOTER (data-driven) ── */}
                    {(() => {
                      const prod = ALL_PRODUCTS.find(p => p.tipo === selectedGenerator);
                      const productColor = prod?.color || '#6B7280';
                      const ProductIcon = prod?.icon || Zap;
                      const productConfig = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS];
                      const tieneFases = productConfig?.generador?.tieneFases;
                      const inAnalisis = tieneFases && (generatorData?.fase as string) === 'analisis';

                      // Determine button disabled state
                      const disabled = generatorGenerating || generatorDataLoading
                        || !generatorData
                        || (tieneFases && !inAnalisis);

                      // Button label: append context for phased products
                      let buttonLabel = `Generar ${prod?.nombre || selectedGenerator}`;
                      if (tieneFases && generatorData?.ejeSeleccionado) {
                        buttonLabel += `: ${(generatorData.ejeSeleccionado as { nombre: string }).nombre}`;
                      }

                      return (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
                          <Button variant="ghost" size="sm" onClick={closeGeneratorPanel} className="text-xs">
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleGenerateFromPanel}
                            disabled={disabled}
                            className="text-xs gap-1.5"
                            style={{ backgroundColor: productColor, borderColor: productColor }}
                          >
                            {generatorGenerating
                              ? <><Loader2 className="h-3 w-3 animate-spin" /> Generando...</>
                              : <><ProductIcon className="h-3 w-3" /> {buttonLabel}</>
                            }
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
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
              {/* ── Health Check de Fuentes ── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Salud de Fuentes
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Detección de medios inactivos, degradados o con errores
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadMediosHealth} disabled={mediosHealthLoading} className="text-xs gap-1">
                      {mediosHealthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Verificar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {mediosHealth ? (
                    <div className="space-y-3">
                      {/* KPIs de salud */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="text-center p-2 rounded bg-background">
                          <p className="text-lg font-bold text-foreground">{mediosHealth.resumen.total}</p>
                          <p className="text-[10px] text-muted-foreground">Fuentes</p>
                        </div>
                        <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                          <p className="text-lg font-bold text-emerald-600">{mediosHealth.resumen.sanos}</p>
                          <p className="text-[10px] text-muted-foreground">Sanas</p>
                        </div>
                        <div className="text-center p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                          <p className="text-lg font-bold text-amber-600">{mediosHealth.resumen.degradados}</p>
                          <p className="text-[10px] text-muted-foreground">Degradadas</p>
                        </div>
                        <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/20">
                          <p className="text-lg font-bold text-red-600">{mediosHealth.resumen.muertos}</p>
                          <p className="text-[10px] text-muted-foreground">Muertas</p>
                        </div>
                        <div className="text-center p-2 rounded bg-purple-50 dark:bg-purple-950/20">
                          <p className="text-lg font-bold text-purple-600">{mediosHealth.resumen.conErrores}</p>
                          <p className="text-[10px] text-muted-foreground">Con errores</p>
                        </div>
                      </div>

                      {/* Barra de salud global */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-muted-foreground">Cobertura saludable</span>
                          <span className="text-[10px] font-bold">{mediosHealth.resumen.porcentajeSalud}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${mediosHealth.resumen.porcentajeSalud}%` }}
                          />
                        </div>
                      </div>

                      {/* Medios con alertas */}
                      {mediosHealth.medios.filter(m => m.salud !== 'sano').length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Alertas activas
                          </p>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
                            {mediosHealth.medios.filter(m => m.salud !== 'sano').map(m => (
                              <div key={m.id} className="p-2 rounded-lg border border-border bg-muted/30">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      m.salud === 'muerto' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                      m.salud === 'degradado' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                    }`}>
                                      {m.salud === 'muerto' ? 'MUERTA' : m.salud === 'degradado' ? 'DEGRADADA' : 'ERRORES'}
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">{m.nombre}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{m.menciones30dias} menc. / 30d</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{m.alerta}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resumen por nivel */}
                      {mediosHealth.porNivel.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground">Cobertura por nivel</p>
                          {mediosHealth.porNivel.map(n => (
                            <div key={n.nivel} className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground w-28 shrink-0 truncate">{n.label}</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${n.total > 0 ? (n.sanos / n.total) * 100 : 0}%` }} />
                              </div>
                              <span className="text-[9px] font-medium text-muted-foreground w-14 text-right">{n.sanos}/{n.total}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : mediosHealthLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Presiona "Verificar" para analizar el estado de las fuentes</p>
                  )}
                </CardContent>
              </Card>

              {/* ── Captura Manual ── */}
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
                    <p>La Razón, El Deber, Los Tiempos, Opinión, Correo del Sur, El Potosí, La Patria, El Diario, Jornada, Unitel, Red Uno, ATB Digital, Bolivia Verifica, ABI, eju.tv, El Mundo, Visión 360</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: BOLETINES (Historial de Entregas)
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'boletines' && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard icon={<Mail className="h-5 w-5" />} value={ALL_PRODUCTS.length} label="Productos" colorClass="text-primary" />
                <KPICard icon={<CheckCircle2 className="h-5 w-5" />} value={entregasStats?.enviadasHoy || 0} label="Enviadas hoy" colorClass="text-emerald-600 dark:text-emerald-400" />
                <KPICard icon={<XCircle className="h-5 w-5" />} value={entregasStats?.fallidasHoy || 0} label="Fallidas hoy" colorClass="text-red-600 dark:text-red-400" />
                <KPICard icon={<AlertTriangle className="h-5 w-5" />} value={entregasStats?.pendientes || 0} label="Pendientes" colorClass="text-amber-600 dark:text-amber-400" />
              </div>

              {/* Filtros + Lista */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Historial de Entregas
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {entregas?.length || 0} entregas registradas
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={entregasFilterTipo}
                        onChange={(e) => { setEntregasFilterTipo(e.target.value); loadedViews.current.delete('boletines'); }}
                        className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                      >
                        <option value="todos">Todos los productos</option>
                        {ALL_PRODUCTS.map((p) => (
                          <option key={p.tipo} value={p.tipo}>{p.nombre}</option>
                        ))}
                      </select>
                      <select
                        value={entregasFilterEstado}
                        onChange={(e) => { setEntregasFilterEstado(e.target.value); loadedViews.current.delete('boletines'); }}
                        className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                      >
                        <option value="todos">Todos los estados</option>
                        <option value="enviado">Enviado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="fallido">Fallido</option>
                      </select>
                      <Button variant="outline" size="sm" onClick={() => { loadedViews.current.delete('boletines'); loadEntregas(); }} className="text-xs gap-1">
                        <RefreshCw className="h-3 w-3" /> Actualizar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {entregasLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : entregas && entregas.length > 0 ? (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {entregas.map((e) => {
                        const prodInfo = ALL_PRODUCTS.find(p => p.tipo === e.tipoBoletin);
                        const ProdIcon = prodInfo?.icon || FileText;
                        const clienteNombre = e.contrato?.cliente?.nombre || '—';
                        return (
                          <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (prodInfo?.color || '#6B7280') + '20' }}>
                              <ProdIcon className="h-4 w-4" style={{ color: prodInfo?.color || '#6B7280' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-foreground">{prodInfo?.nombre || e.tipoBoletin.replace(/_/g, ' ')}</p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  e.estado === 'enviado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : e.estado === 'fallido' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}>
                                  {e.estado === 'enviado' ? '✓ Enviado' : e.estado === 'fallido' ? '✗ Fallido' : '⏳ Pendiente'}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                                  {e.canal}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-[10px] text-muted-foreground">{clienteNombre}</p>
                                <span className="text-[10px] text-muted-foreground/40">|</span>
                                <p className="text-[10px] text-muted-foreground">
                                  {e.fechaEnvio ? new Date(e.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
                                </p>
                              </div>
                              {e.error && <p className="text-[10px] text-red-500 mt-0.5">{e.error}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.contenido && (
                                <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(e as never)} className="text-[10px] gap-1 h-7 px-2">
                                  <Eye className="h-3 w-3" /> Vista previa
                                </Button>
                              )}
                              {e.contenido && (
                                <Button variant="outline" size="sm" onClick={() => {
                                  const blob = new Blob([e.contenido], { type: 'text/html;charset=utf-8' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${e.tipoBoletin.replace(/_/g, '-')}-${e.fechaEnvio ? new Date(e.fechaEnvio).toISOString().slice(0, 10) : 'sin-fecha'}.html`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }} className="text-[10px] gap-1 h-7 px-2">
                                  <FileText className="h-3 w-3" /> Descargar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground">No hay entregas registradas</p>
                      <p className="text-xs text-muted-foreground mt-1">Las entregas aparecerán aquí cuando se generen y envíen boletines</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Modal Vista Previa */}
              {previewEntrega && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewEntrega(null)}>
                  <div className="bg-card rounded-xl shadow-xl border border-border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {ALL_PRODUCTS.find(p => p.tipo === previewEntrega.tipoBoletin)?.nombre || previewEntrega.tipoBoletin.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          {previewEntrega.contrato?.cliente?.nombre || '—'} · {previewEntrega.canal}
                          {previewEntrega.fechaEnvio && ` · ${new Date(previewEntrega.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(null)} className="h-7 w-7 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewEntrega.contenido }} />
                    </div>
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
                      <Button variant="outline" size="sm" onClick={() => {
                        const blob = new Blob([previewEntrega.contenido], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${previewEntrega.tipoBoletin.replace(/_/g, '-')}-${previewEntrega.fechaEnvio ? new Date(previewEntrega.fechaEnvio).toISOString().slice(0, 10) : 'preview'}.html`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }} className="text-xs gap-1">
                        <FileText className="h-3 w-3" /> Descargar HTML
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(null)} className="text-xs">Cerrar</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: ALERTAS
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'alertas' && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-red-500" />
                    Alerta Temprana
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Detección en tiempo real de crisis y picos de sentimiento negativo
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {/* Product info card */}
                  <div className="p-4 rounded-lg border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                        <Bell className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-foreground">Alerta Temprana</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Premium Alta</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠️ Definido</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-[10px] text-muted-foreground">🕐 Inmediata</span>
                          <span className="text-[10px] text-muted-foreground">📱 WhatsApp</span>
                          <span className="text-[10px] text-muted-foreground">⏱ 1 min lectura</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Placeholder section */}
                  <div className="p-6 rounded-lg border border-dashed border-border text-center space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                      <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Monitoreo de alertas en tiempo real</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        Próximamente: detección automática de picos de sentimiento negativo y crisis.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      En desarrollo
                    </div>
                  </div>

                  {/* Configuration placeholder */}
                  <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                    <h4 className="text-xs font-semibold text-foreground">Configuración futura</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg border border-border">
                        <p className="text-[11px] font-medium text-foreground">Umbral de sentimiento</p>
                        <p className="text-[10px] text-muted-foreground">Configurar nivel de alerta: negativo, crítico, elogioso</p>
                      </div>
                      <div className="p-3 rounded-lg border border-border">
                        <p className="text-[11px] font-medium text-foreground">Sujetos monitoreados</p>
                        <p className="text-[10px] text-muted-foreground">Seleccionar legisladores y temas para alertas</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: ESTRATEGIA (Documento Vivo)
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'estrategia' && (() => {
            const sec = ESTRATEGIA_SECCIONES[estrategiaSeccion];
            const SeccionIcon = sec.icon;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* TOC */}
                <div className="lg:col-span-3">
                  <Card className="sticky top-20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2">
                        <Rocket className="h-3.5 w-3.5 text-primary" />
                        Estrategia Comercial
                      </CardTitle>
                      <CardDescription className="text-[10px]">v0.7.0 · Mayo 2025</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <nav className="space-y-0.5">
                        {ESTRATEGIA_SECCIONES.map((s, i) => {
                          const SIcon = s.icon;
                          const isActive = i === estrategiaSeccion;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setEstrategiaSeccion(i)}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[11px] font-medium transition-colors text-left ${
                                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <SIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{s.titulo}</span>
                            </button>
                          );
                        })}
                      </nav>
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-[9px] text-muted-foreground/60">Fuente: DECODEX_Estrategia_Comercial.pdf</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Content */}
                <div className="lg:col-span-9 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <SeccionIcon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-sm font-semibold">{sec.titulo}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {sec.id === 'resumen' && (
                        <div className="space-y-4">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.contenido}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {sec.kpis?.map((kpi) => (
                              <div key={kpi.label} className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                                <p className="text-lg font-bold text-primary">{kpi.value}</p>
                                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sec.id === 'vision' && (
                        <div className="space-y-4">
                          {sec.secciones?.map((s) => (
                            <div key={s.subtitulo}>
                              <h4 className="text-xs font-semibold text-foreground mb-1.5">{s.subtitulo}</h4>
                              <p className="text-xs text-foreground/80 leading-relaxed">{s.texto}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {sec.id === 'catalogo' && (
                        <div className="space-y-4">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[10px]">Producto</TableHead>
                                  <TableHead className="text-[10px]">Frec.</TableHead>
                                  <TableHead className="text-[10px] hidden sm:table-cell">Horario</TableHead>
                                  <TableHead className="text-[10px] hidden md:table-cell">Canales</TableHead>
                                  <TableHead className="text-[10px]">Precio</TableHead>
                                  <TableHead className="text-[10px]">Estado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sec.productos?.map((p) => (
                                  <TableRow key={p.nombre}>
                                    <TableCell className="py-2 text-xs font-medium">{p.nombre}</TableCell>
                                    <TableCell className="py-2 text-[10px] text-muted-foreground">{p.frec}</TableCell>
                                    <TableCell className="py-2 text-[10px] text-muted-foreground hidden sm:table-cell">{p.horario}</TableCell>
                                    <TableCell className="py-2 text-[10px] text-muted-foreground hidden md:table-cell">{p.canales}</TableCell>
                                    <TableCell className="py-2 text-[10px] font-semibold">{p.precio}</TableCell>
                                    <TableCell className="py-2">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.estado === 'operativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                        {p.estado === 'operativo' ? '✅ Op.' : '⚠️ Def.'}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <h4 className="text-xs font-semibold text-foreground">Combos Estratégicos</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sec.combos?.map((c) => (
                              <div key={c.nombre} className="p-2.5 rounded-lg border border-border">
                                <p className="text-[11px] font-semibold text-foreground">{c.nombre}</p>
                                <p className="text-[10px] text-muted-foreground">{c.incluye}</p>
                                <p className="text-[10px] font-bold text-primary mt-1">{c.precio}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sec.id === 'segmentacion' && (
                        <div className="space-y-3">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-[10px]">Segmento</TableHead>
                                  <TableHead className="text-[10px]">Prioridad</TableHead>
                                  <TableHead className="text-[10px] hidden sm:table-cell">Actores</TableHead>
                                  <TableHead className="text-[10px]">Mercado</TableHead>
                                  <TableHead className="text-[10px] hidden md:table-cell">Ticket</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sec.segmentos?.map((s) => (
                                  <TableRow key={s.nombre}>
                                    <TableCell className="py-2 text-[11px] font-medium">{s.nombre}</TableCell>
                                    <TableCell className="py-2">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s.prioridad === 'Alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : s.prioridad === 'Media-Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : s.prioridad === 'Media' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800/40 dark:text-stone-300'}`}>{s.prioridad}</span>
                                    </TableCell>
                                    <TableCell className="py-2 text-[10px] text-muted-foreground hidden sm:table-cell">{s.actores}</TableCell>
                                    <TableCell className="py-2 text-[10px] font-semibold">{s.mercado}</TableCell>
                                    <TableCell className="py-2 text-[10px] text-muted-foreground hidden md:table-cell">{s.ticket}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                      {sec.id === 'ingresos' && (
                        <div className="space-y-4">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                          <div className="space-y-2">
                            {sec.fuentes?.map((f) => (
                              <div key={f.nombre} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-primary w-8 text-right">{f.pct}%</span>
                                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/20 rounded-full" style={{ width: `${f.pct}%` }} /></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-foreground truncate">{f.nombre}</p>
                                  <p className="text-[9px] text-muted-foreground truncate">{f.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <h4 className="text-xs font-semibold text-foreground mt-4">Proyección por Fase</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {sec.proyeccion?.map((p) => (
                              <div key={p.fase} className="p-2.5 rounded-lg border border-border text-center">
                                <p className="text-[10px] text-muted-foreground">{p.fase}</p>
                                <p className="text-[10px] text-muted-foreground/60">{p.periodo}</p>
                                <p className="text-sm font-bold text-primary mt-1">{p.ingresos}</p>
                                <p className="text-[9px] text-muted-foreground">{p.clientes} clientes</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {sec.id === 'embudo' && (
                        <div className="space-y-3">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                          {sec.niveles?.map((n) => (
                            <div key={n.nivel} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{n.nivel}</span></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2"><p className="text-xs font-semibold text-foreground">{n.nombre}</p><span className="text-[10px] font-bold text-primary">{n.contactos}</span></div>
                                <p className="text-[10px] text-muted-foreground">{n.accion}</p>
                                <p className="text-[9px] text-muted-foreground/60">{n.conversion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {sec.id === 'roadmap' && (
                        <div className="space-y-3">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                          {sec.fases?.map((f) => (
                            <div key={f.nombre} className={`p-3 rounded-lg border-l-4 ${f.estado === 'en_curso' ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-l-muted-foreground/30 bg-muted/30'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-semibold text-foreground">{f.nombre}</p>
                                <span className="text-[10px] text-muted-foreground">{f.periodo}</span>
                                {f.estado === 'en_curso' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">En curso</span>}
                                {f.estado === 'pendiente' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-stone-100 text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">Pendiente</span>}
                              </div>
                              <p className="text-[10px] text-foreground/70 leading-relaxed">{f.detalle}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {sec.id === 'expansion' && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-foreground mb-2">Expansión Vertical</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {sec.vertical?.map((v) => (
                                <div key={v.nombre} className="p-3 rounded-lg border border-border">
                                  <p className="text-[11px] font-semibold text-foreground">{v.nombre}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{v.desc}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-foreground mb-2">Expansión Horizontal</h4>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader><TableRow><TableHead className="text-[10px]">Mercado</TableHead><TableHead className="text-[10px]">Prioridad</TableHead><TableHead className="text-[10px]">Justificación</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {sec.horizontal?.map((h) => (
                                    <TableRow key={h.mercado}>
                                      <TableCell className="py-2 text-[11px] font-medium">{h.mercado}</TableCell>
                                      <TableCell className="py-2"><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${h.prioridad === 'Alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : h.prioridad === 'Media-Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'}`}>{h.prioridad}</span></TableCell>
                                      <TableCell className="py-2 text-[10px] text-muted-foreground">{h.justificacion}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      )}
                      {sec.id === 'ventajas' && (
                        <div className="space-y-3">
                          {sec.ventajas?.map((v) => (
                            <div key={v.nombre} className="p-3 rounded-lg border border-border">
                              <p className="text-xs font-semibold text-foreground mb-1">{v.nombre}</p>
                              <p className="text-[10px] text-foreground/80 leading-relaxed">{v.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {sec.id === 'estado' && (
                        <div className="space-y-3">
                          <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                          {sec.estadoProductos?.map((p) => (
                            <div key={p.nombre} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${p.estado === 'operativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{p.estado === 'operativo' ? '✅' : '⚠️'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-foreground">{p.nombre}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{p.detalle}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                        <Button variant="outline" size="sm" onClick={() => setEstrategiaSeccion(Math.max(0, estrategiaSeccion - 1))} disabled={estrategiaSeccion === 0} className="text-xs gap-1"><ChevronLeft className="h-3 w-3" /> Anterior</Button>
                        <span className="text-[10px] text-muted-foreground">{estrategiaSeccion + 1} / {ESTRATEGIA_SECCIONES.length}</span>
                        <Button variant="outline" size="sm" onClick={() => setEstrategiaSeccion(Math.min(ESTRATEGIA_SECCIONES.length - 1, estrategiaSeccion + 1))} disabled={estrategiaSeccion === ESTRATEGIA_SECCIONES.length - 1} className="text-xs gap-1">Siguiente <ChevronRight className="h-3 w-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════
              VIEW: INDICADORES — Workspace Analítico
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'indicadores' && (
            <div className="space-y-4">
              {/* ── Tab Navigation ── */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
                {([
                  { id: 'macro' as const, label: 'Macroeconomía', icon: TrendingUp, desc: 'TC, reserva, inflación, minería' },
                  { id: 'presencia' as const, label: 'Presencia Mediática', icon: Newspaper, desc: 'Menciones por partido, ranking de actores' },
                  { id: 'conflictividad' as const, label: 'Conflictividad', icon: AlertTriangle, desc: 'Tensión social y escalamiento' },
                ]).map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setIndicadoresTab(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                        indicadoresTab === tab.id
                          ? 'bg-background text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                      }`}
                    >
                      <TabIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* ═════════ TAB: MACROECONOMÍA ═════════ */}
              {indicadoresTab === 'macro' && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          Indicadores Macroeconómicos
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {indicadoresHistorico
                            ? `${indicadoresHistorico.conDatos} de ${indicadoresHistorico.totalIndicadores} con datos · Período: ${indicadoresPeriodo}`
                            : 'Datos macroeconómicos del ecosistema boliviano'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {['7d', '30d', '90d', '1y'].map(p => (
                          <button
                            key={p}
                            onClick={() => { setIndicadoresPeriodo(p); loadIndicadoresHistorico(); }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                              indicadoresPeriodo === p
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {p === '7d' ? '7 días' : p === '30d' ? '30 días' : p === '90d' ? '90 días' : '1 año'}
                          </button>
                        ))}
                        <select
                          value={indicadoresCategoria}
                          onChange={(e) => { setIndicadoresCategoria(e.target.value); loadIndicadoresHistorico(); }}
                          className="text-[10px] border border-border rounded-lg px-2 py-1 bg-background text-foreground"
                        >
                          <option value="">Todas las categorías</option>
                          <option value="monetario">Monetario</option>
                          <option value="minero">Minero</option>
                          <option value="social">Social</option>
                          <option value="economico">Económico</option>
                          <option value="hidrocarburos">Hidrocarburos</option>
                          <option value="climatico">Climático</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={handleCapturaIndicadores} disabled={capturaIndicadoresLoading} className="text-xs gap-1">
                          {capturaIndicadoresLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Capturar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {/* KPIs de cobertura */}
                    {indicadoresHistorico && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 rounded bg-background">
                          <p className="text-lg font-bold text-foreground">{indicadoresHistorico.totalIndicadores}</p>
                          <p className="text-[10px] text-muted-foreground">Indicadores</p>
                        </div>
                        <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                          <p className="text-lg font-bold text-emerald-600">{indicadoresHistorico.conDatos}</p>
                          <p className="text-[10px] text-muted-foreground">Con datos</p>
                        </div>
                        {indicadoresHistorico.porCategoria && Object.entries(indicadoresHistorico.porCategoria).map(([cat, data]) => (
                          <div key={cat} className="text-center p-2 rounded bg-background">
                            <p className="text-lg font-bold text-foreground">{data.conDatos}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{cat}</p>
                          </div>
                        )).slice(0, 2)}
                      </div>
                    )}

                    {/* Tabla de indicadores con estadísticas */}
                    {indicadoresLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : indicadoresHistorico && indicadoresHistorico.indicadores.length > 0 ? (
                      <div className="space-y-2 max-h-[700px] overflow-y-auto custom-scrollbar">
                        {indicadoresHistorico.indicadores.map((ind) => {
                          const tieneValor = ind.ultimoValor !== null;
                          const stats = ind.estadisticas;
                          const catColor = ind.categoria === 'monetario' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : ind.categoria === 'minero' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : ind.categoria === 'social' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';

                          return (
                            <div key={ind.slug} className="p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                              {/* Fila principal */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${catColor}`}>{ind.categoriaLabel}</span>
                                  <span className="text-xs font-semibold text-foreground truncate">{ind.nombre}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {stats && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      stats.tendencia === 'ascendente' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                      : stats.tendencia === 'descendente' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                      : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                                    }`}>
                                      {stats.tendencia === 'ascendente' ? '↑' : stats.tendencia === 'descendente' ? '↓' : '→'} {stats.diffPct > 0 ? '+' : ''}{stats.diffPct}%
                                    </span>
                                  )}
                                  <p className={`text-sm font-bold ${tieneValor ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground">{ind.unidad}</span>
                                </div>
                              </div>

                              {/* Estadísticas expandidas */}
                              {stats && (
                                <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 pl-1">
                                  <div className="text-[9px] text-muted-foreground">
                                    <span className="font-medium text-foreground">{stats.puntos}</span> pts en {stats.periodo}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    Mín: <span className="font-medium text-foreground">{stats.min}</span>
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    Máx: <span className="font-medium text-foreground">{stats.max}</span>
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    Prom: <span className="font-medium text-foreground">{stats.promedio}</span>
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">
                                    Var: <span className={`font-medium ${
                                      stats.variacionPeriodo.startsWith('+') ? 'text-emerald-600'
                                      : stats.variacionPeriodo.startsWith('-') ? 'text-red-600' : 'text-foreground'
                                    }`}>{stats.variacionPeriodo}</span>
                                  </div>
                                </div>
                              )}

                              {/* Mini serie temporal */}
                              {ind.historial.length > 1 && (
                                <div className="mt-2 flex items-end gap-px h-8 pl-1">
                                  {ind.historial.slice(-20).map((h, i) => {
                                    const vals = ind.historial.map(v => v.valorRaw).filter(v => v > 0);
                                    const minV = Math.min(...vals);
                                    const maxV = Math.max(...vals);
                                    const range = maxV - minV || 1;
                                    const height = Math.max(4, ((h.valorRaw - minV) / range) * 100);
                                    return (
                                      <div
                                        key={i}
                                        className="flex-1 rounded-t-sm bg-primary/30 hover:bg-primary/50 transition-colors min-w-[3px] cursor-default"
                                        style={{ height: `${height}%` }}
                                        title={`${h.fecha}: ${h.valor} ${ind.unidad}`}
                                      />
                                    );
                                  })}
                                </div>
                              )}

                              {/* Fuente y última captura */}
                              <div className="mt-1.5 flex items-center justify-between pl-1">
                                <span className="text-[9px] text-muted-foreground">Fuente: {ind.fuente}</span>
                                {tieneValor && ind.ultimoValor!.fechaCaptura && (
                                  <span className="text-[9px] text-muted-foreground">
                                    {new Date(ind.ultimoValor!.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground">Sin datos de indicadores para el período seleccionado.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ═════════ TAB: PRESENCIA MEDIÁTICA ═════════ */}
              {indicadoresTab === 'presencia' && (
                <div className="space-y-4">
                  {/* KPIs de presencia */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KPICard
                      icon={<Users className="h-5 w-5" />}
                      value={data?.mencionesSemana || 0}
                      label="Menciones semana"
                      subtext={`${data?.mencionesHoy || 0} hoy`}
                      colorClass="text-sky-600 dark:text-sky-400"
                    />
                    <KPICard
                      icon={<BarChart3 className="h-5 w-5" />}
                      value={data?.mencionesPorPartido?.length || 0}
                      label="Partidos monitoreados"
                      colorClass="text-purple-600 dark:text-purple-400"
                    />
                    <KPICard
                      icon={<TrendingUp className="h-5 w-5" />}
                      value={data?.topActores?.[0]?.mencionesCount || 0}
                      label="Máx. menciones individuales"
                      subtext={data?.topActores?.[0]?.nombre || '—'}
                      colorClass="text-amber-600 dark:text-amber-400"
                    />
                    <KPICard
                      icon={<Radio className="h-5 w-5" />}
                      value={data?.totalMedios || 0}
                      label="Medios en monitoreo"
                      subtext={`${data?.fuentesPorNivel?.length || 0} niveles de fuentes`}
                      colorClass="text-emerald-600 dark:text-emerald-400"
                    />
                  </div>

                  {/* Top 10 presencia mediática */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            Top 10 presencia mediática
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Actores con mayor presencia mediática · {indicadoresPeriodo === '7d' ? 'últimos 7 días' : indicadoresPeriodo === '30d' ? 'últimos 30 días' : indicadoresPeriodo === '90d' ? 'últimos 90 días' : 'último año'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {data?.topActores && data.topActores.length > 0 ? (
                        <div className="space-y-2">
                          {data.topActores.slice(0, 10).map((p, i) => {
                            const maxCount = data.topActores[0].mencionesCount || 1;
                            return (
                              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                }`}>{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold text-foreground truncate">{p.nombre}</p>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                                      backgroundColor: (PARTIDO_COLORS[p.partidoSigla] || '#6B7280') + '20',
                                      color: PARTIDO_TEXT_COLORS[p.partidoSigla] || 'text-foreground',
                                    }}>{p.partidoSigla}</span>
                                    <span className="text-[9px] text-muted-foreground">{p.camara}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${PARTIDO_COLORS[p.partidoSigla] || 'bg-stone-500'}`}
                                        style={{ width: `${Math.max((p.mencionesCount / maxCount) * 100, 3)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-foreground shrink-0">{p.mencionesCount}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">Sin datos de presencia para el período seleccionado</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Menciones por partido */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          Menciones por partido
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Distribución de menciones por agrupación política
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {data?.mencionesPorPartido && data.mencionesPorPartido.length > 0 ? (
                        <div className="space-y-2.5">
                          {data.mencionesPorPartido.map((p) => {
                            const maxCount = data.mencionesPorPartido[0].count || 1;
                            const total = data.mencionesPorPartido.reduce((s, x) => s + x.count, 0);
                            const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                            return (
                              <div key={p.partido} className="p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-semibold ${PARTIDO_TEXT_COLORS[p.partido] || 'text-foreground'}`}>{p.partido}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                                    <span className="text-[11px] font-bold text-foreground">{p.count}</span>
                                  </div>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${PARTIDO_COLORS[p.partido] || 'bg-stone-500'}`}
                                    style={{ width: `${Math.max((p.count / maxCount) * 100, 3)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">Sin datos por partido</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ═════════ TAB: CONFLICTIVIDAD ═════════ */}
              {indicadoresTab === 'conflictividad' && (
                <div className="space-y-4">
                  {/* KPIs de conflictividad */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(() => {
                      const indicadoresSocial = indicadores?.filter(i => i.categoria === 'social') || [];
                      const escalamiento = indicadoresSocial.find(i => i.slug === 'conflictividad-escalamiento');
                      const escValor = escalamiento?.ultimoValor?.valor || 'N/D';
                      const esAlto = escValor.toLowerCase().includes('alto');
                      const esMedio = escValor.toLowerCase().includes('medio');
                      return (
                        <>
                          <div className={`p-4 rounded-lg border ${esAlto ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' : esMedio ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'}`}>
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Nivel de escalamiento</p>
                            <p className={`text-xl font-bold ${esAlto ? 'text-red-600 dark:text-red-400' : esMedio ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{escValor}</p>
                          </div>
                          <div className="p-4 rounded-lg border border-border bg-muted/30">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Indicadores sociales</p>
                            <p className="text-xl font-bold text-foreground">{indicadoresSocial.length}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {indicadoresSocial.filter(i => i.ultimoValor !== null).length} con datos
                            </p>
                          </div>
                          <div className="p-4 rounded-lg border border-border bg-muted/30">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Período de análisis</p>
                            <p className="text-xl font-bold text-foreground">{indicadoresPeriodo === '7d' ? '7 días' : indicadoresPeriodo === '30d' ? '30 días' : indicadoresPeriodo === '90d' ? '90 días' : '1 año'}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Detalle de indicadores sociales */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Indicadores de conflictividad
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Tensión social y escalamiento regional · ONION200
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {['7d', '30d', '90d', '1y'].map(p => (
                            <button
                              key={p}
                              onClick={() => { setIndicadoresPeriodo(p); loadIndicadoresHistorico(); }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                                indicadoresPeriodo === p
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {p === '7d' ? '7d' : p === '30d' ? '30d' : p === '90d' ? '90d' : '1a'}
                            </button>
                          ))}
                          <Button variant="outline" size="sm" onClick={handleCapturaIndicadores} disabled={capturaIndicadoresLoading} className="text-xs gap-1">
                            {capturaIndicadoresLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {indicadoresLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : indicadoresHistorico && indicadoresHistorico.indicadores.filter(i => i.categoria === 'social').length > 0 ? (
                        <div className="space-y-3">
                          {indicadoresHistorico.indicadores.filter(i => i.categoria === 'social').map((ind) => {
                            const tieneValor = ind.ultimoValor !== null;
                            const stats = ind.estadisticas;
                            const esEscalamiento = ind.slug === 'conflictividad-escalamiento';
                            return (
                              <div key={ind.slug} className={`p-4 rounded-lg border transition-colors ${
                                esEscalamiento
                                  ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                                  : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                      {esEscalamiento ? 'Global' : 'Análisis'}
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">{ind.nombre}</span>
                                    {tieneValor && (
                                      <span className={`text-[9px] ${ind.ultimoValor!.confiable ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {ind.ultimoValor!.confiable ? '✓ confiable' : '⚠ verificar'}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-lg font-bold ${esEscalamiento && tieneValor && ind.ultimoValor!.valor.toLowerCase().includes('alto') ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                    {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                                  </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{ind.unidad} · Fuente: {ind.fuente}</p>

                                {/* Estadísticas históricas */}
                                {stats && (
                                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] text-muted-foreground">
                                    <div>Puntos: <span className="font-medium text-foreground">{stats.puntos}</span></div>
                                    <div>Mín: <span className="font-medium text-foreground">{stats.min}</span></div>
                                    <div>Máx: <span className="font-medium text-foreground">{stats.max}</span></div>
                                    <div>Tendencia: <span className={`font-medium ${
                                      stats.tendencia === 'ascendente' ? 'text-red-600' : stats.tendencia === 'descendente' ? 'text-emerald-600' : 'text-foreground'
                                    }`}>{stats.tendencia}</span></div>
                                  </div>
                                )}

                                {/* Mini serie temporal */}
                                {ind.historial.length > 1 && (
                                  <div className="mt-2 flex items-end gap-px h-6">
                                    {ind.historial.slice(-15).map((h, i) => {
                                      const vals = ind.historial.map(v => v.valorRaw).filter(v => v > 0);
                                      const minV = Math.min(...vals);
                                      const maxV = Math.max(...vals);
                                      const range = maxV - minV || 1;
                                      const height = Math.max(4, ((h.valorRaw - minV) / range) * 100);
                                      return (
                                        <div
                                          key={i}
                                          className={`flex-1 rounded-t-sm min-w-[4px] cursor-default transition-colors ${esEscalamiento ? 'bg-red-400/40 hover:bg-red-400/70' : 'bg-orange-400/40 hover:bg-orange-400/70'}`}
                                          style={{ height: `${height}%` }}
                                          title={`${h.fecha}: ${h.valor}`}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                            Los indicadores de conflictividad se calculan a partir del análisis de menciones y keywords de protesta. Fuente: ONION200.
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-xs text-muted-foreground">Sin indicadores de conflictividad para el período seleccionado.</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">Usa el botón de captura para obtener datos actualizados.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: PRODUCTOS (Full catalog)
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'productos' && (
            <div className="space-y-6">
              {/* Overview KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard
                  icon={<Package className="h-5 w-5" />}
                  value={ALL_PRODUCTS.length}
                  label="Productos totales"
                  colorClass="text-primary"
                />
                <KPICard
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  value={ALL_PRODUCTS.filter(p => p.estado === 'operativo').length}
                  label="Operativos"
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <KPICard
                  icon={<FileBarChart className="h-5 w-5" />}
                  value={COMBOS.length}
                  label="Combos"
                  colorClass="text-purple-600 dark:text-purple-400"
                />
                <KPICard
                  icon={<Mail className="h-5 w-5" />}
                  value={4}
                  label="Canales"
                  subtext="WhatsApp, Email, Web, PDF"
                  colorClass="text-sky-600 dark:text-sky-400"
                />
              </div>

              {/* Products by category */}
              {PRODUCT_CATEGORIES.map((cat) => {
                const catProducts = ALL_PRODUCTS.filter(p => p.categoria === cat.id);
                if (catProducts.length === 0) return null;
                return (
                  <Card key={cat.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                        <CardTitle className="text-sm font-semibold">{catProducts.length} producto{catProducts.length > 1 ? 's' : ''}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catProducts.map((prod) => {
                          const ProdIcon = prod.icon;
                          const prodConfig = PRODUCTOS[prod.tipo];
                          return (
                            <div key={prod.tipo} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-all hover:shadow-sm">
                              <div className="flex items-start gap-3">
                                <div
                                  className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: prod.color + '20' }}
                                >
                                  <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      prod.estado === 'operativo'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : prod.estado === 'definido'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                          : 'bg-stone-100 text-stone-500'
                                    }`}>
                                      {prod.estado === 'operativo' ? '✅ Operativo' : prod.estado === 'definido' ? '⚠️ Definido' : '📋 Pendiente'}
                                    </span>
                                  </div>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${cat.color}`}>
                                    {cat.label}
                                  </span>
                                </div>
                              </div>
                              {prodConfig && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs text-muted-foreground leading-relaxed">{prodConfig.descripcion}</p>
                                  <div className="flex items-center flex-wrap gap-3 text-[10px] text-muted-foreground">
                                    <span>🕐 {prodConfig.horarioEnvio}</span>
                                    <span>📋 {prodConfig.longitudPaginas} pág.</span>
                                    <span>⏱ {prodConfig.longitudMinLectura} min lectura</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {prodConfig.canales.map((canal) => (
                                      <Badge key={canal} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {CANAL_LABELS[canal] || canal}
                                      </Badge>
                                    ))}
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                      {FRECUENCIA_LABELS[prodConfig.frecuencia] || prodConfig.frecuencia}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Combos section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileBarChart className="h-4 w-4 text-muted-foreground" />
                    Combos de Productos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {COMBOS.length} combos disponibles — desde Bs {Math.min(...COMBOS.map(c => c.precioMensual)).toLocaleString()} hasta Bs {Math.max(...COMBOS.map(c => c.precioMensual)).toLocaleString()}/mes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {COMBOS.map((combo) => (
                      <div key={combo.id} className="p-4 rounded-xl border-2 border-primary/20 hover:border-primary/40 transition-all bg-gradient-to-br from-primary/[0.02] to-transparent">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-foreground">{combo.nombre}</h4>
                          <Badge className="text-[10px] bg-primary text-primary-foreground font-bold">
                            Bs {combo.precioMensual.toLocaleString()}/mes
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{combo.descripcion}</p>
                        <Separator className="my-3" />
                        <div className="flex flex-wrap gap-1.5">
                          {combo.productos.map((tipo) => {
                            const prodInfo = ALL_PRODUCTS.find(p => p.tipo === tipo);
                            const ProdIcon = prodInfo?.icon || FileText;
                            return (
                              <span key={tipo} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted font-medium text-muted-foreground">
                                <ProdIcon className="h-3 w-3" style={{ color: prodInfo?.color }} />
                                {PRODUCTOS[tipo]?.nombreCorto || tipo.replace(/_/g, ' ')}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
