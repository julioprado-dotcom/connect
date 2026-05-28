/**
 * Constantes de UI — DECODEX Bolivia
 * Labels y datos estáticos de presentación.
 *
 * NOTA: Los colores de sentimiento y tratamiento están centralizados en
 * @/constants/colors.ts — NO definir colores inline en componentes.
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

export const TIPO_MENCION_LABELS: Record<string, string> = {
  mencion_directa: 'Cita directa',
  mencion_pasiva: 'Mención pasiva',
  mencion_activa: 'Mención activa',
  mencion_critica: 'Mención crítica',
  referencia_tematica: 'Ref. temática',
  cita_directa: 'Cita directa',
  cobertura_declaracion: 'Cob. declaración',
  contexto: 'En contexto',
  foto_video: 'Foto/Video',
  no_clasificado: 'No clasificado',
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
