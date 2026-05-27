/**
 * /api/dashboard/generadores-summary — Generadores dashboard
 * Returns status of ONION200 generators.
 * NOTE: No Prisma model for generators yet — returns hardcoded config
 * based on the commercial plan (Termometro, Saldo, El Foco, El Radar).
 */
import { NextResponse } from 'next/server';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Generadores from commercial plan — hardcoded until Generador model exists
const GENERADORES = [
  {
    id: 'termometro',
    nombre: 'Termometro',
    descripcion: 'Analisis de temperatura mediatica por persona',
    tipo: 'personal',
    activo: true,
    frecuencia: 'diario',
    ultimoEnvio: null,
    clientesActivos: 0,
  },
  {
    id: 'saldo',
    nombre: 'Saldo',
    descripcion: 'Balance informativo positivo/negativo/neutral',
    tipo: 'personal',
    activo: true,
    frecuencia: 'diario',
    ultimoEnvio: null,
    clientesActivos: 0,
  },
  {
    id: 'foco',
    nombre: 'El Foco',
    descripcion: 'Zoom tematico: profundizacion por eje tematico',
    tipo: 'tematico',
    activo: true,
    frecuencia: 'semanal',
    ultimoEnvio: null,
    clientesActivos: 0,
  },
  {
    id: 'radar',
    nombre: 'El Radar',
    descripcion: 'Monitoreo de alertas y variaciones criticas',
    tipo: 'alertas',
    activo: true,
    frecuencia: 'diario',
    ultimoEnvio: null,
    clientesActivos: 0,
  },
] as const;

export async function GET() {
  try {
    const total = GENERADORES.length;
    const activos = GENERADORES.filter((g) => g.activo).length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total,
      activos,
      inactivos: total - activos,
      generadores: GENERADORES.map((g) => ({ ...g })),
      nota: 'Modelo Generador no implementado aun — datos del plan comercial',
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'generadores-summary') }, { status: 500 });
  }
}
