// ─── Motor de Alertas Tempranas — DECODEX Bolivia ──────────────────────────
// Umbralerta de riesgo basados en el Apéndice Técnico A v1.0.
// Cada umbral define la lógica de evaluación por nivel (INFO/VIGILANCIA/ALERTA)
// para un indicador específico dentro de un eje estratégico.
//
// Principio D.8 extendido: Las alertas NO se inventan. Se generan
// exclusivamente a partir de datos cuantitativos contrastables.

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type EjeEstrategico =
  | 'MACRO'
  | 'SOCIAL'
  | 'ENERGIA'
  | 'POLITICA'
  | 'LOGISTICA'
  | 'AMBIENTE';

export type NivelAlerta = 'INFO' | 'VIGILANCIA' | 'ALERTA';

export interface UmbralAlerta {
  id: string;
  indicador: string;
  eje: EjeEstrategico;
  nombre: string;           // Nombre legible para productos
  fuente: string;           // Fuente de datos (BCB, LME, etc.)
  frecuencia: string;       // Diario, Semanal, etc.
  condicion: (valor: number, historial: HistorialPunto[]) => NivelAlerta;
  mensaje: (valor: number, nivel: NivelAlerta) => string;
}

export interface HistorialPunto {
  fecha: Date;
  valor: number;
}

// ─── Ejes Estratégicos ────────────────────────────────────────────────────

export const EJES: { key: EjeEstrategico; nombre: string; slug: string }[] = [
  { key: 'MACRO',      nombre: 'Macroeconomía, Divisas y Finanzas', slug: 'macroeconomia' },
  { key: 'SOCIAL',     nombre: 'Social, Laboral y Conflictividad',  slug: 'social' },
  { key: 'ENERGIA',    nombre: 'Energía e Hidrocarburos',          slug: 'energia' },
  { key: 'POLITICA',   nombre: 'Político-Institucional',           slug: 'politica' },
  { key: 'LOGISTICA',  nombre: 'Infraestructura y Logística',      slug: 'infraestructura' },
  { key: 'AMBIENTE',   nombre: 'Ambiental, Climático e Hídrico',   slug: 'ambiente' },
];

// ─── Matriz de Cruces Sistémicos ───────────────────────────────────────────

export interface CruceSistemico {
  id: string;
  ejeA: EjeEstrategico;
  ejeB: EjeEstrategico;
  nombre: string;
  activarSi: (estadoA: NivelAlerta, estadoB: NivelAlerta) => boolean;
  mensaje: string;
}

export const CRUCES_SISTEMICOS: CruceSistemico[] = [
  {
    id: 'CRISIS_BALANZA_COMERCIAL',
    ejeA: 'MACRO',
    ejeB: 'ENERGIA',
    nombre: 'Crisis de Balanza Comercial',
    activarSi: (a, b) => a === 'ALERTA' && (b === 'VIGILANCIA' || b === 'ALERTA'),
    mensaje: 'Caída de producción gas + presión cambiaria = riesgo de crisis de balanza comercial.',
  },
  {
    id: 'INESTABILIDAD_GABINETE',
    ejeA: 'SOCIAL',
    ejeB: 'POLITICA',
    nombre: 'Inestabilidad de Gabinete',
    activarSi: (a, b) => (a === 'VIGILANCIA' || a === 'ALERTA') && b === 'ALERTA',
    mensaje: 'Huelgas y crisis política simultáneas = riesgo de cambio de gabinete.',
  },
  {
    id: 'INFLACION_COSTOS_LOGISTICOS',
    ejeA: 'ENERGIA',
    ejeB: 'LOGISTICA',
    nombre: 'Inflación de Costos Logísticos',
    activarSi: (a, b) => a === 'ALERTA' && b === 'ALERTA',
    mensaje: 'Desabastecimiento energético + bloqueos = espiral de costos logísticos.',
  },
  {
    id: 'RIESGO_OPERATIVO_MINERO',
    ejeA: 'AMBIENTE',
    ejeB: 'ENERGIA',
    nombre: 'Riesgo Operativo Minero',
    activarSi: (a, b) => (a === 'VIGILANCIA' || a === 'ALERTA') && (b === 'VIGILANCIA' || b === 'ALERTA'),
    mensaje: 'Estrés hídrico + problemas energéticos = riesgo para operaciones mineras.',
  },
  {
    id: 'COLAPSO_EXPORTACIONES',
    ejeA: 'LOGISTICA',
    ejeB: 'MACRO',
    nombre: 'Colapso de Exportaciones',
    activarSi: (a, b) => a === 'ALERTA' && b === 'ALERTA',
    mensaje: 'Bloqueos prolongados + crisis cambiaria = colapso de cadenas exportadoras.',
  },
  {
    id: 'CRISIS_CAMBIARIA_INMINENTE',
    ejeA: 'MACRO',
    ejeB: 'POLITICA',
    nombre: 'Crisis Cambiaria Inminente',
    activarSi: (a, b) => a === 'ALERTA' && (b === 'VIGILANCIA' || b === 'ALERTA'),
    mensaje: 'Déficit fiscal + inestabilidad política = expectativas de devaluación y fuga de capitales.',
  },
];

