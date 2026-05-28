/**
 * DECODEX v0.11.0 — Dispatcher de Entregas
 * Motor ONION200
 *
 * Despacho automatico de entregas de productos
 * a clientes segun sus contratos. Incluye tracking
 * de estado y reintentos para entregas fallidas.
 *
 * FIXES aplicados (v0.11.0):
 * - Estados masculinos: enviado/fallido (no enviada/fallida)
 * - Retry usa contenido almacenado en Entrega (no vacío)
 * - WhatsApp usa campo `whatsapp` del Cliente (fallback a telefono)
 * - Parsea JSON de reporte.contenido para extraer textoCompleto
 * - Registra contenido en Entrega para rastreabilidad
 * - Retry ordenado por fechaCreacion ASC
 * - Eliminado estado 'leido' inexistente
 */

import db from '@/lib/db';
import { type TipoBoletin } from '@/types/bulletin';
import { formatFechaBolivia } from '@/lib/reportes-utils';
export { formatFechaBolivia } from '@/lib/reportes-utils';
import { sendWhatsApp, sendEmail, generatePDF } from '@/lib/delivery-channels';

// ============================================
// Configuracion de Reintentos
// ============================================

const MAX_REINTENTOS = 3;

// ============================================
// Resultado de Dispatch
// ============================================

export interface DispatchResult {
  exito: boolean;
  reporteId: string;
  totalEntregas: number;
  exitosas: number;
  fallidas: number;
  detalles: DispatchDetalle[];
}

interface DispatchDetalle {
  contratoId: string;
  canal: string;
  destinatario: string;
  exito: boolean;
  trackingId?: string;
  error?: string;
}

// ============================================
// Funciones principales
// ============================================

/**
 * Formatea contenido para un canal de entrega.
 */
function formatForChannel(
  contenido: string,
  asunto: string,
  canal: string
): string {
  switch (canal) {
    case 'whatsapp':
      return contenido
        .replace(/#{1,3}\s/g, '*')
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/\n\n/g, '\n')
        .trim();
    case 'email':
      return contenido;
    default:
      return contenido;
  }
}

/**
 * Parsea contenido de reporte (puede ser JSON con textoCompleto).
 */
function parseContenidoReporte(contenido: string): string {
  try {
    const parsed = JSON.parse(contenido);
    return parsed.textoCompleto || contenido;
  } catch {
    return contenido;
  }
}

/**
 * Registra una entrega pendiente en la base de datos.
 */
async function registrarEntrega(params: {
  contratoId: string;
  tipoBoletin: string;
  canal: string;
  destinatario: string;
  estado: string;
  contenido?: string;
}): Promise<string | null> {
  try {
    const entrega = await db.entrega.create({
      data: {
        contratoId: params.contratoId,
        tipoBoletin: params.tipoBoletin,
        canal: params.canal,
        destinatarios: JSON.stringify([params.destinatario]),
        estado: params.estado,
        contenido: params.contenido ?? '',
      },
    });
    return entrega.id;
  } catch (error) {
    console.error('[dispatcher] Error registrando entrega:', error);
    return null;
  }
}

/**
 * Actualiza el estado de una entrega.
 */
async function actualizarEstadoEntrega(
  entregaId: string,
  nuevoEstado: string,
  _trackingId?: string,
  errorMsg?: string
): Promise<boolean> {
  try {
    await db.entrega.update({
      where: { id: entregaId },
      data: {
        estado: nuevoEstado,
        error: errorMsg ?? null,
        fechaEnvio: nuevoEstado === 'enviado' ? new Date() : undefined,
      },
    });
    return true;
  } catch (error) {
    console.error('[dispatcher] Error actualizando estado entrega:', error);
    return false;
  }
}

/**
 * Despacha un reporte a todos los clientes con contratos activos.
 */
export async function despacharReporte(
  reporteId: string,
  canalesForzados?: string[]
): Promise<DispatchResult> {
  try {
    // 1. Obtener el reporte
    const reporte = await db.reporte.findUnique({
      where: { id: reporteId },
    });

    if (!reporte) {
      throw new Error(`Reporte ${reporteId} no encontrado`);
    }

    // 2. Parsear contenido (JSON con textoCompleto o texto plano)
    const contenidoFinal = parseContenidoReporte(reporte.contenido);

    // 3. Obtener contratos activos que incluyen este tipo de producto
    const contratos = await db.contrato.findMany({
      where: {
        estado: 'activo',
        tipoProducto: reporte.tipo,
      },
      include: {
        Cliente: { select: { email: true, telefono: true, whatsapp: true, nombre: true } },
      },
    });

    if (contratos.length === 0) {
      console.log(`[dispatcher] Sin contratos activos para ${reporte.tipo}`);
      return {
        exito: true,
        reporteId,
        totalEntregas: 0,
        exitosas: 0,
        fallidas: 0,
        detalles: [],
      };
    }

    // 4. Despachar a cada contrato
    const resultados: DispatchDetalle[] = [];
    let exitosas = 0;
    let fallidas = 0;

    for (const contrato of contratos) {
      const canales = canalesForzados ?? inferirCanales(contrato);

      for (const canal of canales) {
        const destinatario = obtenerDestinatario(contrato, canal);
        if (!destinatario) continue;

        // Registrar entrega pendiente (con contenido para rastreabilidad)
        const entregaId = await registrarEntrega({
          contratoId: contrato.id,
          tipoBoletin: reporte.tipo,
          canal,
          destinatario,
          estado: 'pendiente',
          contenido: contenidoFinal,
        });

        if (!entregaId) {
          resultados.push({
            contratoId: contrato.id,
            canal,
            destinatario,
            exito: false,
            error: 'Error al registrar entrega',
          });
          fallidas++;
          continue;
        }

        // Formatear contenido para el canal
        const contenidoFormateado = formatForChannel(
          contenidoFinal,
          `${reporte.tipo} — DECODEX`,
          canal
        );

        // Enviar via canal
        try {
          const result = await enviarPorCanal({
            canal,
            destinatario,
            asunto: `${reporte.tipo} — DECODEX`,
            contenido: contenidoFormateado,
          });

          // Actualizar estado
          await actualizarEstadoEntrega(
            entregaId,
            result.exito ? 'enviado' : 'fallido',
            result.trackingId,
            result.error
          );

          resultados.push({
            contratoId: contrato.id,
            canal,
            destinatario,
            exito: result.exito,
            trackingId: result.trackingId,
            error: result.error,
          });

          if (result.exito) {
            exitosas++;
          } else {
            fallidas++;
          }
        } catch (error) {
          await actualizarEstadoEntrega(entregaId, 'fallido', undefined,
            error instanceof Error ? error.message : 'Error de envio'
          );
          resultados.push({
            contratoId: contrato.id,
            canal,
            destinatario,
            exito: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
          });
          fallidas++;
        }
      }
    }

    // 5. Actualizar estado del reporte
    if (exitosas > 0) {
      await db.reporte.update({
        where: { id: reporteId },
        data: { enviado: true, fechaEnvio: new Date() },
      });
    }

    console.log(`[dispatcher] Reporte ${reporteId}: ${exitosas} exitosas, ${fallidas} fallidas`);

    return {
      exito: exitosas > 0,
      reporteId,
      totalEntregas: resultados.length,
      exitosas,
      fallidas,
      detalles: resultados,
    };
  } catch (error) {
    console.error('[dispatcher] Error despachando reporte:', error);
    throw error;
  }
}

