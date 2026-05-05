/**
 * DECODEX v0.8.0 — Scheduler de Generadores
 * Motor ONION200 — Equipo B — TAREA 3e
 *
 * Programacion horaria de generacion de productos.
 * Evalua que productos deben generarse segun
 * la hora de Bolivia (America/La_Paz) y los
 * schedules definidos en products.ts.
 *
 * Uso:
 *   import { GeneratorScheduler } from '@/lib/scheduler/generator-scheduler';
 *   const scheduler = new GeneratorScheduler();
 *   scheduler.start(); // inicia el loop
 *   scheduler.stop();  // detiene el loop
 */

import { PRODUCTOS } from '@/constants/products';
import { type TipoBoletin, type ScheduleConfig } from '@/types/bulletin';
import { formatFechaBolivia, getDateRange } from '@/lib/bulletin/product-generator';
import { getNowBolivia } from '@/lib/reportes-utils';

// ============================================
// Intervalo de revision (5 minutos minimo)
// ============================================

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// ============================================
// Schedules por producto (extraido de ProductoConfig)
// ============================================

function getScheduleForTipo(tipo: TipoBoletin): ScheduleConfig | null {
  const config = PRODUCTOS[tipo];
  if (!config || !config.activo) return null;
  if (config.frecuencia === 'bajo_demanda' || config.frecuencia === 'tiempo_real') return null;

  const horarioMatch = config.horarioEnvio.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!horarioMatch) return null;

  let hora = parseInt(horarioMatch[1], 10);
  const minuto = parseInt(horarioMatch[2], 10) || 0;
  const ampm = horarioMatch[3]?.toUpperCase();

  if (ampm === 'PM' && hora !== 12) hora += 12;
  if (ampm === 'AM' && hora === 12) hora = 0;

  const diaSemana: number[] | undefined = config.frecuencia === 'semanal'
    ? [1] // lunes
    : undefined;

  return {
    activo: true,
    cron: '',
    horarioBolivia: `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`,
    diaSemana,
    descripcionVentana: config.generador.descripcionVentana,
  };
}

// ============================================
// Registro de ultimas ejecuciones
// ============================================

interface LastExecution {
  tipo: TipoBoletin;
  timestamp: number;
  slotKey: string; // ej: "2026-05-04_07:00"
}

// ============================================
// GeneratorScheduler
// ============================================

