#!/usr/bin/env npx tsx
/**
 * scheduler-service.ts — El Jefe (Proceso Independiente PM2)
 *
 * Servicio dedicado que decide CUÁNDO lanzar tareas y las envía a la cola.
 * Se ejecuta como proceso PM2 independiente del servidor Next.js y del Worker.
 *
 * Uso: npx tsx scheduler-service.ts
 * PM2: pm2 start "npx tsx scheduler-service.ts" --name decodex-scheduler
 *
 * Funcionalidad:
 * - Lee fuentes activas de la DB y programa checks con node-cron
 * - Generación automática de boletines ONION200
 * - Captura de indicadores Tier 1 (batch diario)
 * - Mantenimiento nocturno
 * - Reschedule periódico (cada 6h) para recalculer horarios
 * - Graceful shutdown: detiene todas las tareas cron → exit
 * - Health heartbeat: escribe timestamp para el dashboard
 */

import 'dotenv/config';
import os from 'os';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

// ── Auto-fix permisos DB (git stash/pop puede quitar write) ──
try {
  const dbPath = path.join(__dirname, 'prisma', 'db', 'custom.db');
  if (fs.existsSync(dbPath)) {
    const stat = fs.statSync(dbPath);
    if ((stat.mode & 0o777) !== 0o666) {
      fs.chmodSync(dbPath, 0o666);
      console.log('[Scheduler-Service] DB chmod corregido a 666');
    }
  }
} catch { /* ignore */ }

import db from './src/lib/db';
import { enqueue } from './src/lib/jobs/queue';
import { getFrecuenciaEfectiva, frecuenciaToChecksDia, getFrecuenciaBase, frecuenciaToMs } from './src/lib/jobs/frequency/calculator';
import { calcularHorariosOptimos, getHorariosDefault } from './src/lib/jobs/histogram/calculator';
import { buildCronEntries, getBoletinCronEntries, getMantenimientoCronEntry, formatCronHuman } from './src/lib/jobs/histogram/cron-builder';
import { CHECK_FIRST_CONFIG, QUEUE_LIMITS, AUTODESCUBRIMIENTO_CONFIG } from './src/lib/jobs/constants';
import { determinarCapa } from './src/lib/jobs/source-lifecycle';

// ═══════════════════════════════════════════════════════════════
// CRON OPTIONS — timezone Bolivia (America/La_Paz)
// FIX: Sin esto, node-cron usa UTC del sistema y las tareas
// se disparan a horas incorrectas (ej: 7 AM Bolivia → 7 AM UTC).
// ═══════════════════════════════════════════════════════════════
const CRON_OPTS = { scheduled: true, timezone: 'America/La_Paz' };

// ═══════════════════════════════════════════════════════════════
// Health Heartbeat
// ═══════════════════════════════════════════════════════════════

const HEARTBEAT_PATH = path.join(os.tmpdir(), 'decodex-scheduler-heartbeat');

interface SchedulerState {
  tasks: ScheduledTask[];
  startTime: Date | null;
  totalScheduled: number;
  lastReschedule: Date | null;
}

const state: SchedulerState = {
  tasks: [],
  startTime: new Date(),
  totalScheduled: 0,
  lastReschedule: null,
};

