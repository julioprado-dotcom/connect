import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const SITES_QUERY = 'site:la-razon.com OR site:eldeber.com.bo OR site:lostiempos.com OR site:opinion.com.bo OR site:correodelsur.com OR site:elpotosi.net OR site:lapatria.bo OR site:eldiario.net OR site:jornadanet.com OR site:unitel.bo OR site:reduno.bo OR site:atb.com.bo OR site:boliviaverifica.bo OR site:abi.bo OR site:eju.tv OR site:elmundo.com.bo OR site:vision360.bo';

const DOMAIN_MEDIO_MAP: Record<string, string> = {
  'la-razon.com': 'La Razón',
  'eldeber.com.bo': 'El Deber',
  'lostiempos.com': 'Los Tiempos',
  'opinion.com.bo': 'Opinión',
  'correodelsur.com': 'Correo del Sur',
  'elpotosi.net': 'El Potosí',
  'lapatria.bo': 'La Patria',
  'eldiario.net': 'El Diario',
  'jornadanet.com': 'Jornada',
  'unitel.bo': 'Unitel',
  'reduno.bo': 'Red Uno',
  'atb.com.bo': 'ATB Digital',
  'boliviaverifica.bo': 'Bolivia Verifica',
  'abi.bo': 'ABI',
  'eju.tv': 'eju.tv',
  'elmundo.com.bo': 'El Mundo',
  'vision360.bo': 'Visión 360',
};

function detectMedioByDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [domain, nombre] of Object.entries(DOMAIN_MEDIO_MAP)) {
      if (hostname.includes(domain)) return nombre;
    }
  } catch {
    // URL inválida
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = Math.min(20, Math.max(1, parseInt(searchParams.get('count') || '5')));

    const personas = await db.persona.findMany({
      where: { activa: true },
      take: count,
      orderBy: { fechaActualizacion: 'asc' },
    });

    const medios = await db.medio.findMany();
    const medioMap = new Map(medios.map((m) => [m.nombre, m.id]));

    const zai = await ZAI.create();
    let totalBusquedas = 0;
    let totalMencionesNuevas = 0;
    let totalErrores = 0;
    const detalles: string[] = [];

    for (const persona of personas) {
      totalBusquedas++;
      try {
        const query = `"${persona.nombre}" Bolivia ${SITES_QUERY}`;
        const results = await zai.functions.invoke('web_search', { query, num: 10 });

        const searchItems = (Array.isArray(results) ? results : []) as Array<{
          title?: string;
          snippet?: string;
          url?: string;
          link?: string;
        }>;

        let nuevasParaPersona = 0;

        for (const item of searchItems) {
          const itemUrl = item.url || item.link || '';
          if (!itemUrl) continue;

          const existing = await db.mencion.findFirst({ where: { url: itemUrl } });
          if (existing) continue;

          const medioNombre = detectMedioByDomain(itemUrl);
          const medioId = medioNombre ? (medioMap.get(medioNombre) || null) : null;
          if (!medioId) continue;

          await db.mencion.create({
            data: {
              personaId: persona.id,
              medioId,
              titulo: item.title || '',
              texto: item.snippet || '',
              url: itemUrl,
              tipoMencion: 'no_clasificado',
              sentimiento: 'no_clasificado',
              verificado: false,
            },
          });
          nuevasParaPersona++;
          totalMencionesNuevas++;
        }

        detalles.push(`${persona.nombre}: ${nuevasParaPersona} menciones nuevas`);
      } catch (err) {
        totalErrores++;
        const errMsg = err instanceof Error ? err.message : 'Error desconocido';
        detalles.push(`${persona.nombre}: ERROR - ${errMsg}`);
      }
    }

    // Registrar logs de captura por cada medio
    const allMedios = await db.medio.findMany();
    for (const medio of allMedios) {
      await db.capturaLog.create({
        data: {
          medioId: medio.id,
          totalArticulos: 0,
          mencionesEncontradas: 0,
          exitosa: totalErrores === 0,
          errores: totalErrores > 0 ? `${totalErrores} errores en la captura` : '',
        },
      });
    }

    return NextResponse.json({
      busquedas: totalBusquedas,
      mencionesNuevas: totalMencionesNuevas,
      errores: totalErrores,
      detalles,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en la captura', details: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const lastLog = await db.capturaLog.findFirst({
      orderBy: { fecha: 'desc' },
      include: { medio: { select: { nombre: true } } },
    });

    if (!lastLog) {
      return NextResponse.json({ message: 'No hay capturas registradas' });
    }

    return NextResponse.json(lastLog);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