export class GeneratorScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastExecutions: Map<TipoBoletin, LastExecution> = new Map();
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? 'http://localhost:3000';
  }

  /**
   * Inicia el loop de revision periodica.
   */
  start(): void {
    if (this.running) {
      console.warn('[scheduler] Ya esta en ejecucion');
      return;
    }

    this.running = true;
    console.log('[scheduler] Iniciado — revision cada 5 minutos');

    // Ejecucion inmediata al arrancar
    this.tick().catch((err) => {
      console.error('[scheduler] Error en tick inicial:', err);
    });

    // Loop periodico
    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[scheduler] Error en tick:', err);
      });
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Detiene el loop de revision.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('[scheduler] Detenido');
  }

  /**
   * Obtiene el estado actual del scheduler.
   */
  getStatus(): {
    running: boolean;
    lastExecutions: Record<string, string | null>;
    nextCheck: number | null;
  } {
    const executions: Record<string, string | null> = {};
    for (const [tipo] of this.lastExecutions) {
      const last = this.lastExecutions.get(tipo);
      executions[tipo] = last ? new Date(last.timestamp).toISOString() : null;
    }

    return {
      running: this.running,
      lastExecutions: executions,
      nextCheck: this.running ? Date.now() + CHECK_INTERVAL_MS : null,
    };
  }

  /**
   * Evalua y ejecuta las tareas pendientes.
   */
  private async tick(): Promise<void> {
    const now = getNowBolivia();
    const currentSlot = this.calculateSlotKey(now);

    console.log(`[scheduler] Tick — ${formatFechaBolivia(now)} — slot: ${currentSlot}`);

    const productosPendientes = this.getProductosParaSlot(now, currentSlot);

    for (const { tipo } of productosPendientes) {
      console.log(`[scheduler] Generando: ${tipo}`);
      try {
        await this.generateProduct(tipo);
        this.lastExecutions.set(tipo, { tipo, timestamp: Date.now(), slotKey: currentSlot });
        console.log(`[scheduler] Completado: ${tipo}`);
      } catch (error) {
        console.error(`[scheduler] Fallido: ${tipo}`, error);
      }
    }
  }

  /**
   * Determina que productos deben generarse en el slot actual.
   */
  private getProductosParaSlot(now: Date, currentSlot: string): Array<{ tipo: TipoBoletin; schedule: ScheduleConfig }> {
    const pendientes: Array<{ tipo: TipoBoletin; schedule: ScheduleConfig }> = [];

    for (const tipo of Object.keys(PRODUCTOS) as TipoBoletin[]) {
      const schedule = getScheduleForTipo(tipo);
      if (!schedule || !schedule.activo) continue;

      // Verificar dia de la semana si aplica
      if (schedule.diaSemana && schedule.diaSemana.length > 0) {
        const diaActual = now.getDay();
        if (!schedule.diaSemana.includes(diaActual)) continue;
      }

      // Verificar que no se ejecuto en este slot
      const lastExec = this.lastExecutions.get(tipo);
      if (lastExec && lastExec.slotKey === currentSlot) continue;

      // Verificar que la hora actual coincide con el horario programado
      const horaProgramada = parseInt(schedule.horarioBolivia.split(':')[0], 10);
      const minutoProgramado = parseInt(schedule.horarioBolivia.split(':')[1], 10) || 0;
      const horaActual = now.getHours();
      const minutoActual = now.getMinutes();

      // Tolerancia de +/- 5 minutos
      const diffMinutos = Math.abs(
        (horaActual * 60 + minutoActual) - (horaProgramada * 60 + minutoProgramado)
      );

      if (diffMinutos <= 5) {
        pendientes.push({ tipo, schedule });
      }
    }

    return pendientes;
  }

  /**
   * Genera un producto llamando al endpoint correspondiente.
   */
  private async generateProduct(tipo: TipoBoletin): Promise<void> {
    // Seleccionar endpoint: dedicado o generico
    let endpoint: string;
    const body: Record<string, unknown> = {};

    // Productos con endpoint dedicado
    const dedicatedEndpoints: Partial<Record<TipoBoletin, string>> = {
      EL_TERMOMETRO: '/api/admin/bulletins/generate-termometro',
      SALDO_DEL_DIA: '/api/admin/bulletins/generate-saldo',
      EL_FOCO: '/api/admin/bulletins/generate-foco',
      EL_RADAR: '/api/admin/bulletins/generate-radar',
    };

    if (dedicatedEndpoints[tipo]) {
      endpoint = dedicatedEndpoints[tipo]!;
    } else {
      endpoint = '/api/admin/bulletins/generate-generic';
      body.tipo = tipo;
    }

    // Para EL_FOCO se necesita ejeSlug
    if (tipo === 'EL_FOCO' || tipo === 'FOCO_DE_LA_SEMANA') {
      body.ejeSlug = await this.getEjeRotativo(tipo);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(`HTTP ${response.status}: ${errorData.error}`);
    }
  }

  /**
   * Obtiene el eje tematico rotativo para productos que lo requieren.
   * Para FOCO_DE_LA_SEMANA rota semanalmente entre los 11 ejes.
   */
  private async getEjeRotativo(tipo: TipoBoletin): Promise<string> {
    const EJES = [
      'politica-nacional', 'economia', 'seguridad', 'medio-ambiente',
      'social', 'internacional', 'legislativo', 'justicia',
      'salud', 'educacion', 'tecnologia',
    ];

    const now = getNowBolivia();
    const semana = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
    const index = semana % EJES.length;

    return EJES[index];
  }

  /**
   * Genera la clave del slot horario para comparacion.
   */
  private calculateSlotKey(fecha: Date): string {
    const hora = fecha.getHours().toString().padStart(2, '0');
    const minuto = (Math.floor(fecha.getMinutes() / 5) * 5).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}_${hora}:${minuto}`;
  }
}

// ============================================
// Singleton para uso global
// ============================================

let schedulerInstance: GeneratorScheduler | null = null;

export function getScheduler(): GeneratorScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new GeneratorScheduler();
  }
  return schedulerInstance;
}
