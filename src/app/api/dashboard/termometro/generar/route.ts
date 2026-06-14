import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/dashboard/termometro/generar
 * Generates termometro (temperature) data per medio (medium)
 * Groups menciones by medio, calculates sentiment breakdown and temperatura
 */

interface TemperaturaMedio {
  medio: string;
  temperatura: 'caliente' | 'frio' | 'neutro';
  totalMenciones: number;
  positiva: number;
  negativa: number;
  neutra: number;
  tendencia: 'ascendente' | 'descendente' | 'estable';
}

export async function POST() {
  try {
    // Fetch all menciones with their Medio relation
    const menciones = await db.mencion.findMany({
      include: {
        Medio: {
          select: { nombre: true },
        },
      },
    });

    if (menciones.length === 0) {
      return NextResponse.json({
        temperaturas: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Group menciones by medio
    const groupedByMedio = new Map<string, typeof menciones>();

    for (const mencion of menciones) {
      const medioNombre = mencion.Medio?.nombre || 'Sin Medio';
      if (!groupedByMedio.has(medioNombre)) {
        groupedByMedio.set(medioNombre, []);
      }
      groupedByMedio.get(medioNombre)!.push(mencion);
    }

    // Calculate split point for tendencia: last 3.5 days vs older
    const now = new Date();
    const splitPoint = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000);

    const temperaturas: TemperaturaMedio[] = [];

    for (const [medio, medioMenciones] of groupedByMedio) {
      // Count sentiments
      let positiva = 0;
      let negativa = 0;
      let neutra = 0;
      // noClasificado count (not included in output breakdown)

      // Count recent vs older for tendencia
      let recentCount = 0;
      let olderCount = 0;

      for (const m of medioMenciones) {
        // Count sentiment
        switch (m.tratamientoPeriodistico) {
          case 'positivo':
            positiva++;
            break;
          case 'negativo':
            negativa++;
            break;
          case 'neutro':
            neutra++;
            break;
          // other sentiment values (no_clasificado, etc.) not counted in breakdown
        }

        // Count for tendencia based on fechaCaptura
        const fecha = m.fechaCaptura ? new Date(m.fechaCaptura) : null;
        if (fecha && fecha >= splitPoint) {
          recentCount++;
        } else {
          olderCount++;
        }
      }

      // Calculate temperatura
      let temperatura: 'caliente' | 'frio' | 'neutro';
      if (positiva > negativa) {
        temperatura = 'caliente';
      } else if (negativa > positiva) {
        temperatura = 'frio';
      } else {
        temperatura = 'neutro';
      }

      // Calculate tendencia
      let tendencia: 'ascendente' | 'descendente' | 'estable';
      const diff = recentCount - olderCount;
      const threshold = Math.max(2, Math.ceil(medioMenciones.length * 0.1));

      if (diff > threshold) {
        tendencia = 'ascendente';
      } else if (diff < -threshold) {
        tendencia = 'descendente';
      } else {
        tendencia = 'estable';
      }

      temperaturas.push({
        medio,
        temperatura,
        totalMenciones: medioMenciones.length,
        positiva,
        negativa,
        neutra,
        tendencia,
      });
    }

    // Sort by totalMenciones descending
    temperaturas.sort((a, b) => b.totalMenciones - a.totalMenciones);

    return NextResponse.json({
      temperaturas,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Termómetro Generar] Error:', error);
    return NextResponse.json(
      { error: 'Error al generar los datos del termómetro' },
      { status: 500 }
    );
  }
}
