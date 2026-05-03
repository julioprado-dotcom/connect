/* ═══════════════════════════════════════════════════════════
   Types — DECODEX Bolivia Dashboard
   ═══════════════════════════════════════════════════════════ */

export interface ActorStat {
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

export interface PartidoStat {
  partido: string;
  count: number;
}

export interface MencionRow {
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

export interface DashboardData {
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

export interface PersonaListItem {
  id: string;
  nombre: string;
  camara: string;
  departamento: string;
  partido: string;
  partidoSigla: string;
}

export interface MedioItem {
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

export interface EjeItem {
  id: string;
  parentId: string | null;
  nombre: string;
  slug: string;
  icono: string;
  color: string;
  descripcion: string;
  keywords: string;
  dimension: string;
  activo: boolean;
  orden: number;
  mencionesCount: number;
  children?: EjeItem[];
}

export interface MediosHealthData {
  resumen: {
    total: number;
    sanos: number;
    degradados: number;
    muertos: number;
    conErrores: number;
    porcentajeSalud: number;
  };
  porNivel: Array<{
    nivel: number;
    label: string;
    total: number;
    sanos: number;
    problematicos: number;
  }>;
  medios: Array<{
    id: string;
    nombre: string;
    url: string;
    tipo: string;
    nivel: string;
    nivelLabel: string;
    totalMenciones: number;
    menciones7dias: number;
    menciones30dias: number;
    errorRate: number;
    salud: string;
    alerta: string;
    ultimaCaptura: string | null;
  }>;
}
