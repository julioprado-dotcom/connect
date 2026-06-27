/**
 * DECODEX v0.8.0 — Validador de Calidad
 * Motor ONION200 — Equipo B — TAREA 7l
 *
 * Validacion de contenido generado por IA antes de
 * entrega al cliente. Verifica longitud, formato,
 * coherencia y presencia de datos requeridos.
 *
 * Uso:
 *   import { validateContent } from '@/lib/quality/validator';
 *   const result = validateContent(contenido, { tipo: 'EL_TERMOMETRO', minPalabras: 300 });
 */

import { PRODUCTOS } from '@/constants/products';
import { type TipoBoletin, type ValidationResult } from '@/types/bulletin';

// ============================================
// Reglas de Validacion por Tipo
// ============================================

interface ValidationRule {
  minPalabras: number;
  maxPalabras: number;
  requiereSecciones: boolean;
  prohibidoContenido: string[];
  requeridoContenido: string[];
}

const RULES_BY_TYPE: Record<TipoBoletin, ValidationRule> = {
  EL_TERMOMETRO: {
    minPalabras: 250,
    maxPalabras: 450,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion', 'se recomienda'],
    requeridoContenido: ['##'],
  },
  SALDO_DEL_DIA: {
    minPalabras: 300,
    maxPalabras: 600,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'Hits', 'Miss', 'en conclusion'],
    requeridoContenido: ['##'],
  },
  EL_FOCO: {
    minPalabras: 600,
    maxPalabras: 1000,
    requiereSecciones: true,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion', 'se recomienda'],
    requeridoContenido: ['##'],
  },
  EL_ESPECIALIZADO: {
    minPalabras: 1200,
    maxPalabras: 2500,
    requiereSecciones: true,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'se recomienda', 'es necesario', 'se debe', 'en conclusion'],
    requeridoContenido: ['##', 'hallazgo'],
  },
  EL_INFORME_CERRADO: {
    minPalabras: 1500,
    maxPalabras: 3000,
    requiereSecciones: true,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'se recomienda', 'es necesario', 'se debe', 'en conclusion'],
    requeridoContenido: ['##'],
  },
  FICHA_LEGISLADOR: {
    minPalabras: 700,
    maxPalabras: 1300,
    requiereSecciones: true,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion'],
    requeridoContenido: ['##'],
  },
  ALERTA_TEMPRANA: {
    minPalabras: 50,
    maxPalabras: 200,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'se recomienda', 'se debe'],
    requeridoContenido: [],
  },
  EL_RADAR: {
    minPalabras: 400,
    maxPalabras: 800,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion'],
    requeridoContenido: ['##'],
  },
  VOZ_Y_VOTO: {
    minPalabras: 400,
    maxPalabras: 800,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion', 'Otros temas relevantes'],
    requeridoContenido: ['##'],
  },
  EL_HILO: {
    minPalabras: 500,
    maxPalabras: 900,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion'],
    requeridoContenido: [],
  },
  FOCO_DE_LA_SEMANA: {
    minPalabras: 400,
    maxPalabras: 800,
    requiereSecciones: false,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion'],
    requeridoContenido: ['##'],
  },
  BOLETIN_DEL_GRANO: {
    minPalabras: 600,
    maxPalabras: 1200,
    requiereSecciones: true,
    prohibidoContenido: ['lo siento', 'no puedo', 'como ia', 'i am', 'as an ai', 'N/A', 'en conclusion', 'se recomienda'],
    requeridoContenido: ['##', 'café', 'cafe'],
  },
};

// ============================================
// Funcion Principal de Validacion
// ============================================

/**
 * Valida el contenido generado contra las reglas del tipo de producto.
 */