/**
 * Reintenta entregas fallidas.
 */
export async function reintentarFallidas(maxReintentos: number = MAX_REINTENTOS): Promise<number> {
  try {
    const entregasFallidas = await db.entrega.findMany({
      where: {
        estado: 'fallido',
      },
      include: {
        Contrato: true,
      },
      orderBy: { fechaCreacion: 'asc' },
      take: 50,
    });

    let reintentadas = 0;

    for (const entrega of entregasFallidas) {
      // Contar reintentos previos para esta entrega específica
      const reintentosPrevios = await db.entrega.count({
        where: {
          contratoId: entrega.contratoId,
          canal: entrega.canal,
          estado: 'fallido',
          id: { lt: entrega.id },
        },
      });

      if (reintentosPrevios >= maxReintentos) {
        console.log(`[dispatcher] Max reintentos alcanzado para entrega ${entrega.id}`);
        continue;
      }

      // Reenviar con contenido almacenado
      try {
        const result = await enviarPorCanal({
          canal: entrega.canal as string,
          destinatario: JSON.parse(entrega.destinatarios)[0] ?? '',
          asunto: `Reenvio: ${entrega.tipoBoletin} — DECODEX`,
          contenido: entrega.contenido || '',
        });

        await actualizarEstadoEntrega(
          entrega.id,
          result.exito ? 'enviado' : 'fallido',
          result.trackingId,
          result.error
        );

        reintentadas++;
      } catch (error) {
        console.error(`[dispatcher] Error en reintento ${entrega.id}:`, error);
      }
    }

    return reintentadas;
  } catch (error) {
    console.error('[dispatcher] Error en reintentos:', error);
    return 0;
  }
}

/**
 * Obtiene estadísticas de entregas.
 */
export async function obtenerEstadisticasEntregas(): Promise<{
  pendientes: number;
  enviadas: number;
  fallidas: number;
  total: number;
}> {
  const [pendientes, enviadas, fallidas] = await Promise.all([
    db.entrega.count({ where: { estado: 'pendiente' } }),
    db.entrega.count({ where: { estado: 'enviado' } }),
    db.entrega.count({ where: { estado: 'fallido' } }),
  ]);

  return {
    pendientes,
    enviadas,
    fallidas,
    total: pendientes + enviadas + fallidas,
  };
}

// ============================================
// Funciones auxiliares
// ============================================

async function enviarPorCanal(params: {
  canal: string;
  destinatario: string;
  asunto: string;
  contenido: string;
}): Promise<{ exito: boolean; trackingId?: string; error?: string }> {
  switch (params.canal) {
    case 'whatsapp':
      return sendWhatsApp(params.destinatario, params.contenido);
    case 'email':
      return sendEmail(params.destinatario, params.asunto, params.contenido);
    case 'pdf':
      return generatePDF(params.contenido, params.asunto);
    default:
      return { exito: false, error: `Canal no soportado: ${params.canal}` };
  }
}

function inferirCanales(contrato: {
  Cliente: { email: string | null; telefono: string | null; whatsapp: string | null } | null;
}): string[] {
  const canales: string[] = [];

  if (contrato.Cliente?.email) canales.push('email');
  // Preferir campo whatsapp específico, fallback a telefono
  if (contrato.Cliente?.whatsapp) canales.push('whatsapp');
  else if (contrato.Cliente?.telefono) canales.push('whatsapp');

  return canales.length > 0 ? canales : ['email'];
}

function obtenerDestinatario(
  contrato: {
    Cliente: { email: string | null; telefono: string | null; whatsapp: string | null } | null;
  },
  canal: string
): string | null {
  if (!contrato.Cliente) return null;

  switch (canal) {
    case 'email': return contrato.Cliente.email;
    case 'whatsapp': return contrato.Cliente.whatsapp || contrato.Cliente.telefono;
    default: return contrato.Cliente.email;
  }
}
