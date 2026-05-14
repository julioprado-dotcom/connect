import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';
import ZAI from 'z-ai-web-dev-sdk';
import { analyzeMencion, applyAnalysisToMencion } from '@/lib/analyze';
import { deduplicarMencion, actualizarCoberturaDuplicado } from '@/lib/deduplicacion';
import { withAuth } from '@/lib/auth-helpers';
import { FLOW_CONTROL } from '@/lib/jobs/constants';

// ─── Flow Control: Cooldown global ─────────────────────────────
let lastCaptureTime = 0;

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
  const { error: authError } = await withAuth();
  if (authError) return authError;

  // ─── Flow Control: Rate limiting en endpoint de captura ───
  const now = Date.now();
  const elapsed = now - lastCaptureTime;
  if (elapsed < FLOW_CONTROL.captureEndpointCooldownMs && lastCaptureTime > 0) {
    const waitSec = Math.ceil((FLOW_CONTROL.captureEndpointCooldownMs - elapsed) / 1000);
    return NextResponse.json({
      error: `Flow control: Cooldown activo. Espera ${waitSec}s entre capturas.`,
      cooldownRemaining: waitSec,
    }, { status: 429 });
  }
  lastCaptureTime = now;

  try {
    const { searchParams } = new URL(request.url);
    const count = Math.min(20, Math.max(1, parseInt(searchParams.get('count') || '5')));
    const clientId = searchParams.get('clientId') || undefined; // FASE 4D: optional client context

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
    let totalClasificadas = 0;
    let totalErrores = 0;
    let totalTematicas = 0;
    const detalles: string[] = [];

    // ─── PASO 1: Búsqueda por persona (Pipeline B original) ───
    const allProcessedUrls = new Set<string>();

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

        // Batch URL check — single query for all URLs instead of N+1
        const allUrls = searchItems
          .map((item) => item.url || item.link || '')
          .filter(Boolean);
        const existingUrls = new Set<string>();
        if (allUrls.length > 0) {
          const existingMenciones = await db.mencion.findMany({
            where: { url: { in: allUrls } },
            select: { url: true },
          });
          for (const m of existingMenciones) existingUrls.add(m.url);
        }

        for (const item of searchItems) {
          const itemUrl = item.url || item.link || '';
          if (!itemUrl) continue;
          if (existingUrls.has(itemUrl)) continue;

          const medioNombre = detectMedioByDomain(itemUrl);
          const medioId = medioNombre ? (medioMap.get(medioNombre) || null) : null;
          if (!medioId) continue;

          // DEDUPLICACION CROSS-MEDIO (FASE 4C)
          const snippetText = item.snippet || '';
          const dedupResult = await deduplicarMencion({
            personaId: persona.id,
            ejesTematicos: [],
            resumen: snippetText,
            fecha: new Date(),
            medioId,
            textoOriginal: snippetText,
          });

          if (dedupResult.decision === 'es_duplicado' && dedupResult.mencionOriginalId) {
            await actualizarCoberturaDuplicado(dedupResult.mencionOriginalId, {
              medioId,
              medioNombre: medioNombre || 'Desconocido',
              resumen: snippetText,
              fecha: new Date(),
            });
            console.log(`[DEDUP capture] Deduplicada: ${medioNombre} → #${dedupResult.mencionOriginalId}`);
            nuevasParaPersona++;
            totalMencionesNuevas++;
            allProcessedUrls.add(itemUrl);
            continue;
          }

          const dedupLog = JSON.stringify({
            decision: dedupResult.decision,
            razon: dedupResult.razon,
            timestamp: new Date().toISOString(),
            ...(dedupResult.mencionOriginalId ? { candidatoId: dedupResult.mencionOriginalId } : {}),
          });

          const mencion = await db.mencion.create({
            data: {
              personaId: persona.id,
              medioId,
              titulo: item.title || '',
              texto: item.snippet || '',
              url: itemUrl,
              tipoMencion: 'no_clasificado',
              sentimiento: 'no_clasificado',
              verificado: false,
              ...(dedupResult.eventoId ? { eventoId: dedupResult.eventoId } : {}),
              deduplicacionLog: dedupLog,
            },
          });
          nuevasParaPersona++;
          totalMencionesNuevas++;
          allProcessedUrls.add(itemUrl);

          // Clasificar automáticamente con IA
          try {
            const analysis = await analyzeMencion(mencion.titulo, mencion.texto);
            await applyAnalysisToMencion(mencion.id, analysis);
            totalClasificadas++;
          } catch {
            // Si falla la clasificación, la mención queda como no_clasificado — no se pierde
          }
        }

        detalles.push(`${persona.nombre}: ${nuevasParaPersona} menciones nuevas`);
      } catch (err) {
        totalErrores++;
        const errMsg = err instanceof Error ? err.message : 'Error desconocido';
        detalles.push(`${persona.nombre}: ERROR - ${errMsg}`);
      }
    }

    // ─── PASO 2: Búsqueda temática por ejes temáticos ────────
    try {
      const ejes = await db.ejeTematico.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, keywords: true },
      });

      if (ejes.length > 0) {
        detalles.push(`--- Busqueda tematica: ${ejes.length} ejes ---`);

        for (const eje of ejes) {
          if (!eje.keywords) continue;
          const keywordsList = eje.keywords.split(',').map(k => k.trim()).filter(Boolean);
          if (keywordsList.length === 0) continue;

          totalBusquedas++;
          try {
            // Construir query con las top 3 keywords del eje
            const keywordsQuery = keywordsList.slice(0, 3).map(k => `"${k}"`).join(' OR ');
            const query = `(${keywordsQuery}) Bolivia ${SITES_QUERY}`;
            const results = await zai.functions.invoke('web_search', { query, num: 5 });

            const searchItems = (Array.isArray(results) ? results : []) as Array<{
              title?: string;
              snippet?: string;
              url?: string;
              link?: string;
            }>;

            let nuevasParaEje = 0;

            for (const item of searchItems) {
              const itemUrl = item.url || item.link || '';
              if (!itemUrl) continue;

              // Skip URLs already processed in Paso 1 or already in DB
              if (allProcessedUrls.has(itemUrl)) continue;

              // Check DB for existing
              const existente = await db.mencion.findFirst({
                where: { url: itemUrl },
                select: { id: true },
              });
              if (existente) {
                allProcessedUrls.add(itemUrl);
                continue;
              }

              const medioNombre = detectMedioByDomain(itemUrl);
              const medioId = medioNombre ? (medioMap.get(medioNombre) || null) : null;
              if (!medioId) continue;

              // Crear mencion tematica sin personaId
              const mencion = await db.mencion.create({
                data: {
                  personaId: null,
                  medioId,
                  titulo: item.title || '',
                  texto: item.snippet || '',
                  url: itemUrl,
                  tipoMencion: 'referencia_tematica',
                  sentimiento: 'no_clasificado',
                  verificado: false,
                },
              });

              // Vincular al eje tematico via MencionTema
              try {
                await db.mencionTema.create({
                  data: { mencionId: mencion.id, ejeTematicoId: eje.id },
                });
              } catch {
                // Duplicado, ignorar
              }

              // Clasificar con IA
              try {
                const analysis = await analyzeMencion(mencion.titulo, mencion.texto);
                await applyAnalysisToMencion(mencion.id, analysis);
                totalClasificadas++;
              } catch {
                // Si falla, queda como referencia_tematica
              }

              nuevasParaEje++;
              totalMencionesNuevas++;
              totalTematicas++;
              allProcessedUrls.add(itemUrl);
            }

            if (nuevasParaEje > 0) {
              detalles.push(`  ${eje.nombre}: ${nuevasParaEje} menciones tematicas`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Error desconocido';
            detalles.push(`  ${eje.nombre}: ERROR - ${errMsg}`);
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      detalles.push(`Busqueda tematica ERROR: ${errMsg}`);
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
      clasificadas: totalClasificadas,
      mencionesTematicas: totalTematicas,
      errores: totalErrores,
      ...(clientId ? { clientId } : {}),
      detalles,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const lastLog = await db.capturaLog.findFirst({
      orderBy: { fecha: 'desc' },
      include: { Medio: { select: { nombre: true } } },
    });

    if (!lastLog) {
      return NextResponse.json({ message: 'No hay capturas registradas' });
    }

    return NextResponse.json(lastLog);
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
