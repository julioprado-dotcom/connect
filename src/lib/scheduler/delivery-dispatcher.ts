/**
 * DECODEX v0.8.0 — Dispatcher de Entregas
 * Motor ONION200 — Equipo B — TAREA 3f
 *
 * Despacho automatico de entregas de productos
 * a clientes segun sus contratos. Incluye tracking
 * de estado y reintentos para entregas fallidas.
 */

import { db } from '@/lib/db';
import { type TipoBoletin } from '@/types/bulletin';
import { formatFechaBolivia, formatearMencionesPorEje } from '@/lib/reportes-utils';
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
      // WhatsApp: texto plano con formato básico
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
 * Registra una entrega pendiente en la base de datos.
 */
async function registrarEntrega(params: {
  contratoId: string;
  tipoBoletin: string;
  canal: string;
  destinatario: string;
  estado: string;
}): Promise<string | null> {
  try {
    const entrega = await db.entrega.create({
      data: {
        contratoId: params.contratoId,
        tipoBoletin: params.tipoBoletin,
        canal: params.canal,
        destinatarios: JSON.stringify([params.destinatario]),
        estado: params.estado,
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
        fechaEnvio: nuevoEstado === 'enviada' ? new Date() : undefined,
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

    // 2. Obtener contratos activos que incluyen este tipo de producto
    const contratos = await db.contrato.findMany({
      where: {
        estado: 'activo',
        tipoProducto: reporte.tipo,
      },
      include: {
        cliente: { select: { email: true, telefono: true, nombre: true } },
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

    // 3. Despachar a cada contrato
    const resultados: DispatchDetalle[] = [];
    let exitosas = 0;
    let fallidas = 0;

    for (const contrato of contratos) {
      const canales = canalesForzados ?? inferirCanales(contrato);

      for (const canal of canales) {
        const destinatario = obtenerDestinatario(contrato, canal);
        if (!destinatario) continue;

        // Registrar entrega pendiente
        const entregaId = await registrarEntrega({
          contratoId: contrato.id,
          tipoBoletin: reporte.tipo,
          canal,
          destinatario,
          estado: 'pendiente',
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
          reporte.contenido,
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
            result.exito ? 'enviada' : 'fallida',
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
          await actualizarEstadoEntrega(entregaId, 'fallida', undefined,
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

    // 4. Actualizar estado del reporte
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
        estado: 'fallida',
      },
      include: {
        contrato: true,
      },
      take: 50,
    });

    let reintentadas = 0;

    for (const entrega of entregasFallidas) {
      // Verificar reintento
      const reintentosPrevios = await db.entrega.count({
        where: {
          contratoId: entrega.contratoId,
          canal: entrega.canal,
          estado: 'fallida',
        },
      });

      if (reintentosPrevios >= maxReintentos) {
        console.log(`[dispatcher] Max reintentos alcanzado para entrega ${entrega.id}`);
        continue;
      }

      // Reenviar
      try {
        const result = await enviarPorCanal({
          canal: entrega.canal as string,
          destinatario: JSON.parse(entrega.destinatarios)[0] ?? '',
          asunto: `Reenvio: ${entrega.tipoBoletin} — DECODEX`,
          contenido: '',
        });

        await actualizarEstadoEntrega(
          entrega.id,
          result.exito ? 'enviada' : 'fallida',
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
 * Obtiene entregas pendientes y sus estadisticas.
 */
export async function obtenerEstadisticasEntregas(): Promise<{
  pendientes: number;
  enviadas: number;
  fallidas: number;
  leidas: number;
  total: number;
}> {
  const [pendientes, enviadas, fallidas, leidas] = await Promise.all([
    db.entrega.count({ where: { estado: 'pendiente' } }),
    db.entrega.count({ where: { estado: 'enviada' } }),
    db.entrega.count({ where: { estado: 'fallida' } }),
    db.entrega.count({ where: { estado: 'leida' } }),
  ]);

  return {
    pendientes,
    enviadas,
    fallidas,
    leidas,
    total: pendientes + enviadas + fallidas + leidas,
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
  cliente: { email: string | null; telefono: string | null } | null;
}): string[] {
  const canales: string[] = [];

  if (contrato.cliente?.email) canales.push('email');
  if (contrato.cliente?.telefono) canales.push('whatsapp');

  return canales.length > 0 ? canales : ['email'];
}

function obtenerDestinatario(
  contrato: {
    cliente: { email: string | null; telefono: string | null } | null;
  },
  canal: string
): string | null {
  if (!contrato.cliente) return null;

  switch (canal) {
    case 'email': return contrato.cliente.email;
    case 'whatsapp': return contrato.cliente.telefono;
    default: return contrato.cliente.email;
  }
}
