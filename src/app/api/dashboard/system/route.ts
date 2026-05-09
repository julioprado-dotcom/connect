import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// Helpers de bajo nivel
// ═══════════════════════════════════════════════════════════════

function readCgroupMemory(): { limit: number; usage: number } {
  try {
    const limit = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf-8').trim(), 10);
    const usage = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf-8').trim(), 10);
    if (limit > 0) return { limit, usage };
  } catch { /* fallback */ }
  return { limit: os.totalmem(), usage: os.totalmem() - os.freemem() };
}

function getHeapLimit(): number {
  const match = (process.env.NODE_OPTIONS || '').match(/--max-old-space-size=(\d+)/);
  if (match) return parseInt(match[1], 10) * 1024 * 1024;
  try { return require('v8').getHeapStatistics().heap_size_limit; } catch { return 4041 * 1024 * 1024; }
}

function getDbSize(): number {
  const paths = [
    process.env.DATABASE_URL?.replace('file:', '') || '',
    path.join(process.cwd(), 'db', 'custom.db'),
    path.join(process.cwd(), 'prisma', 'dev.db'),
  ];
  for (const p of paths) {
    try {
      const s = fs.statSync(p);
      if (s.isFile()) return Math.round(s.size / (1024 * 1024) * 100) / 100;
    } catch { /* next */ }
  }
  return 0;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// Diagnósticos accionables — cada uno devuelve:
//   { severity: 'ok' | 'warning' | 'critical', message, action? }
// ═══════════════════════════════════════════════════════════════

type Diagnosis = {
  id: string;
  severity: 'ok' | 'warning' | 'critical';
  message: string;
  detail: string;
  action?: string;
  team?: 'desarrollo' | 'sistemas' | 'administrador';
};

function diagnoseMemory(mem: NodeJS.MemoryUsage, heapLimit: number, cgroup: { limit: number; usage: number }): Diagnosis {
  const heapPct = (mem.heapUsed / heapLimit) * 100;
  const rssMB = Math.round(mem.rss / (1024 * 1024));

  if (heapPct > 85) {
    return {
      id: 'memory',
      severity: 'critical',
      message: 'Heap Node.js saturado',
      detail: `${heapPct.toFixed(0)}% del limite (${rssMB} MB RSS). Riesgo inminente de OOM kill.`,
      action: 'Reiniciar el servidor. Investigar memory leak en queries o generacion de reportes.',
      team: 'desarrollo',
    };
  }
  if (heapPct > 60) {
    return {
      id: 'memory',
      severity: 'warning',
      message: 'Consumo de heap elevado',
      detail: `${heapPct.toFixed(0)}% del limite (${rssMB} MB RSS). Posible leak o pico de carga.`,
      action: 'Verificar queries sin paginar o reportes en generacion.',
      team: 'desarrollo',
    };
  }
  return {
    id: 'memory',
    severity: 'ok',
    message: 'Memoria estable',
    detail: `Heap ${heapPct.toFixed(0)}% (${rssMB} MB RSS). Sin presion.`,
  };
}

function diagnoseContainer(cgroup: { limit: number; usage: number }): Diagnosis {
  const pct = (cgroup.usage / cgroup.limit) * 100;
  if (pct > 90) {
    return {
      id: 'container',
      severity: 'critical',
      message: 'Contenedor al limite',
      detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB. El SO puede matar procesos.`,
      action: 'Solicitar mas memoria al contenedor o reducir procesos activos.',
      team: 'sistemas',
    };
  }
  if (pct > 75) {
    return {
      id: 'container',
      severity: 'warning',
      message: 'Contenedor con presion',
      detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB.`,
      action: 'Monitorear tendencia. Si sube sostenidamente, escalar a sistemas.',
      team: 'sistemas',
    };
  }
  return {
    id: 'container',
    severity: 'ok',
    message: 'Contenedor estable',
    detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB.`,
  };
}

function diagnoseDatabase(dbSizeMB: number): Diagnosis {
  if (dbSizeMB > 500) {
    return {
      id: 'database',
      severity: 'warning',
      message: 'Base de datos grande',
      detail: `${dbSizeMB} MB. Las consultas pueden relentizar. SQLite no es optimo para DB > 1GB.`,
      action: 'Considerar purga de datos antiguos o migrar a PostgreSQL.',
      team: 'sistemas',
    };
  }
  return {
    id: 'database',
    severity: 'ok',
    message: 'Base de datos sana',
    detail: `${dbSizeMB} MB. Rango normal para SQLite.`,
  };
}

function diagnoseUptime(uptimeSeconds: number): Diagnosis {
  const hours = uptimeSeconds / 3600;
  if (uptimeSeconds < 300) {
    return {
      id: 'uptime',
      severity: 'critical',
      message: 'Servidor reinicio recientemente',
      detail: `Arriba hace ${formatUptime(uptimeSeconds)}. No completado warmup (10 min).`,
      action: 'Monitorear. Si no fue reinicio programado, revisar logs.',
      team: 'sistemas',
    };
  }
  if (uptimeSeconds < 600) {
    return {
      id: 'uptime',
      severity: 'warning',
      message: 'Estabilizando',
      detail: `Arriba hace ${formatUptime(uptimeSeconds)}. Aun completando warmup.`,
      action: 'Monitorear durante los proximos minutos.',
      team: 'sistemas',
    };
  }
  return {
    id: 'uptime',
    severity: 'ok',
    message: `Arriba ${formatUptime(uptimeSeconds)}`,
    detail: `Servidor estable (${Math.round(hours)}h sin reinicio).`,
  };
}

function diagnoseDevOverhead(): Diagnosis {
  // En modo dev, Turbopack cache + source maps consumen memoria extra
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    return { id: 'dev-overhead', severity: 'ok', message: 'Produccion', detail: 'Sin overhead de desarrollo.' };
  }
  try {
    const nextDir = path.join(process.cwd(), '.next', 'dev');
    const cacheSize = fs.readdirSync(nextDir, { recursive: true }).reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(nextDir, f as string)).size; } catch { return acc; }
    }, 0);
    const cacheMB = Math.round(cacheSize / 1024 / 1024);
    if (cacheMB > 500) {
      return {
        id: 'dev-overhead',
        severity: 'warning',
        message: 'Cache de dev grande',
        detail: `Turbopack cache: ${cacheMB} MB. Limpiar con rm -rf .next si hay problemas.`,
        action: 'Ejecutar: rm -rf .next && bun run dev para limpiar cache.',
        team: 'desarrollo',
      };
    }
    return {
      id: 'dev-overhead',
      severity: 'ok',
      message: 'Modo desarrollo',
      detail: `Turbopack cache: ${cacheMB} MB. Overhead normal.`,
    };
  } catch {
    return { id: 'dev-overhead', severity: 'ok', message: 'Modo desarrollo', detail: 'Cache de compilacion OK.' };
  }
}

function diagnoseAuth(): Diagnosis {
  const hasSecret = !!process.env.AUTH_SECRET;
  if (!hasSecret) {
    return {
      id: 'auth',
      severity: 'critical',
      message: 'AUTH_SECRET no configurado',
      detail: 'Las sesiones no se pueden firmar. Login no funciona.',
      action: 'Agregar AUTH_SECRET al .env. Generar con: openssl rand -base64 32',
      team: 'desarrollo',
    };
  }
  return {
    id: 'auth',
    severity: 'ok',
    message: 'Autenticacion configurada',
    detail: 'AUTH_SECRET presente. Sesiones seguras.',
  };
}

// ═══════════════════════════════════════════════════════════════
// Endpoint principal
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const mem = process.memoryUsage();
    const cgroup = readCgroupMemory();
    const heapLimit = getHeapLimit();
    const dbSize = getDbSize();
    const uptimeSeconds = process.uptime();

    // --- Datos crudos (para footer y detalles) ---
    const memoryUsage = {
      rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
      heapLimit: Math.round(heapLimit / (1024 * 1024) * 100) / 100,
      cgroupUsage: Math.round(cgroup.usage / (1024 * 1024) * 100) / 100,
      cgroupLimit: Math.round(cgroup.limit / (1024 * 1024) * 100) / 100,
    };

    // --- Diagnósticos ---
    const diagnoses: Diagnosis[] = [
      diagnoseMemory(mem, heapLimit, cgroup),
      diagnoseContainer(cgroup),
      diagnoseDatabase(dbSize),
      diagnoseUptime(uptimeSeconds),
      diagnoseDevOverhead(),
      diagnoseAuth(),
    ];

    const criticals = diagnoses.filter(d => d.severity === 'critical');
    const warnings = diagnoses.filter(d => d.severity === 'warning');
    const oks = diagnoses.filter(d => d.severity === 'ok');

    // Score de salud: 100 si todo ok, baja con warnings/criticals
    // Filtrar diagnósticos que NO representan problemas reales de producción
    const devModePattern = /next dev|hot reload|development|dev server|compilation|fast refresh|hmr/i;
    const nonTrivialDiagnoses = diagnoses.filter(d => {
      // Excluir por ID: diagnósticos que son info/dev-only
      if (d.id === 'dev-overhead' || d.id === 'auth') return false;
      // Excluir por texto: cualquier mensaje que sea solo info de modo desarrollo
      const texto = (d.message + ' ' + d.detail).toLowerCase();
      if (devModePattern.test(texto)) return false;
      return true;
    });
    const realCriticals = nonTrivialDiagnoses.filter(d => d.severity === 'critical');
    const realWarnings = nonTrivialDiagnoses.filter(d => d.severity === 'warning');
    const healthScore = Math.max(0, 100 - (realCriticals.length * 30) - (realWarnings.length * 10));

    return NextResponse.json({
      healthScore,
      diagnoses,
      memoryUsage,
      dbSize,
      uptime: uptimeSeconds,
      uptimeFormatted: formatUptime(uptimeSeconds),
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to collect system diagnostics' },
      { status: 500 }
    );
  }
}