export function validateContent(
  contenido: string,
  options: {
    tipo: TipoBoletin;
    minPalabras?: number;
    maxPalabras?: number;
  }
): ValidationResult {
  const errores: string[] = [];
  const advertencias: string[] = [];

  // 1. Verificar que el contenido no este vacio
  if (!contenido || contenido.trim().length === 0) {
    return {
      valido: false,
      puntuacion: 0,
      errores: ['El contenido esta vacio'],
      advertencias: [],
      estadisticas: { palabras: 0, caracteres: 0, oraciones: 0 },
    };
  }

  // 2. Obtener reglas
  const reglas = RULES_BY_TYPE[options.tipo];
  const minPal = options.minPalabras ?? reglas.minPalabras;
  const maxPal = options.maxPalabras ?? reglas.maxPalabras;

  // 3. Calcular estadisticas
  const estadisticas = calculateStats(contenido);

  // 4. Validar longitud
  if (estadisticas.palabras < minPal) {
    errores.push(
      `Contenido muy corto: ${estadisticas.palabras} palabras (minimo: ${minPal})`
    );
  }
  if (estadisticas.palabras > maxPal) {
    advertencias.push(
      `Contenido excede longitud: ${estadisticas.palabras} palabras (maximo: ${maxPal})`
    );
  }

  // 5. Verificar contenido prohibido
  const contenidoLower = contenido.toLowerCase();
  for (const prohibido of reglas.prohibidoContenido) {
    if (contenidoLower.includes(prohibido)) {
      errores.push(
        `Contenido contiene texto prohibido: "${prohibido}". Posible fallo de generacion.`
      );
    }
  }

  // 6. Verificar contenido requerido
  for (const requerido of reglas.requeridoContenido) {
    if (!contenidoLower.includes(requerido.toLowerCase())) {
      advertencias.push(
        `Contenido podria faltar seccion: "${requerido}"`
      );
    }
  }

  // 7. Verificar secciones si es requerido
  if (reglas.requiereSecciones) {
    const secciones = (contenido.match(/^##\s+.+$/gm) ?? []).length;
    if (secciones < 3) {
      advertencias.push(
        `Pocas secciones detectadas: ${secciones} (esperado: al menos 3)`
      );
    }
  }

  // 8. Verificar formato basico
  if (!contenido.includes('\n')) {
    advertencias.push('El contenido no tiene saltos de linea (posible formato incorrecto)');
  }

  // 9. Calcular puntuacion (0-100)
  let puntuacion = 100;

  // Penalizaciones
  puntuacion -= errores.length * 30;
  puntuacion -= advertencias.length * 10;

  // ═══ BONUS/PENALIZACIONES DE CALIDAD ═══

  // BONUS: Presencia de citas (Fuente: X)
  const citasCount = (contenido.match(/\(Fuente:\s*[^)]+\)/gi) ?? []).length;
  if (citasCount >= 5) puntuacion += 5;
  else if (citasCount >= 3) puntuacion += 3;
  else if (citasCount === 0) puntuacion -= 15; // Sin citas = grave

  // BONUS: Notas al pie [1], [2]... (alternativa de cita)
  const notasPie = (contenido.match(/\[\d+\]/g) ?? []).length;
  if (notasPie >= 5 && citasCount === 0) puntuacion += 5;
  else if (notasPie >= 3 && citasCount === 0) puntuacion += 3;

  // PENALIZACION: N/A placeholders
  if (/N\/A/gi.test(contenido)) {
    puntuacion -= 15;
    errores.push('Contiene placeholders "N/A" en ingles');
  }

  // PENALIZACION: Lenguaje editorial
  const editorialKw = ['critico', 'grave', 'dramatico', 'preocupante', 'alarmante', 'sin precedentes', 'punto de inflexion', 'escalada significativa'];
  const editorialHits = editorialKw.filter(kw => contenidoLower.includes(kw));
  if (editorialHits.length >= 3) {
    puntuacion -= 10;
    errores.push(`Lenguaje editorial detectado: "${editorialHits.slice(0, 3).join('", "')}"`);
  } else if (editorialHits.length > 0) {
    puntuacion -= 3;
    advertencias.push(`Posible lenguaje editorial: "${editorialHits.join('", "')}"`);
  }

  // PENALIZACION: Frases con "se" impersonal sin sujeto (sujetos fantasma)
  const ghostPatterns = [
    /\bSe aprobo\b/gi, /\bSe rechazo\b/gi, /\bSe informo\b/gi,
    /\bSe declaro\b/gi, /\bSe presento\b/gi, /\bSe discutio\b/gi,
    /\bSe sanciono\b/gi, /\bSe promulgo\b/gi,
  ];
  let ghostCount = 0;
  for (const pat of ghostPatterns) {
    const matches = contenido.match(pat);
    if (matches) ghostCount += matches.length;
  }
  if (ghostCount >= 3) {
    puntuacion -= 10;
    advertencias.push(`${ghostCount} oraciones con sujeto fantasma ("Se aprobo...", "Se informo..." sin identificar al actor)`);
  } else if (ghostCount > 0) {
    puntuacion -= 3;
    advertencias.push(`${ghostCount} oracion(es) posible sujeto fantasma`);
  }

  // PENALIZACION: Secciones vacías con texto filler
  const emptySectionPatterns = [
    /No se registraron?\s/gi,
    /Sin actividad\s/gi,
    /No hay datos disponibles/gi,
    /Sin datos sobre este tema/gi,
  ];
  const emptyHits = emptySectionPatterns.filter(pat => pat.test(contenido));
  if (emptyHits.length > 0) {
    puntuacion -= 5;
    advertencias.push('Posibles secciones vacías con texto filler detectadas');
  }

  // PENALIZACION: Anglicismos
  if (/\bHits?\b/gi.test(contenido) || /\bMiss\b/gi.test(contenido)) {
    puntuacion -= 5;
    errores.push('Contiene anglicismos (Hits/Miss) en lugar de espanol');
  }

  // BONUS: Identidad del producto (mención de DECODEX)
  if (/DECODEX/i.test(contenido)) puntuacion += 3;

  // BONUS: Transparencia de datos
  if (/\d+\s*menciones?\s*de\s*\d+\s*medios/i.test(contenido)) puntuacion += 3;

  puntuacion = Math.max(0, Math.min(100, puntuacion));

  return {
    valido: errores.length === 0,
    puntuacion,
    errores,
    advertencias,
    estadisticas,
  };
}

/**
 * Validacion rapida (solo verifica si es apto para entrega).
 */
export function isContentValid(
  contenido: string,
  tipo: TipoBoletin
): boolean {
  const result = validateContent(contenido, { tipo });
  return result.valido && result.puntuacion >= 60;
}

// ============================================
// Funciones Auxiliares
// ============================================

function calculateStats(texto: string): {
  palabras: number;
  caracteres: number;
  oraciones: number;
} {
  const palabras = texto
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const caracteres = texto.length;

  const oraciones = texto
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0).length;

  return { palabras, caracteres, oraciones };
}
