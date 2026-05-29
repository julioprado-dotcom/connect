import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { analyzeBatchSchema } from '@/lib/validations';
import { analyzeMencion, applyAnalysisToMencion, EJES_TEMATICOS } from '@/lib/analyze';
import { extraerMencionesDeTexto, crearMencionesExtraidas, type ExtractionResult } from '@/lib/ai/extractor-menciones';
import { safeError } from '@/lib/safe-error';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// Rate limit del modelo gratis glm-4.7-flash: ~3 req/s
const LLM_DELAY_MS = 3000;

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, analyzeBatchSchema, RATE.AI);
    if (parsed instanceof NextResponse) return parsed;
    const { limit } = parsed.body;

    // Obtener menciones sin clasificar
    const menciones = await db.mencion.findMany({
      where: { sentimiento: 'no_clasificado' },
      take: limit,
      include: { Persona: { select: { nombre: true } }, Medio: { select: { nombre: true } } },
    });

    if (menciones.length === 0) {
      return NextResponse.json({
        analizadas: 0,
        vinculadas: 0,
        mensaje: 'No hay menciones pendientes de análisis',
        ejesDisponibles: EJES_TEMATICOS.length,
      });
    }

    let analizadas = 0;
    let vinculadas = 0;
    let errores = 0;
    const detalles: string[] = [];

    for (const mencion of menciones) {
      try {
        const texto = mencion.textoCompleto || mencion.texto || '';
        const titulo = mencion.titulo || '';

        if (!mencion.personaId && texto.length >= 100) {
          // ── CASO A: Mención huérfana (sin personaId) ──
          // Usar extraerMencionesDeTexto que SÍ inyecta personas y las extrae del texto
          console.log(`[batch-analyze] Mención #${mencion.id} sin persona — usando extractor con lista de personas`);

          const extraccion = await extraerMencionesDeTexto(texto, mencion.medioId);

          if (extraccion.legisladores_mencionados.length > 0) {
            // La IA encontró personas — vincular la primera al registro existente
            const primerLegislador = extraccion.legisladores_mencionados[0];
            console.log(`[batch-analyze] ✓ Persona vinculada: ${primerLegislador.persona_id} a mención #${mencion.id}`);

            // Actualizar la mención existente con personaId + clasificación
            await db.mencion.update({
              where: { id: mencion.id },
              data: {
                personaId: primerLegislador.persona_id,
                texto: primerLegislador.cita || mencion.texto,
                textoCompleto: primerLegislador.contexto || texto,
                tipoMencion: 'mencion_pasiva',
                sentimiento: extraccion.sentimiento_general,
                tratamientoPeriodistico: extraccion.tratamientoPeriodistico,
                intencionMedio: extraccion.intencionMedio,
                confianzaClasificacion: extraccion.confianzaClasificacion,
                preguntasFundamentales: extraccion.preguntas_fundamentales as any,
                temas: extraccion.temas_detectados.join(', '),
              },
            });

            // Vincular ejes temáticos si se detectaron (batch createMany)
            if (extraccion.ejes_mencionados.length > 0) {
              try {
                await db.mencionTema.createMany({
                  data: extraccion.ejes_mencionados.map(e => ({
                    mencionId: mencion.id,
                    ejeTematicoId: eje.eje_id,
                  })),
                  skipDuplicates: true,
                });
              } catch {
                // Duplicado o error, ignorar
              }
            }

            // Si hay más legisladores, crear menciones adicionales
            if (extraccion.legisladores_mencionados.length > 1) {
              for (let i = 1; i < extraccion.legisladores_mencionados.length; i++) {
                const leg = extraccion.legisladores_mencionados[i];
                try {
                  const existente = await db.mencion.findFirst({
                    where: { personaId: leg.persona_id, medioId: mencion.medioId, url: mencion.url },
                  });
                  if (!existente) {
                    const nuevaMencion = await db.mencion.create({
                      data: {
                        id: crypto.randomUUID(),
                        personaId: leg.persona_id,
                        medioId: mencion.medioId,
                        titulo,
                        texto: leg.cita,
                        textoCompleto: leg.contexto,
                        url: mencion.url,
                        tipoMencion: 'mencion_pasiva',
                        sentimiento: extraccion.sentimiento_general,
                        tratamientoPeriodistico: extraccion.tratamientoPeriodistico,
                        intencionMedio: extraccion.intencionMedio,
                        confianzaClasificacion: extraccion.confianzaClasificacion,
                        preguntasFundamentales: extraccion.preguntas_fundamentales as any,
                        temas: extraccion.temas_detectados.join(', '),
                        verificado: false,
                      },
                    });

                    if (extraccion.ejes_mencionados.length > 0) {
                      try {
                        await db.mencionTema.createMany({
                          data: extraccion.ejes_mencionados.map(e => ({
                            mencionId: nuevaMencion.id,
                            ejeTematicoId: eje.eje_id,
                          })),
                          skipDuplicates: true,
                        });
                      } catch { /* ignore */ }
                    }
                  }
                } catch { /* ignore */ }
              }
            }

            vinculadas++;
            const ejesSlugs = extraccion.ejes_mencionados.map(e => e.eje_id).join(',');
            detalles.push(`✓ ${primerLegislador.persona_id}: ${extraccion.sentimiento_general} / [${ejesSlugs}] — VINCULADA`);
          } else {
            // La IA no encontró personas — clasificar solo tratamiento (mención temática)
            const result = await analyzeMencion(titulo, texto);
            if (result.success) {
              await applyAnalysisToMencion(mencion.id, result);
              analizadas++;
              detalles.push(`  Referencia tematica: ${result.tipoMencion} / ${result.sentimiento} / [${result.ejesTematicos.join(',')}]`);
            } else {
              errores++;
              detalles.push(`  Referencia tematica: SIN RESPUESTA LLM — se reintentará`);
            }
          }
        } else {
          // ── CASO B: Mención ya tiene personaId — solo clasificar tratamiento ──
          const result = await analyzeMencion(titulo, texto);
          if (result.success) {
            await applyAnalysisToMencion(mencion.id, result);
            const personaLabel = mencion.Persona?.nombre || 'Referencia tematica';
            analizadas++;
            detalles.push(`${personaLabel}: ${result.tipoMencion} / ${result.sentimiento} / [${result.ejesTematicos.join(',')}]`);
          } else {
            errores++;
            const personaLabel = mencion.Persona?.nombre || 'Referencia tematica';
            detalles.push(`✗ ${personaLabel}: SIN RESPUESTA LLM — se reintentará`);
          }
        }
      } catch (err) {
        errores++;
        const errMsg = err instanceof Error ? err.message : 'Error desconocido';
        const personaLabel2 = mencion.Persona?.nombre || 'Referencia tematica';
        detalles.push(`✗ ${personaLabel2}: ERROR — ${errMsg}`);
        console.error(`[batch-analyze] Error procesando mención #${mencion.id}:`, err);
      }
      // Pausa entre llamadas LLM para evitar rate limit 429
      if (menciones.indexOf(mencion) < menciones.length - 1) {
        await sleep(LLM_DELAY_MS);
      }
    }

    return NextResponse.json({
      analizadas,
      vinculadas,
      errores,
      totalProcesadas: menciones.length,
      detalles,
    });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}
