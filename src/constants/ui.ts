/**
 * Constantes de UI — DECODEX Bolivia
 * Colores, labels y datos estáticos de presentación.
 */

export const PARTIDO_COLORS: Record<string, string> = {
  PDC: 'bg-red-600',
  LIBRE: 'bg-emerald-600',
  UNIDAD: 'bg-sky-700',
  AP: 'bg-amber-600',
  'APB SÚMATE': 'bg-purple-600',
  'APB SUMATE': 'bg-purple-600',
  'MAS IPSP': 'bg-orange-500',
  'BIA YUQUI': 'bg-teal-600',
};

export const PARTIDO_TEXT_COLORS: Record<string, string> = {
  PDC: 'text-red-600',
  LIBRE: 'text-emerald-600',
  UNIDAD: 'text-sky-700',
  AP: 'text-amber-600',
  'APB SÚMATE': 'text-purple-600',
  'APB SUMATE': 'text-purple-600',
  'MAS IPSP': 'text-orange-500',
  'BIA YUQUI': 'text-teal-600',
};

export const SENTIMIENTO_STYLES: Record<string, string> = {
  positivo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  negativo: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  critico: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
  elogioso: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-300',
  no_clasificado: 'bg-stone-50 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
};

export const TIPO_MENCION_LABELS: Record<string, string> = {
  cita_directa: 'Cita directa',
  mencion_pasiva: 'Mención pasiva',
  cobertura_declaracion: 'Cob. declaración',
  contexto: 'En contexto',
  foto_video: 'Foto/Video',
};

export const NIVEL_LABELS: Record<string, string> = {
  '1': 'Alta prioridad',
  '2': 'Media prioridad',
  '3': 'Baja prioridad',
};

export const NIVEL_COLORS: Record<string, string> = {
  '1': 'bg-red-600 text-white',
  '2': 'bg-amber-600 text-white',
  '3': 'bg-stone-500 text-white',
};

// Categorías de medios — clasificación por tipo de fuente
export const CATEGORIA_LABELS: Record<string, string> = {
  oficial: 'Medios Oficiales',
  corporativo: 'Corporativos',
  regional: 'Regionales',
  alternativo: 'Alternativos',
  red_social: 'Redes Sociales',
};

export const CATEGORIA_COLORS: Record<string, string> = {
  oficial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  corporativo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  regional: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  alternativo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red_social: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

export const CATEGORIA_ICONS: Record<string, string> = {
  oficial: 'landmark',
  corporativo: 'building-2',
  regional: 'map-pin',
  alternativo: 'newspaper',
  red_social: 'share-2',
};

export const CATEGORIAS = ['oficial', 'corporativo', 'regional', 'alternativo', 'red_social'] as const;

export const TIPO_MEDIO_LABELS: Record<string, string> = {
  agencia_noticias: 'Agencia de Noticias',
  diario: 'Diario',
  portal_web: 'Portal Web',
  television: 'Televisión',
  radio: 'Radio',
  revista: 'Revista',
  institucional: 'Sitio Institucional',
  ente_regulador: 'Ente Regulador',
  tribunal: 'Tribunal',
  red_social: 'Red Social',
  otro: 'Otro',
};

export const CAMARAS = ['Todas', 'Diputados', 'Senado'];

export const DEPARTAMENTOS = [
  'Todos', 'La Paz', 'Santa Cruz', 'Cochabamba', 'Potosí', 'Tarija',
  'Oruro', 'Beni', 'Chuquisaca', 'Pando',
];

export const PARTIDOS = [
  'Todos', 'PDC', 'LIBRE', 'UNIDAD', 'AP', 'APB SÚMATE', 'MAS IPSP', 'BIA YUQUI',
];
