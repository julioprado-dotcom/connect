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
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { PRODUCTOS, COMBOS } from '@/constants/products';
import Image from 'next/image';
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
  { id: 'clientes', label: 'Clientes', icon: UserCircle },
  { id: 'contratos', label: 'Contratos', icon: FileCheck },
  { id: 'menciones', label: 'Menciones', icon: Newspaper },
  { id: 'clasificadores', label: 'Clasificadores', icon: Tag },
  { id: 'personas', label: 'Personas', icon: Users },
  { id: 'medios', label: 'Medios', icon: Radio },
  { id: 'boletines', label: 'Boletines', icon: Mail },
  { id: 'alertas', label: 'Alertas', icon: Bell },
  { id: 'estrategia', label: 'Estrategia', icon: Rocket },
  { id: 'reportes', label: 'Reportes', icon: FileBarChart },
  { id: 'captura', label: 'Captura', icon: Zap },
  { id: 'indicadores', label: 'Indicadores', icon: TrendingUp },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

/* ═══════════════════════════════════════════════════════════
   ALL PRODUCTS
   ═══════════════════════════════════════════════════════════ */

const ALL_PRODUCTS = [
  // Premium
  { tipo: 'EL_TERMOMETRO' as const, nombre: 'El Termómetro', icon: Thermometer, color: '#3B82F6', categoria: 'premium', estado: 'operativo' },
  { tipo: 'SALDO_DEL_DIA' as const, nombre: 'Saldo del Día', icon: Scale, color: '#8B5CF6', categoria: 'premium', estado: 'operativo' },
  { tipo: 'EL_FOCO' as const, nombre: 'El Foco', icon: Search, color: '#F59E0B', categoria: 'premium', estado: 'operativo' },
  { tipo: 'EL_INFORME_CERRADO' as const, nombre: 'El Informe Cerrado', icon: FileText, color: '#10B981', categoria: 'premium', estado: 'definido' },
  { tipo: 'FICHA_LEGISLADOR' as const, nombre: 'Ficha del Legislador', icon: UserCheck, color: '#06B6D4', categoria: 'premium', estado: 'definido' },
  { tipo: 'EL_ESPECIALIZADO' as const, nombre: 'El Especializado', icon: GraduationCap, color: '#EC4899', categoria: 'premium_mid', estado: 'definido' },
  // Premium Alta
  { tipo: 'ALERTA_TEMPRANA' as const, nombre: 'Alerta Temprana', icon: Bell, color: '#EF4444', categoria: 'premium_alta', estado: 'definido' },
  // Gratuitos
  { tipo: 'EL_RADAR' as const, nombre: 'El Radar', icon: Radio, color: '#22C55E', categoria: 'gratuito', estado: 'operativo' },
  { tipo: 'VOZ_Y_VOTO' as const, nombre: 'Voz y Voto', icon: ListChecks, color: '#6366F1', categoria: 'gratuito', estado: 'definido' },
  { tipo: 'EL_HILO' as const, nombre: 'El Hilo', icon: Link2, color: '#14B8A6', categoria: 'gratuito', estado: 'definido' },
  { tipo: 'FOCO_DE_LA_SEMANA' as const, nombre: 'Foco de la Semana', icon: Target, color: '#10B981', categoria: 'gratuito', estado: 'definido' },
];

