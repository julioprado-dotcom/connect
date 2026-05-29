// Registrar rechazos del pipeline de captura para auditoría
// Cada artículo que la IA descarta o que no pasa los filtros queda registrado
// con su motivo, URL, título, texto y respuesta del LLM.

import db from '@/lib/db';

// ─── Motivos de rechazo (constantes para consistencia) ───────────

export const RECHAZO_MOTIVO = {
  ES_RELEVANTE_FALSE: 'es_relevante_false',     // LLM determinó que no es relevante
  TEXTO_CORTO: 'texto_corto',                     // Texto < 100 chars, insuficiente para IA
  DESCARGA_FALLO: 'descarga_fallo',               // No se pudo descargar el artículo
  SIN_LINKS: 'sin_links',                         // No se extrajeron links de la homepage
  TRIAJE_CERO: 'triaje_cero',                     // Ninguna nota pasó el filtro de keywords
  CIRCUIT_BREAKER: 'circuit_breaker',             // Circuit breaker abierto, LLM no disponible
  PARSE_ERROR: 'parse_error',                     // JSON del LLM no se pudo parsear
  DUPLICADO: 'duplicado',                         // Mención duplicada (ya existe)
  ERROR_DESCONOCIDO: 'error_desconocido',         // Error inesperado
} as const;

export type MotivoRechazo = (typeof RECHAZO_MOTIVO)[keyof typeof RECHAZO_MOTIVO];

interface RegistrarRechazoParams {
  medioId: string;
  url?: string;
  titulo?: string;
  texto?: string;
  motivo: MotivoRechazo | string;
  respuestaLLM?: string;
  resultado?: {
    es_relevante?: boolean;
    tratamientoPeriodistico?: string;
    sentimiento_general?: string;
    confianzaClasificacion?: string;
  };
}

/**
 * Registra un rechazo en la tabla RechazoCaptura.
 * Fire-and-forget: errores de escritura se loguean pero no bloquean el pipeline.
 * El texto se trunca a 500 chars para no saturar la DB.
 */
export async function registrarRechazo(params: RegistrarRechazoParams): Promise<void> {
  try {
    const textoTruncado = (params.texto || '').substring(0, 500);
    const respuestaTruncada = (params.respuestaLLM || '').substring(0, 500);

    await db.rechazoCaptura.create({
      data: {
        medioId: params.medioId,
        url: params.url || '',
        titulo: (params.titulo || '').substring(0, 200),
        texto: textoTruncado,
        motivo: params.motivo,
        respuestaLLM: respuestaTruncada,
        es_relevante: params.resultado?.es_relevante === true ? 'true' : 'false',
        tratamiento: params.resultado?.tratamientoPeriodistico || null,
        sentimiento: params.resultado?.sentimiento_general || null,
        confianza: params.resultado?.confianzaClasificacion || null,
        textoLen: (params.texto || '').length,
      },
    });

    console.log(`[RECHAZO] ${params.motivo}: "${(params.titulo || '').substring(0, 60)}" — ${params.url || 'sin URL'}`);
  } catch (err) {
    // No bloquear el pipeline por un error de logging
    console.warn(`[RECHAZO] Error registrando rechazo: ${err instanceof Error ? err.message : String(err)}`);
  }
}