// ─── Umbrales Críticos (6 Ejes × 4-5 Indicadores) ────────────────────────
// Basados directamente en la Matriz de Riesgo del Apéndice Técnico A v1.0.

export const UMBRALES_CRITICOS: UmbralAlerta[] = [
  // ── EJE 1: MACROECONOMÍA ──────────────────────────────────────────────
  {
    id: 'MACRO_BRECHA_CAMBIARIA',
    indicador: 'brecha_cambiaria_porcentual',
    eje: 'MACRO',
    nombre: 'Brecha Dólar (Paralelo vs Oficial)',
    fuente: 'Dólar Blue Bolivia, Prensa',
    frecuencia: 'Diario',
    condicion: (valor: number, historial: HistorialPunto[]): NivelAlerta => {
      if (valor > 15) return 'ALERTA';
      if (valor > 10) return 'VIGILANCIA';
      // Verificar salto intradía (>2% en un día)
      if (historial.length >= 2) {
        const anterior = historial[historial.length - 2].valor;
        const variacionDiaria = Math.abs((valor - anterior) / anterior * 100);
        if (variacionDiaria > 2) return 'ALERTA';
      }
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return `Brecha cambiaria CRÍTICA: ${val.toFixed(1)}% (Umbral alerta >15%)`;
      return `Brecha cambiaria elevada: ${val.toFixed(1)}% (Precaución >10%)`;
    },
  },
  {
    id: 'MACRO_RIN_CAIDA',
    indicador: 'rin_variacion_semanal_mm_usd',
    eje: 'MACRO',
    nombre: 'Reservas Internacionales (RIN)',
    fuente: 'BCB (comunicados)',
    frecuencia: 'Semanal',
    condicion: (valor: number): NivelAlerta => {
      // valor es la variación semanal en MM USD (negativo = caída)
      if (valor < -100) return 'ALERTA';
      if (valor < -50) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      const caida = Math.abs(val);
      if (nivel === 'ALERTA') return `Caída de RIN crítica: ${caida.toFixed(0)} MM USD en semana`;
      return `Caída de RIN preocupante: ${caida.toFixed(0)} MM USD en semana`;
    },
  },
  {
    id: 'MACRO_VOLATILIDAD_MINERA',
    indicador: 'volatilidad_minera_pct_semanal',
    eje: 'MACRO',
    nombre: 'Volatilidad Minera (Zn, Sn)',
    fuente: 'LME, Investing.com',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      // valor es % de bajada
      if (valor > 10) return 'ALERTA';
      if (valor > 2) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 10) return `Desplome minero: ${val.toFixed(1)}% (Umbral alerta >10% semanal)`;
      return `Caída minera significativa: ${val.toFixed(1)}%`;
    },
  },
  {
    id: 'MACRO_LITIO_PRECIO',
    indicador: 'litio_precio_variacion_pct',
    eje: 'MACRO',
    nombre: 'Precio Litio (Carbonato)',
    fuente: 'Fastmarkets, Trading Economics',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      // valor es % de bajada (positivo = caída)
      if (valor > 6) return 'ALERTA';
      if (valor > 3) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 6) return `Caída del litio: ${val.toFixed(1)}% (Umbral alerta >6% en 1 día)`;
      return `Caída moderada del litio: ${val.toFixed(1)}%`;
    },
  },

  // ── EJE 2: SOCIAL ─────────────────────────────────────────────────────
  {
    id: 'SOCIAL_BLOQUEOS',
    indicador: 'bloqueos_activos_count',
    eje: 'SOCIAL',
    nombre: 'Bloqueos Activos',
    fuente: 'ABC, Prensa',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => `${val} bloqueo(s) activo(s) detectado(s) en el país`,
  },
  {
    id: 'SOCIAL_PARO_SECTORIAL',
    indicador: 'paro_sectorial_dias',
    eje: 'SOCIAL',
    nombre: 'Días de Paro Sectorial',
    fuente: 'ERBOL, ANF',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor >= 2) return 'ALERTA';  // Paro indefinido en 2+ sectores
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return `Paro en ${val} sectores — riesgo de escalada nacional`;
      return `Paro sectorial activo (${val} sector)`;
    },
  },
  {
    id: 'SOCIAL_VIOLENCIA_MINERA',
    indicador: 'violencia_minera_eventos',
    eje: 'SOCIAL',
    nombre: 'Violencia en Zona Minera',
    fuente: 'Policía, Prensa',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor >= 3) return 'ALERTA';
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => `${val} evento(s) de violencia en zona minera`,
  },

  // ── EJE 3: ENERGÍA ─────────────────────────────────────────────────────
  {
    id: 'ENERGIA_GAS_PRODUCCION',
    indicador: 'gas_produccion_mmcmd',
    eje: 'ENERGIA',
    nombre: 'Producción Gas Natural',
    fuente: 'ANH, YPFB',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor < 33) return 'ALERTA';
      if (valor < 36) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return `Producción de gas CRÍTICA: ${val.toFixed(1)} MMm³/d (Umbral alerta <33)`;
      return `Producción de gas en descenso: ${val.toFixed(1)} MMm³/d (Precaución <36)`;
    },
  },
  {
    id: 'ENERGIA_DESABASTECIMIENTO',
    indicador: 'desabastecimiento_combustible_nivel',
    eje: 'ENERGIA',
    nombre: 'Desabastecimiento Combustible',
    fuente: 'ANH, Gremios',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      // 0=normal, 1=filas>2km, 2=racionamiento
      if (valor >= 2) return 'ALERTA';
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return 'Racionamiento o suspensión de ventas de combustible';
      return 'Filas extensas (>2 km) reportadas en al menos una capital';
    },
  },
  {
    id: 'ENERGIA_CORTES_ELECTRICIDAD',
    indicador: 'cortes_electricidad_horas',
    eje: 'ENERGIA',
    nombre: 'Cortes Electricidad Programados',
    fuente: 'ENDE, COES',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 4) return 'ALERTA';
      if (valor > 0) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 4) return `Cortes rotativos de ${val}h en zona industrial`;
      return `Aviso de déficit energético — cortes de ${val}h programados`;
    },
  },

  // ── EJE 4: POLÍTICO-INSTITUCIONAL ─────────────────────────────────────
  {
    id: 'POLITICA_RENUNCIAS',
    indicador: 'renuncias_alto_nivel_count',
    eje: 'POLITICA',
    nombre: 'Renuncias Alto Nivel',
    fuente: 'Prensa Nacional',
    frecuencia: 'Continuo',
    condicion: (valor: number): NivelAlerta => {
      if (valor >= 2) return 'ALERTA';
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => `${val} renuncia(s) en nivel ministerial o equivalente`,
  },
  {
    id: 'POLITICA_INHABILITACIONES',
    indicador: 'inhabilitaciones_judiciales_count',
    eje: 'POLITICA',
    nombre: 'Inhabilitaciones Judiciales',
    fuente: 'TCP, Prensa',
    frecuencia: 'Continuo',
    condicion: (valor: number): NivelAlerta => {
      if (valor >= 1) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => `${val} inhabilitación(es) judicial(es) de autoridad electa`,
  },

  // ── EJE 5: INFRAESTRUCTURA Y LOGÍSTICA ─────────────────────────────────
  {
    id: 'LOGISTICA_TIEMPO_PUERTOS',
    indicador: 'tiempo_paso_puertos_dias',
    eje: 'LOGISTICA',
    nombre: 'Tiempo Paso a Puertos',
    fuente: 'Exportadores, Prensa',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 5) return 'ALERTA';
      if (valor >= 3) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return `Tiempo a puertos CRÍTICO: ${val} días (Cierre de frontera)`;
      return `Tiempo a puertos elevado: ${val} días`;
    },
  },
  {
    id: 'LOGISTICA_BLOQUEO_RUTAS',
    indicador: 'bloqueo_rutas_horas',
    eje: 'LOGISTICA',
    nombre: 'Estado Rutas Críticas',
    fuente: 'ABC, ERBOL',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 12) return 'ALERTA';
      if (valor >= 4) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 12) return `Bloqueo prolongado (${val}h) o toma de peajes`;
      return `Bloqueo parcial de ruta (${val}h)`;
    },
  },

  // ── EJE 6: AMBIENTAL ──────────────────────────────────────────────────
  {
    id: 'AMBIENTE_INCENDIOS',
    indicador: 'incendios_focos_activos',
    eje: 'AMBIENTE',
    nombre: 'Incendios Forestales (Focos)',
    fuente: 'NASA FIRMS, Prensa',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 500) return 'ALERTA';
      if (valor >= 200) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number, nivel: NivelAlerta): string => {
      if (nivel === 'ALERTA') return `${val} focos activos — UMBRAL CRÍTICO (>500)`;
      return `${val} focos activos de incendio — temporada elevada`;
    },
  },
  {
    id: 'AMBIENTE_CALIDAD_AIRE',
    indicador: 'calidad_aire_pm25',
    eje: 'AMBIENTE',
    nombre: 'Calidad del Aire (PM2.5)',
    fuente: 'Red MÓNICA, UMSA',
    frecuencia: 'Diario',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 100) return 'ALERTA';
      if (valor >= 50) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 100) return `PM2.5 en ${val.toFixed(0)} µg/m³ — DAÑINO para la salud`;
      return `PM2.5 en ${val.toFixed(0)} µg/m³ — calidad regular`;
    },
  },
  {
    id: 'AMBIENTE_DEFICIT_HIDRICO',
    indicador: 'deficit_hidrico_porcentual',
    eje: 'AMBIENTE',
    nombre: 'Déficit Hídrico (Lagos/Ríos)',
    fuente: 'SENAMHI, Satélites',
    frecuencia: 'Mensual',
    condicion: (valor: number): NivelAlerta => {
      if (valor > 20) return 'ALERTA';
      if (valor >= 10) return 'VIGILANCIA';
      return 'INFO';
    },
    mensaje: (val: number): string => {
      if (val > 20) return `Déficit hídrico CRÍTICO: ${val.toFixed(1)}% vs promedio`;
      return `Déficit hídrico moderado: ${val.toFixed(1)}% vs promedio`;
    },
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Obtener umbrales por eje */
export function getUmbralesPorEje(eje: EjeEstrategico): UmbralAlerta[] {
  return UMBRALES_CRITICOS.filter(u => u.eje === eje);
}

/** Obtener un umbral por ID */
export function getUmbralById(id: string): UmbralAlerta | undefined {
  return UMBRALES_CRITICOS.find(u => u.id === id);
}

/** Mapeo de slug de eje a key */
export function slugToEje(slug: string): EjeEstrategico | undefined {
  const entry = EJES.find(e => e.slug === slug);
  return entry?.key;
}