function writeHeartbeat(): void {
  try {
    const data = JSON.stringify({
      pid: process.pid,
      uptime: state.startTime ? Math.floor((Date.now() - state.startTime.getTime()) / 1000) : 0,
      totalTasks: state.tasks.length,
      totalScheduled: state.totalScheduled,
      lastReschedule: state.lastReschedule?.toISOString() ?? null,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(HEARTBEAT_PATH, data);
  } catch { /* ignore */ }
}

function cleanupHeartbeat(): void {
  try { fs.unlinkSync(HEARTBEAT_PATH); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// GAP DETECTOR: Recuperación automática tras downtime
// ═══════════════════════════════════════════════════════════════
// Al iniciar, verifica si hubo un gap sin capturas. Si >2h:
// - Reactiva fuentes inactivas por la caída
// - Resetea fallos consecutivos injustos
// - Dispara checks inmediatos
// - Encola batch_llm si hay notas pendientes

async function detectarYRecuperarGap(): Promise<void> {
  console.log('[Scheduler-Service] Ejecutando Gap Detector...');

  try {
    const ultimaFuenteCheck = await db.fuenteEstado.findFirst({
      where: { ultimoCheckOk: { not: null } },
      orderBy: { ultimoCheckOk: 'desc' },
      select: { ultimoCheckOk: true, medioId: true },
    });

    const ahora = Date.now();

    if (!ultimaFuenteCheck?.ultimoCheckOk) {
      console.log('[Scheduler-Service] Gap Detector: sin historial de checks, saltando');
      return;
    }

    const gapMs = ahora - ultimaFuenteCheck.ultimoCheckOk.getTime();
    const gapHoras = gapMs / (1000 * 60 * 60);
    const UMBRAL_GAP_HORAS = 2;

    if (gapHoras < UMBRAL_GAP_HORAS) {
      console.log(`[Scheduler-Service] Gap Detector: último check hace ${gapHoras.toFixed(1)}h — sin gap significativo`);
      return;
    }

    // ── GAP DETECTADO ──
    console.warn(`[Scheduler-Service] ⚠️ GAP DETECTADO: ${gapHoras.toFixed(1)}h sin capturas (último: ${ultimaFuenteCheck.ultimoCheckOk.toISOString()})`);

    // 1. Reactivar fuentes inactivas
    const fuentesInactivas = await db.fuenteEstado.findMany({
      where: { estado: 'inactiva' },
    });
    let reactivadas = 0;
    for (const fuente of fuentesInactivas) {
      await db.fuenteEstado.update({
        where: { id: fuente.id },
        data: { estado: 'activa', activo: true, fallosConsecutivos: 0 },
      });
      reactivadas++;
    }
    if (reactivadas > 0) console.log(`[Scheduler-Service] Gap Recovery: ${reactivadas} fuentes reactivadas`);

    // 2. Resetear fallos de fuentes activas
    const resetResult = await db.fuenteEstado.updateMany({
      where: { fallosConsecutivos: { gt: 0 } },
      data: { fallosConsecutivos: 0 },
    });
    if (resetResult.count > 0) console.log(`[Scheduler-Service] Gap Recovery: ${resetResult.count} fallos reseteados`);

    // 3. Disparar checks inmediatos (max 5)
    const fuentesActivas = await db.fuenteEstado.findMany({
      where: { estado: 'activa', activo: true },
    });
    let checksDisparados = 0;
    for (const fuente of fuentesActivas.slice(0, 5)) {
      const pendingJob = await db.job.findFirst({
        where: { tipo: 'check_fuente', estado: 'pendiente', payload: { contains: fuente.id } },
      });
      if (pendingJob) continue;

      await enqueue({
        tipo: 'check_fuente',
        prioridad: 1 as 0 | 1 | 3 | 5 | 7 | 9,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      });
      checksDisparados++;
    }
    if (checksDisparados > 0) console.log(`[Scheduler-Service] Gap Recovery: ${checksDisparados} checks inmediatos`);

    // 4. Encolar batch_llm si hay notas pendientes
    const pendientesLLM = await db.notaRaw.count({ where: { procesada: false, descartada: false } });
    if (pendientesLLM > 0) {
      const pendingBatch = await db.job.findFirst({ where: { tipo: 'batch_llm', estado: 'pendiente' } });
      if (!pendingBatch) {
        await enqueue({ tipo: 'batch_llm', prioridad: 3, payload: {} });
        console.log(`[Scheduler-Service] batch_llm encolado tras gap (${pendientesLLM} notas pendientes)`);
      }
    }

    // 5. Registrar en SystemLog
    await db.systemLog.create({
      data: {
        modulo: 'scheduler',
        accion: 'gap_recovery',
        detalle: `Gap de ${gapHoras.toFixed(1)}h: ${reactivadas} reactivadas, ${resetResult.count} fallos reseteados, ${checksDisparados} checks, ${pendientesLLM} notas LLM`,
        automatica: true,
        datos: JSON.stringify({ gapHoras: Math.round(gapHoras * 10) / 10, reactivadas, fallosReseteados: resetResult.count, checksDisparados, pendientesLLM }),
      },
    }).catch(() => {});

    console.log(`[Scheduler-Service] ✓ Gap Recovery completado`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler-Service] Error en Gap Detector: ${msg}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTODESCUBRIMIENTO: Ajuste automático de frecuencias
// ═══════════════════════════════════════════════════════════════
// Analiza NotaRaw de cada fuente y ajusta frecuenciaBase/frecuenciaActual
// según el patrón de publicación real. Factor de seguridad 0.7.

async function autodescubrirFrecuencias(): Promise<void> {
  console.log('[Scheduler-Service] Ejecutando autodescubrimiento de frecuencias...');

  try {
    const config = AUTODESCUBRIMIENTO_CONFIG;
    const ventanaInicio = new Date(Date.now() - config.ventanaAnalisisHoras * 60 * 60 * 1000);

    const fuentes = await db.fuenteEstado.findMany({
      where: { estado: { not: 'deprecada' } },
      include: { Medio: { select: { nombre: true, categoria: true, url: true } } },
    });

    let ajustadas = 0;
    const FRECUENCIA_LEVELS = [
      { key: '2h', minutos: 120 },
      { key: '4h', minutos: 240 },
      { key: '6h', minutos: 360 },
    ];

    for (const fuente of fuentes) {
      try {
        // Contar notas recientes
        const notasRecientes = await db.notaRaw.count({
          where: { medioId: fuente.medioId, fechaCaptura: { gte: ventanaInicio } },
        });

        if (notasRecientes < config.minNotasParaAutoajuste) {
          // Sin historial: corregir con frecuencia de categoría
          const freqBaseCorrecta = getFrecuenciaBase(
            fuente.Medio.nombre, fuente.Medio.categoria, fuente.Medio.url,
          );
          if (fuente.frecuenciaBase !== freqBaseCorrecta) {
            await db.fuenteEstado.update({
              where: { id: fuente.id },
              data: { frecuenciaBase: freqBaseCorrecta, frecuenciaActual: freqBaseCorrecta },
            });
            ajustadas++;
            console.log(`[Scheduler-Service] Autodescubrimiento: ${fuente.Medio.nombre} → ${freqBaseCorrecta} (categoría, sin historial)`);
          }
          continue;
        }

        // Calcular intervalo promedio entre publicaciones
        const notasConFecha = await db.notaRaw.findMany({
          where: { medioId: fuente.medioId, fechaCaptura: { gte: ventanaInicio } },
          orderBy: { fechaCaptura: 'asc' },
          select: { fechaCaptura: true },
        });

        if (notasConFecha.length < 2) continue;

        let totalIntervaloMin = 0;
        let intervalos = 0;
        for (let i = 1; i < notasConFecha.length; i++) {
          const diff = notasConFecha[i].fechaCaptura.getTime() - notasConFecha[i - 1].fechaCaptura.getTime();
          if (diff < 24 * 60 * 60 * 1000) { // Ignorar gaps >24h
            totalIntervaloMin += diff / (1000 * 60);
            intervalos++;
          }
        }

        if (intervalos === 0) continue;

        const intervaloPromedioMin = totalIntervaloMin / intervalos;
        const intervaloAjustadoMin = intervaloPromedioMin * config.factorSeguridad;

        let nuevaFreq: string | null = null;
        for (const level of FRECUENCIA_LEVELS) {
          if (intervaloAjustadoMin <= level.minutos) { nuevaFreq = level.key; break; }
        }
        if (!nuevaFreq) nuevaFreq = config.frecuenciaMaxima;

        // Verificar cambio significativo (>30%)
        const freqActualMs = frecuenciaToMs(fuente.frecuenciaActual);
        const nuevaFreqMs = frecuenciaToMs(nuevaFreq);
        const diffPct = Math.abs(nuevaFreqMs - freqActualMs) / freqActualMs * 100;

        if (diffPct > config.umbralCambio) {
          await db.fuenteEstado.update({
            where: { id: fuente.id },
            data: { frecuenciaBase: nuevaFreq, frecuenciaActual: nuevaFreq },
          });
          ajustadas++;
          console.log(
            `[Scheduler-Service] Autodescubrimiento: ${fuente.Medio.nombre} ${fuente.frecuenciaActual} → ${nuevaFreq} ` +
            `(prom: ${Math.round(intervaloPromedioMin)}min, ${notasRecientes} notas/7d)`
          );
        }
      } catch (err) {
        console.warn(`[Scheduler-Service] Error autodescubriendo ${fuente.Medio?.nombre || fuente.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (ajustadas > 0) {
      console.log(`[Scheduler-Service] ✓ Autodescubrimiento: ${ajustadas} fuentes ajustadas de ${fuentes.length} evaluadas`);
      await db.systemLog.create({
        data: {
          modulo: 'scheduler',
          accion: 'autodescubrimiento_frecuencias',
          detalle: `${ajustadas} fuentes ajustadas por autodescubrimiento de ${fuentes.length} evaluadas`,
          automatica: true,
          datos: JSON.stringify({ ajustadas, total: fuentes.length }),
        },
      }).catch(() => {});
    } else {
      console.log(`[Scheduler-Service] Autodescubrimiento: sin cambios necesarios (${fuentes.length} fuentes evaluadas)`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler-Service] Error en autodescubrimiento: ${msg}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Programación de Fuentes
// ═══════════════════════════════════════════════════════════════

async function scheduleCheckJobs(): Promise<number> {
  // FIX: Usar raw SQL con LEFT JOIN para evitar crash con registros huérfanos
  // (FuenteEstado con medioId que no corresponde a ningún Medio)
  const fuentes = await db.$queryRaw`
    SELECT
      fe.id, fe.medioId, fe.url, fe.frecuenciaBase, fe.frecuenciaActual,
      fe.horasPublicacion, fe.ultimoCheck, fe.ultimoCheckOk, fe.ultimoHeadline,
      fe.ultimoTexto, fe.ultimoMencion, fe.estado, fe.activo,
      fe.fallosConsecutivos, fe.totalChecks,
      m.nombre AS medioNombre, m.categoria AS medioCategoria,
      m.nivel AS medioNivel, m.frecuenciaOverride AS medioFrecuenciaOverride
    FROM FuenteEstado fe
    LEFT JOIN Medio m ON fe.medioId = m.id
    WHERE fe.estado = 'activa'
  ` as Array<Record<string, unknown>>;

  // Filtrar registros huérfanos (sin Medio asociado) y loggear
  const validFuentes = fuentes.filter(f => {
    if (!f.medioNombre) {
      console.warn(`[Scheduler-Service] FuenteEstado huérfano ignorado: ${f.id} → medioId ${f.medioId} no existe`);
      return false;
    }
    return true;
  });

  if (validFuentes.length === 0) {
    console.log('[Scheduler-Service] No hay fuentes activas válidas');
    return 0;
  }

  let scheduledCount = 0;
  let omitidas = 0;
  let probes = 0;

  for (const fuente of validFuentes) {
    try {
      const capa = determinarCapa({
        ultimoCheckOk: fuente.ultimoCheckOk as Date | null,
        ultimoHeadline: fuente.ultimoHeadline as Date | null,
        ultimoTexto: fuente.ultimoTexto as Date | null,
        ultimoMencion: fuente.ultimoMencion as Date | null,
        estado: (fuente.estado as string) || 'creada',
        activo: fuente.activo as boolean,
        fallosConsecutivos: (fuente.fallosConsecutivos as number) || 0,
        totalChecks: (fuente.totalChecks as number) || 0,
      });

      if (capa < 1) {
        scheduleProbeCheck(fuente);
        probes++;
        omitidas++;
        continue;
      }

      const count = scheduleFuente(fuente);
      scheduledCount += count;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Scheduler-Service] Error programando ${fuente.medioNombre}: ${msg}`);
    }
  }

  console.log(`[Scheduler-Service] ${validFuentes.length} fuentes: ${scheduledCount} tareas, ${omitidas} omitidas (capa 0), ${probes} probes`);

  // CATCH-UP POST-RESTART: ejecutar inmediatamente fuentes con checks vencidos
  await catchUpOverdueSources(validFuentes);

  return scheduledCount;
}

function scheduleFuente(fuente: Record<string, unknown>): number {
  const medioNombre = String(fuente.medioNombre || '');
  const medioCategoria = String(fuente.medioCategoria || '');
  const medioNivel = String(fuente.medioNivel || '1');
  const medioFrecuenciaOverride = String(fuente.medioFrecuenciaOverride || '');

  const { efectiva } = getFrecuenciaEfectiva(
    String(fuente.frecuenciaBase || '6h'),
    String(fuente.frecuenciaActual || '6h'),
    medioFrecuenciaOverride || null,
  );

  const numChecks = frecuenciaToChecksDia(efectiva);
  if (numChecks <= 0) {
    scheduleSingleCheck(fuente, 0, 9);
    return 1;
  }

  let horarios: number[];
  try {
    const histograma = JSON.parse(String(fuente.horasPublicacion || '{}'));
    horarios = calcularHorariosOptimos(histograma, numChecks);
  } catch {
    const defaults = getHorariosDefault(medioNombre, '');
    horarios = defaults || distribuirFallback(numChecks);
  }

  // Guardar horarios en DB
  db.fuenteEstado.update({
    where: { id: fuente.id as string },
    data: { horariosOptimos: JSON.stringify(horarios) },
  }).catch(() => {});

  const domain = medioNombre.toLowerCase().includes('tiempos') ? 'lostiempos.com' : '';
  const prioridad = domain === 'lostiempos.com' ? 0 : (medioNivel === '1' ? 1 : 3);

  for (const hora of horarios) {
    scheduleSingleCheck(fuente, prioridad, hora);
  }

  return horarios.length;
}

function scheduleSingleCheck(
  fuente: Record<string, unknown>,
  prioridad: number,
  hora: number,
): void {
  const expresion = `0 ${hora} * * *`;
  if (!cron.validate(expresion)) return;

  const task = cron.schedule(expresion, async () => {
    try {
      const ultimoCheck = await db.fuenteEstado.findUnique({
        where: { id: fuente.id },
        select: { ultimoCheck: true },
      });

      if (ultimoCheck?.ultimoCheck) {
        const mins = (Date.now() - ultimoCheck.ultimoCheck.getTime()) / 60000;
        if (mins < CHECK_FIRST_CONFIG.minTimeBetweenChecks) {
          console.log(`[Scheduler-Service] OMITIDO ${fuente.medioNombre || fuente.id}: último check hace ${Math.round(mins)} min (< ${CHECK_FIRST_CONFIG.minTimeBetweenChecks} min)`);
          return;
        }
      }

      const pendingJob = await db.job.findFirst({
        where: { tipo: 'check_fuente', estado: 'pendiente', payload: { contains: fuente.id } },
      });
      if (pendingJob) {
        console.log(`[Scheduler-Service] OMITIDO ${fuente.medioNombre || fuente.id}: ya existe check_fuente pendiente (job ${pendingJob.id})`);
        return;
      }

      const pendingCount = await db.job.count({ where: { estado: 'pendiente' } });
      if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) {
        console.log(`[Scheduler-Service] OMITIDO ${fuente.medioNombre || fuente.id}: cola llena (${pendingCount}/${QUEUE_LIMITS.maxPendingJobs})`);
        return;
      }

      await enqueue({
        tipo: 'check_fuente',
        prioridad: prioridad as 0 | 1 | 3 | 5 | 7 | 9,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      });

      state.totalScheduled++;
      console.log(`[Scheduler-Service] check_fuente encolado para ${fuente.medioNombre || fuente.id} (hora ${hora})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      console.error(`[Scheduler-Service] FATAL en tarea ${fuente.medioNombre || fuente.id}: ${msg}`);
      if (stack) console.error(`[Scheduler-Service] Stack trace:`, stack);
    }
  }, CRON_OPTS);

  state.tasks.push(task);
}

// ═══════════════════════════════════════════════════════════════
// CATCH-UP POST-RESTART
// ═══════════════════════════════════════════════════════════════
// Ejecuta inmediatamente checks para fuentes cuyo último check
// es más antiguo que 60% de su frecuencia. Elimina el hueco
// post-restart donde los cron jobs pueden tardar hasta 1h.

async function catchUpOverdueSources(fuentes: Array<Record<string, unknown>>): Promise<void> {
  const ahora = Date.now();
  let catchUps = 0;

  console.log(`[Scheduler-Service] Catch-up: evaluando ${fuentes.length} fuentes...`);

  // Ordenar por más vencidas primero (null ultimoCheck = máxima prioridad)
  const sorted = [...fuentes].sort((a, b) => {
    if (!a.ultimoCheck) return -1;
    if (!b.ultimoCheck) return 1;
    return new Date(a.ultimoCheck as string | number).getTime() - new Date(b.ultimoCheck as string | number).getTime();
  });

  for (const fuente of sorted) {
    try {
      const medioNombre = String(fuente.medioNombre || fuente.id);

      // Skip si se checkeó hace menos de 10 minutos
      if (fuente.ultimoCheck) {
        const ultimoCheckDate = new Date(fuente.ultimoCheck as string | number);
        const minsAgo = (ahora - ultimoCheckDate.getTime()) / 60000;
        if (minsAgo < 10) continue;

        // Verificar si está vencida: más de 60% de su frecuencia
        const { efectiva } = getFrecuenciaEfectiva(
          String(fuente.frecuenciaBase || '6h'),
          String(fuente.frecuenciaActual || '6h'),
          String(fuente.medioFrecuenciaOverride || '') || null,
        );
        const freqMin = frecuenciaToMs(efectiva) / 60000;
        if (minsAgo < freqMin * 0.6) continue;
      }
      // Si ultimoCheck es null, la fuente nunca fue checkeada → ejecutar

      // No duplicar: verificar que no haya un job pendiente
      const pending = await db.job.findFirst({
        where: {
          tipo: 'check_fuente',
          estado: 'pendiente',
          payload: { contains: fuente.id },
        },
      });
      if (pending) continue;

      const medioNivel = String(fuente.medioNivel || '3');
      const prioridad = medioNivel === '1' ? 1 : 3;

      await enqueue({
        tipo: 'check_fuente',
        prioridad: prioridad as 0 | 1 | 3 | 5 | 7 | 9,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      });
      catchUps++;

      const minsAgo = fuente.ultimoCheck
        ? Math.round((ahora - new Date(fuente.ultimoCheck as string | number).getTime()) / 60000)
        : 'nunca';
      console.log(`[Scheduler-Service] Catch-up: ${medioNombre} (${minsAgo}min sin check, freq=${String(fuente.frecuenciaActual || '?')})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scheduler-Service] Catch-up error ${String(fuente.medioNombre || fuente.id)}: ${msg}`);
    }
  }

  if (catchUps > 0) {
    console.log(`[Scheduler-Service] Catch-up: ${catchUps} fuentes vencidas ejecutadas inmediatamente`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Programación de Boletines ONION200
// ═══════════════════════════════════════════════════════════════

function scheduleBoletinJobs(): number {
  const entries = getBoletinCronEntries();
  for (const entry of entries) {
    if (!cron.validate(entry.expresion)) continue;

    const task = cron.schedule(entry.expresion, async () => {
      try {
        const pendingCount = await db.job.count({ where: { estado: 'pendiente' } });
        if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) return;

        const productType = entry.tipoBoletin || entry.tipo;
        await enqueue({
          tipo: 'generar_boletin',
          prioridad: entry.prioridad as 0 | 1 | 3 | 5 | 7 | 9,
          payload: { tipoBoletin: productType, programado: true },
        });

        state.totalScheduled++;
        console.log(`[Scheduler-Service] Boletin ${productType} encolado`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : '';
        console.error(`[Scheduler-Service] FATAL en boletin ${entry.tipo}: ${msg}`);
        if (stack) console.error(`[Scheduler-Service] Stack trace:`, stack);
      }
    }, CRON_OPTS);

    state.tasks.push(task);
  }
  console.log(`[Scheduler-Service] ${entries.length} boletines programados`);
  return entries.length;
}

// ═══════════════════════════════════════════════════════════════
// Captura de Indicadores Tier 1
// ═══════════════════════════════════════════════════════════════

async function scheduleIndicatorJobs(): Promise<number> {
  const count = await db.indicador.count({ where: { activo: true, tier: 1 } });
  if (count === 0) {
    console.log('[Scheduler-Service] No hay indicadores Tier 1');
    return 0;
  }

  // 08:00 AM Bolivia (con timezone corregido)
  const expresion = '0 8 * * *';
  if (!cron.validate(expresion)) return 0;

  const task = cron.schedule(expresion, async () => {
    try {
      const pendingCapture = await db.job.findFirst({ where: { tipo: 'capture_indicador', estado: 'pendiente' } });
      if (pendingCapture) return;

      const ayer = new Date();
      ayer.setHours(ayer.getHours() - 23);
      const recent = await db.job.findFirst({ where: { tipo: 'capture_indicador', estado: 'completado', fechaFin: { gte: ayer } } });
      if (recent) return;

      await enqueue({ tipo: 'capture_indicador', prioridad: 3, payload: { capturarTodos: true } });
      state.totalScheduled++;
      console.log('[Scheduler-Service] capture_indicador encolado (Tier 1 batch)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      console.error(`[Scheduler-Service] FATAL en captura indicadores: ${msg}`);
      if (stack) console.error(`[Scheduler-Service] Stack trace:`, stack);
    }
  }, CRON_OPTS);

  state.tasks.push(task);
  console.log(`[Scheduler-Service] Captura indicadores Tier 1 programada (08:00 AM) — ${count} indicadores`);
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// Batch LLM — procesa NotaRaw pendientes cada 45 min
// ═══════════════════════════════════════════════════════════════

function scheduleBatchLLM(): number {
  const minutos = [15, 60, 105, 150, 195, 240, 285, 330, 375, 420, 465, 510, 555, 600, 645, 690, 735, 780, 825, 870, 915, 960, 1005, 1050, 1095, 1140, 1185, 1230, 1275, 1320, 1365, 1410];
  let count = 0;

  for (const minuto of minutos) {
    const hora = Math.floor(minuto / 60);
    const min = minuto % 60;
    const expresion = `${min} ${hora} * * *`;
    if (!cron.validate(expresion)) continue;

    const task = cron.schedule(expresion, async () => {
      try {
        const pendientes = await db.notaRaw.count({
          where: { procesada: false, descartada: false },
        });
        if (pendientes === 0) return;

        const pending = await db.job.findFirst({
          where: { tipo: 'batch_llm', estado: 'pendiente' },
        });
        if (pending) {
          // FIX: Si batch_llm lleva > 30min pendiente, cancelarlo y reencolar
          // (previene deadlock permanente si un batch_llm se atasca)
          const pendingAge = Date.now() - pending.fechaCreacion.getTime();
          if (pendingAge > 30 * 60 * 1000) {
            await db.job.update({
              where: { id: pending.id },
              data: { estado: 'completado', fechaFin: new Date(), resultado: JSON.stringify({ clean: true, reason: 'batch_llm stale > 30min, reencolado' }) },
            });
            console.warn(`[Scheduler-Service] batch_llm ${pending.id} liberado (pendiente > 30min), reencolando...`);
          } else {
            return; // batch_llm reciente pendiente, esperar
          }
        }

        await enqueue({ tipo: 'batch_llm', prioridad: 3, payload: {} });
        state.totalScheduled++;
        console.log(`[Scheduler-Service] batch_llm encolado (${pendientes} notas pendientes)`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : '';
        console.error(`[Scheduler-Service] FATAL en batch_llm: ${msg}`);
        if (stack) console.error(`[Scheduler-Service] Stack trace:`, stack);
      }
    }, CRON_OPTS);

    state.tasks.push(task);
    count++;
  }

  console.log(`[Scheduler-Service] Batch LLM programado cada 45 min (${count} tareas)`);
  return count;
}

// ═══════════════════════════════════════════════════════════════
// Mantenimiento Nocturno
// ═══════════════════════════════════════════════════════════════

function scheduleMaintenanceJob(): number {
  const entry = getMantenimientoCronEntry();

  const task = cron.schedule(entry.expresion, async () => {
    try {
      await enqueue({
        tipo: 'mantenimiento',
        prioridad: 9,
        payload: { tareas: ['degradar_fuentes', 'recalcular_horarios', 'recalcular_scheduler', 'autodescubrir_frecuencias', 'limpiar_jobs', 'purge_notas_raw'] },
      });
      state.totalScheduled++;
      console.log('[Scheduler-Service] Mantenimiento nocturno encolado');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en mantenimiento: ${msg}`);
    }
  }, CRON_OPTS);

  state.tasks.push(task);
  console.log('[Scheduler-Service] Mantenimiento nocturno programado (04:00 AM)');
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// Reschedule Periódico (cada 6h)
// ═══════════════════════════════════════════════════════════════

function schedulePeriodicReschedule(): void {
  // Cada 6 horas: recalcular horarios para fuentes activas
  const expresion = '0 */6 * * *';
  if (!cron.validate(expresion)) return;

  const task = cron.schedule(expresion, async () => {
    try {
      console.log('[Scheduler-Service] Reschedule periódico iniciando...');

      // FIX: Crear nuevas tareas ANTES de destruir las viejas
      // para evitar que un error deje el scheduler sin tareas.
      const oldTasks = [...state.tasks];
      const newTasks: ScheduledTask[] = [];
      state.tasks = newTasks;

      await autodescubrirFrecuencias();
      await scheduleCheckJobs();
      await scheduleIndicatorJobs();
      scheduleBoletinJobs();
      scheduleBatchLLM();
      scheduleMaintenanceJob();

      // Detener tareas viejas solo DESPUÉS de crear las nuevas
      for (const t of oldTasks) {
        try { t.stop(); } catch { /* ignore */ }
      }

      // FIX: Re-registrar el reschedule a sí mismo (antes se suicidaba)
      schedulePeriodicReschedule();

      state.lastReschedule = new Date();
      console.log(`[Scheduler-Service] Reschedule completo: ${state.tasks.length} tareas`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en reschedule: ${msg}`);
      // FIX: Intentar recuperación en vez de dejar el scheduler muerto
      console.log('[Scheduler-Service] Intentando recuperación tras error de reschedule...');
      try {
        await fullReschedule();
      } catch (recoveryErr) {
        console.error(`[Scheduler-Service] Recuperación fallida, forzando reinicio: ${recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)}`);
        process.exit(1);
      }
    }
  }, CRON_OPTS);

  state.tasks.push(task);
}

/** Reschedule completo desde cero — usado para recuperación */
async function fullReschedule(): Promise<void> {
  for (const t of state.tasks) {
    try { t.stop(); } catch { /* ignore */ }
  }
  state.tasks.length = 0;

  await autodescubrirFrecuencias();
  await scheduleCheckJobs();
  await scheduleIndicatorJobs();
  scheduleBoletinJobs();
  scheduleBatchLLM();
  scheduleMaintenanceJob();
  schedulePeriodicReschedule();

  console.log(`[Scheduler-Service] fullReschedule completado: ${state.tasks.length} tareas`);
}

// ═══════════════════════════════════════════════════════════════
// Probe Check — una oportunidad para fuentes en capa 0
// ═══════════════════════════════════════════════════════════════

function scheduleProbeCheck(fuente: Record<string, unknown>): void {
  // Un solo check en ventana de baja actividad (0:00-4:00)
  // Horas muertas: no hay boletines, ni scrapes, ni batch_llm
  const hora = Math.floor(Math.random() * 5); // 0, 1, 2, 3 o 4
  const expresion = `0 ${hora} * * *`;
  if (!cron.validate(expresion)) return;

  const task = cron.schedule(expresion, async () => {
    try {
      // No duplicar si ya hay un check pendiente para esta fuente
      const pendingJob = await db.job.findFirst({
        where: { tipo: 'check_fuente', estado: 'pendiente', payload: { contains: fuente.id } },
      });
      if (pendingJob) return;

      await enqueue({
        tipo: 'check_fuente',
        prioridad: 5,  // P3 — prioridad media (horas muertas, no compite con nada)
        payload: { fuenteId: fuente.id, medioId: fuente.medioId, probe: true },
      });

      state.totalScheduled++;
      console.log(`[Scheduler-Service] probe check encolado para ${fuente.medioNombre || fuente.id} (capa 0, hora ${hora})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en probe ${fuente.medioNombre || fuente.id}: ${msg}`);
    }
  }, CRON_OPTS);

  state.tasks.push(task);
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function distribuirFallback(numChecks: number): number[] {
  const ventana = { inicio: 6, fin: 22 };
  const rango = ventana.fin - ventana.inicio;
  const paso = rango / (numChecks + 1);
  return Array.from({ length: numChecks }, (_, i) => Math.round(ventana.inicio + paso * (i + 1)));
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX Scheduler Service — Proceso Independiente');
  console.log(`  PID: ${process.pid}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log('═══════════════════════════════════════════════════');

  // 0. GAP DETECTOR: recuperar tras downtime
  await detectarYRecuperarGap();

  // 0b. AUTODESCUBRIMIENTO: ajustar frecuencias según publicación real
  await autodescubrirFrecuencias();

  // Programar todo
  await scheduleCheckJobs();
  await scheduleIndicatorJobs();
  scheduleBoletinJobs();
  scheduleBatchLLM();
  scheduleMaintenanceJob();
  schedulePeriodicReschedule();

  // Heartbeat cada 5s
  setInterval(writeHeartbeat, 5000);
  writeHeartbeat();

  // FIX: NotaRaw Watchdog — verifica cada 10 min si hay notas pendientes sin batch_llm
  // Esto cubre la ventana entre los cron de batch_llm (cada 45min) y evita que
  // notas se queden sin procesar por horas si el cron se pierde por un restart
  setInterval(async () => {
    try {
      const pendientes = await db.notaRaw.count({
        where: { procesada: false, descartada: false },
      });
      if (pendientes === 0) return;

      // Verificar si hay un batch_llm activo (pendiente o en_progreso reciente)
      const activeBatch = await db.job.findFirst({
        where: {
          tipo: 'batch_llm',
          estado: { in: ['pendiente', 'en_progreso'] },
        },
        orderBy: { fechaCreacion: 'desc' },
      });

      if (activeBatch) {
        // Si lleva > 45min, liberarlo
        const age = Date.now() - activeBatch.fechaCreacion.getTime();
        if (age > 45 * 60 * 1000) {
          await db.job.update({
            where: { id: activeBatch.id },
            data: { estado: 'completado', fechaFin: new Date(), resultado: JSON.stringify({ clean: true, reason: 'watchdog: batch_llm stale > 45min' }) },
          });
          console.warn(`[Scheduler-Service] Watchdog: batch_llm ${activeBatch.id} liberado (stale > 45min)`);
        } else {
          return; // batch activo reciente, no reencolar
        }
      }

      // No batch activo y hay notas pendientes → encolar
      await enqueue({ tipo: 'batch_llm', prioridad: 3, payload: {} });
      state.totalScheduled++;
      console.log(`[Scheduler-Service] Watchdog: batch_llm encolado (${pendientes} notas pendientes sin batch activo)`);
    } catch (err) {
      // Non-critical — solo log
    }
  }, 10 * 60 * 1000); // cada 10 min

  console.log(`[Scheduler-Service] ${state.tasks.length} tareas cron activas + watchdog activo`);

  // Mantener proceso vivo
  await new Promise<void>(() => {
    // Este promise NUNCA se resuelve — el proceso vive hasta SIGINT/SIGTERM
  });
}

// ═══════════════════════════════════════════════════════════════
// Graceful Shutdown
// ═══════════════════════════════════════════════════════════════

function shutdown(signal: string): void {
  console.log(`\n[Scheduler-Service] Recibida señal ${signal} — cerrando...`);

  for (const task of state.tasks) {
    task.stop();
  }
  state.tasks.length = 0;

  cleanupHeartbeat();
  console.log('[Scheduler-Service] Todas las tareas detenidas — shutdown limpio');

  db.$disconnect().then(() => process.exit(0)).catch(() => process.exit(1));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', async (err) => {
  console.error('[Scheduler-Service] Uncaught exception:', err);
  writeHeartbeat();
  // FIX: Intentar recuperar tareas; si falla, PM2 reiniciará el proceso
  try {
    console.log('[Scheduler-Service] Recuperando tareas tras uncaughtException...');
    await fullReschedule();
  } catch {
    console.error('[Scheduler-Service] Recuperación fallida — forzando exit para PM2 restart');
    process.exit(1);
  }
});
process.on('unhandledRejection', async (reason) => {
  console.error('[Scheduler-Service] Unhandled rejection:', reason);
  writeHeartbeat();
  // FIX: Intentar recuperar tareas; si falla, PM2 reiniciará el proceso
  try {
    console.log('[Scheduler-Service] Recuperando tareas tras unhandledRejection...');
    await fullReschedule();
  } catch {
    console.error('[Scheduler-Service] Recuperación fallida — forzando exit para PM2 restart');
    process.exit(1);
  }
});

// ═══════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════

main().catch((err) => {
  console.error('[Scheduler-Service] Fatal error:', err);
  process.exit(1);
});
