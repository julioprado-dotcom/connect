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
  '1': 'Corporativos',
  '2': 'Regionales',
  '3': 'Alternativos',
  '4': 'Redes',
  '5': 'Extendidos',
};

export const NIVEL_COLORS: Record<string, string> = {
  '1': 'bg-primary text-primary-foreground',
  '2': 'bg-sky-600 text-white',
  '3': 'bg-amber-600 text-white',
  '4': 'bg-purple-600 text-white',
  '5': 'bg-stone-500 text-white',
};

export const CAMARAS = ['Todas', 'Diputados', 'Senado'];

export const DEPARTAMENTOS = [
  'Todos', 'La Paz', 'Santa Cruz', 'Cochabamba', 'Potosí', 'Tarija',
  'Oruro', 'Beni', 'Chuquisaca', 'Pando',
];

export const PARTIDOS = [
  'Todos', 'PDC', 'LIBRE', 'UNIDAD', 'AP', 'APB SÚMATE', 'MAS IPSP', 'BIA YUQUI',
];