const PRODUCT_CATEGORIES = [
  { id: 'premium', label: 'Premium', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  { id: 'premium_mid', label: 'Premium Mid', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'premium_alta', label: 'Premium Alta', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { id: 'gratuito', label: 'Gratuito', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
];

const CANAL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web',
  pdf: 'PDF',
};

const FRECUENCIA_LABELS: Record<string, string> = {
  diario_am: 'Diario (AM)',
  diario_pm: 'Diario (PM)',
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
  bajo_demanda: 'Bajo demanda',
  tiempo_real: 'Tiempo real',
};

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

  // Clientes
  const [clientes, setClientes] = useState<Record<string, unknown>[]>([]);
  const [clientesTotal, setClientesTotal] = useState(0);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');

  // Contratos
  const [contratos, setContratos] = useState<Record<string, unknown>[]>([]);
  const [contratosTotal, setContratosTotal] = useState(0);
  const [contratosLoading, setContratosLoading] = useState(false);

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
      else if (viewId === 'clientes') loadClientes();
      else if (viewId === 'contratos') loadContratos();
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
            <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden" style={{backgroundColor: '#0A1628'}}>
              <Image src="/logo.png" alt="CONNECT" width={36} height={36} className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
                CONNECT
              </h2>
              <p className="text-[10px] text-sidebar-foreground/60">Bolivia · Inteligencia Mediática</p>
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
                Pluralismo · ONION200 · Bolivia
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
                  CONNECT Bolivia — Motor ONION200
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
              VIEW: BOLETINES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'boletines' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <KPICard
                  icon={<Mail className="h-5 w-5" />}
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
                  icon={<AlertTriangle className="h-5 w-5" />}
                  value={ALL_PRODUCTS.filter(p => p.estado === 'definido').length}
                  label="Por definir"
                  colorClass="text-amber-600 dark:text-amber-400"
                />
                <KPICard
                  icon={<Users className="h-5 w-5" />}
                  value={COMBOS.length}
                  label="Combos disponibles"
                  colorClass="text-purple-600 dark:text-purple-400"
                />
              </div>

              {/* Products by category */}
              {PRODUCT_CATEGORIES.map((cat) => {
                const catProducts = ALL_PRODUCTS.filter(p => p.categoria === cat.id);
                if (catProducts.length === 0) return null;
                return (
                  <Card key={cat.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
                          Boletines ({catProducts.length})
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catProducts.map((prod) => {
                          const ProdIcon = prod.icon;
                          const prodConfig = PRODUCTOS[prod.tipo];
                          return (
                            <div key={prod.tipo} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
                              <div className="flex items-start gap-3">
                                <div
                                  className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: prod.color + '20' }}
                                >
                                  <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                      prod.estado === 'operativo'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    }`}>
                                      {prod.estado === 'operativo' ? '✅ Operativo' : '⚠️ Definido'}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cat.color}`}>
                                      {cat.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {prodConfig && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{prodConfig.descripcion}</p>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-muted-foreground">
                                      🕐 {prodConfig.horarioEnvio}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      📋 {prodConfig.longitudPaginas} pág.
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      ⏱ {prodConfig.longitudMinLectura} min.
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {prodConfig.canales.map((canal) => (
                                      <Badge key={canal} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {CANAL_LABELS[canal] || canal}
                                      </Badge>
                                    ))}
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

              {/* Combos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Combos de Productos ({COMBOS.length})
                  </CardTitle>
                  <CardDescription className="text-xs">Paquetes con precio especial para suscriptores</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {COMBOS.map((combo) => (
                      <div key={combo.id} className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 transition-colors bg-primary/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-foreground">{combo.nombre}</p>
                          <Badge className="text-[10px] bg-primary text-primary-foreground">
                            Bs {combo.precioMensual.toLocaleString()}/mes
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{combo.descripcion}</p>
                        <div className="flex flex-wrap gap-1">
                          {combo.productos.map((tipo) => {
                            const prodInfo = ALL_PRODUCTS.find(p => p.tipo === tipo);
                            const ProdIcon = prodInfo?.icon || FileText;
                            return (
                              <span key={tipo} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                <ProdIcon className="h-3 w-3" />
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
              VIEW: ESTRATEGIA
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'estrategia' && (
            <div className="space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard
                  icon={<Package className="h-5 w-5" />}
                  value={11}
                  label="Productos"
                  colorClass="text-primary"
                />
                <KPICard
                  icon={<FileBarChart className="h-5 w-5" />}
                  value={6}
                  label="Combos"
                  colorClass="text-purple-600 dark:text-purple-400"
                />
                <KPICard
                  icon={<Users className="h-5 w-5" />}
                  value={7}
                  label="Segmentos"
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <KPICard
                  icon={<TrendingUp className="h-5 w-5" />}
                  value={400}
                  label="Bs K/mes mercado"
                  subtext="Estimación TAM Bolivia"
                  colorClass="text-amber-600 dark:text-amber-400"
                />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-muted-foreground" />
                    Estrategia Comercial
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Hoja de ruta CONNECT Bolivia — Productos, segmentos y modelo de negocio
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {/* Strategy overview */}
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Rocket className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Modelo de negocio CONNECT</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Ecosistema de 11 productos de inteligencia mediática organizados en 4 categorías
                          (Premium, Premium Mid, Premium Alta, Gratuito) con 6 combos de venta
                          dirigidos a 7 segmentos del mercado boliviano.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Segmentos */}
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-3">Segmentos objetivo</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {[
                        { nombre: 'Embajadas', icon: Globe, desc: 'Diplomáticos en Bolivia' },
                        { nombre: 'Organismos Int.', icon: FileCheck, desc: 'ONU, BID, Banco Mundial' },
                        { nombre: 'Corporaciones', icon: Activity, desc: 'Grandes empresas' },
                        { nombre: 'Legisladores', icon: Users, desc: 'Diputados y Senadores' },
                        { nombre: 'Partidos Políticos', icon: BarChart3, desc: 'Direcciones de comunicación' },
                        { nombre: 'Medios', icon: Radio, desc: 'Periodistas y editores' },
                        { nombre: 'ONGs / Academia', icon: GraduationCap, desc: 'Investigación y advocacy' },
                      ].map((seg) => {
                        const SegIcon = seg.icon;
                        return (
                          <div key={seg.nombre} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <SegIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <p className="text-[11px] font-semibold text-foreground">{seg.nombre}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{seg.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Document reference */}
                  <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-semibold text-foreground">Documento completo</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Documento completo disponible: <span className="font-medium text-foreground">CONNECT_Bolivia_Estrategia_Comercial.pdf</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              VIEW: INDICADORES
              ═══════════════════════════════════════════════════════ */}
          {activeView === 'indicadores' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Indicadores de Métricas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estadísticas de uso y rendimiento del sistema CONNECT
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatItem label="Total menciones" value={String(data?.mencionesSemana || 0)} />
                    <StatItem label="Medios activos" value={String(data?.totalMedios || 0)} />
                    <StatItem label="Ejes temáticos" value={String(data?.totalEjes || 0)} />
                    <StatItem label="Legisladores" value={String(data?.totalPersonas || 0)} />
                  </div>
                  <div className="p-4 rounded-lg border border-dashed border-border text-center space-y-2">
                    <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">Próximamente: indicadores macroeconómicos y de mercado</p>
                  </div>
                </CardContent>
              </Card>
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
