// API Route: Generar BOLETÍN DEL GRANO
// POST /api/admin/bulletins/generate-boletin-grano
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import type { BoletinGranoData, BoletinGranoNoticia, BoletinGranoEje } from '@/lib/services/boletin-del-grano';
import { generarHTMLBoletinDelGrano, generarPDFBoletinDelGrano } from '@/lib/services/boletin-del-grano';

// 7 ejes internos del boletín
const EJES_INTERNOS = [
  'Mercado y Precios',
  'Clima y Producción',
  'Política y Regulación',
  'Logística y Exportación',
  'Innovación y Técnica',
  'Ferias y Oportunidades',
  'Cadena y Contexto',
] as const;

// Keywords por eje (simplificado — para clasificación keyword-based)
const KEYWORDS_EJES: Record<string, string[]> = {
  'Mercado y Precios': ['precio', 'cotización', 'C-market', 'ICE', 'arábica', 'robusta', 'FOB', 'bolsa', 'índice', 'coffee price', 'coffee market', 'coffee commodity'],
  'Clima y Producción': ['clima', 'helada', 'sequía', 'lluvia', 'roya', 'broca', 'cosecha', 'floración', 'producción', 'cafetal', 'Yungas', 'Caranavi', 'incendio'],
  'Política y Regulación': ['SENASAG', 'IBCE', 'EUDR', 'FDA', 'normativa', 'arancel', 'regulación', 'ley', 'decreto', 'certificación', 'exportación', 'gobierno'],
  'Logística y Exportación': ['flete', 'puerto', 'Arica', 'Ilo', 'contenedor', 'ruta', 'transporte', 'logística', 'bloqueo frontera'],
  'Innovación y Técnica': ['procesamiento', 'lavado', 'honey', 'natural', 'anaeróbico', 'torrefacción', 'tueste', 'cata', 'SCA', 'fermentación', 'Geisha', 'Pacamara', 'variedad'],
  'Ferias y Oportunidades': ['feria', 'Expo', 'SCA', 'Cup of Excellence', 'concurso', 'Best of Bolivia', 'capacitación', 'cooperación', 'USAID'],
  'Cadena y Contexto': ['cooperativa', 'CENAPROC', 'COAINE', 'COABOL', 'productor', 'cafetería', 'consumo', 'relevo generacional', 'comunidad'],
};

function clasificarNoticia(texto: string): { ejes: string[]; tension: 'ALTA' | 'MEDIA' | 'BAJA' } {
  const textoLower = texto.toLowerCase();
  const ejesActivados: string[] = [];
  let maxDensity = 0;
  let ejePrincipal = '';

  for (const [eje, keywords] of Object.entries(KEYWORDS_EJES)) {
    let matches = 0;
    for (const kw of keywords) {
      if (textoLower.includes(kw.toLowerCase())) matches++;
    }
    if (matches > 0) {
      ejesActivados.push(eje);
      if (matches > maxDensity) {
        maxDensity = matches;
        ejePrincipal = eje;
      }
    }
  }

  // Si no coincide con ningún eje, clasificar como Cadena y Contexto (default)
  if (ejesActivados.length === 0) {
    ejesActivados.push('Cadena y Contexto');
  }

  // Asignar tensión
  const altaKeywords = ['caída', 'crisis', 'alerta', 'emergencia', 'huelga', 'bloqueo', 'helada', 'plaga', 'roya', 'daño', 'pérdida', 'cerrar', 'prohibir'];
  const mediaKeywords = ['nueva', 'convocatoria', 'cambio', 'variación', 'programa', 'aumento', 'reducción', 'oportunidad', 'regulación', 'acuerdo'];

  let tension: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
  const altaCount = altaKeywords.filter(k => textoLower.includes(k)).length;
  const mediaCount = mediaKeywords.filter(k => textoLower.includes(k)).length;

  if (altaCount >= 1) tension = 'ALTA';
  else if (mediaCount >= 1) tension = 'MEDIA';

  return { ejes: ejesActivados, tension };
}

function getSemanaNumero(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const modoPrueba = body.modoPrueba === true;

    // Calcular rango de fechas: semana pasada (lunes a domingo)
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const lunesPasado = new Date(hoy);
    lunesPasado.setDate(hoy.getDate() - ((diaSemana === 0 ? 6 : diaSemana - 1) + 7));
    const domingoPasado = new Date(lunesPasado);
    domingoPasado.setDate(lunesPasado.getDate() + 6);

    // Buscar menciones con keywords de café (via Lente 9 en MencionLente)
    const lente9 = await db.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } });
    const mencionesRelacionadas = lente9
      ? await db.mencionLente.findMany({
          where: { lenteId: lente9.id },
          include: {
            Mencion: {
              include: {
                Medio: { select: { nombre: true } },
              },
            },
          },
        })
      : [];

    // Filtrar por fecha
    const inicioSemana = new Date(lunesPasado.getFullYear(), lunesPasado.getMonth(), lunesPasado.getDate());
    const finSemana = new Date(domingoPasado.getFullYear(), domingoPasado.getMonth(), domingoPasado.getDate(), 23, 59, 59);

    const mencionesSemana = mencionesRelacionadas.filter((mr) => {
      const fechaPub = mr.Mencion.fechaPublicacion || mr.Mencion.fechaCaptura;
      const fecha = new Date(fechaPub);
      return fecha >= inicioSemana && fecha <= finSemana;
    });

    // Si no hay suficientes menciones reales, intentar modo prueba
    let noticias: BoletinGranoNoticia[];
    let totalNoticias = mencionesSemana.length;
    let fuentesMonitoreadas = 0;
    let coberturaLimitada = false;

    if (totalNoticias < 3) {
      coberturaLimitada = true;

      if (modoPrueba) {
        // Datos de ejemplo para prueba
        noticias = [
          {
            titulo: 'Precio del café arábica sube 3.2% tras tres semanas de caída',
            medio: 'Investing.com',
            fecha: '12 mayo 2026',
            resumen: 'El C-market cerró la semana en 185.40 USD/libra, rompiendo una racha de tres semanas a la baja. Los analistas atribuyen el repunte a la reducción de inventarios en Brasil y la demanda sostenida de Estados Unidos.',
            ejes: ['Mercado y Precios'],
            tension: 'MEDIA',
            fuentes: 3,
          },
          {
            titulo: 'SENAMHI advierte probabilidades de heladas tempranas en zonas cafeteras',
            medio: 'ABI',
            fecha: '11 mayo 2026',
            resumen: 'El pronóstico del SENAMHI advierte sobre heladas tempranas en zonas altas (>1,800 msnm) de Caranavi y las Yungas para la próxima semana, generando incertidumbre sobre la fase de desarrollo del grano.',
            ejes: ['Clima y Producción'],
            tension: 'ALTA',
            fuentes: 2,
          },
          {
            titulo: 'IBCE emite boletín sobre nuevos requisitos EUDR para exportación de café',
            medio: 'IBCE',
            fecha: '10 mayo 2026',
            resumen: 'Nuevos requisitos de trazabilidad de la EUDR europea exigen coordenadas GPS de las fincas productoras para cualquier exportación a la Unión Europea. Tres cooperativas de Caranavi reportan dificultades para cumplir.',
            ejes: ['Política y Regulación', 'Logística y Exportación'],
            tension: 'ALTA',
            fuentes: 4,
          },
          {
            titulo: 'Cooperativa CENAPROC presenta café especial en feria internacional',
            medio: 'Perfect Daily Grind',
            fecha: '9 mayo 2026',
            resumen: 'La cooperativa CENAPROC de Caranavi presentó tres lotes de café especial con procesamiento anaeróbico en la Specialty Coffee Expo. Dos lotes obtuvieron puntajes SCA superiores a 86.',
            ejes: ['Ferias y Oportunidades', 'Innovación y Técnica'],
            tension: 'MEDIA',
            fuentes: 2,
          },
        ];
        totalNoticias = 4;
        fuentesMonitoreadas = 25;
      } else {
        // Sin datos suficientes — no generar
        return NextResponse.json({
          success: false,
          error: `BOLETIN_DEL_GRANO — Semana ${getSemanaNumero(hoy)}: Solo ${totalNoticias} noticias relevantes. Mínimo requerido: 3. Usar modoPrueba=true para generar con datos de ejemplo.`,
          totalNoticias,
          periodo: { inicio: lunesPasado.toISOString(), fin: domingoPasado.toISOString() },
        });
      }
    } else {
      // Procesar menciones reales
      const clasificadas = mencionesSemana.map((mr) => {
        const texto = `${mr.Mencion.titulo} ${mr.Mencion.texto || ''} ${mr.Mencion.textoCompleto || ''}`;
        const { ejes, tension } = clasificarNoticia(texto);
        return {
          titulo: mr.Mencion.titulo,
          medio: mr.Mencion.Medio?.nombre || 'Desconocido',
          fecha: mr.Mencion.fechaPublicacion
            ? new Date(mr.Mencion.fechaPublicacion).toLocaleDateString('es-BO')
            : '',
          resumen: (mr.Mencion.texto || mr.Mencion.titulo).slice(0, 200),
          ejes,
          tension,
          fuentes: 1,
          url: mr.Mencion.url || undefined,
        } as BoletinGranoNoticia;
      });

      // Ordenar por tensión (ALTA primero)
      const ordenTension: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
      clasificadas.sort((a, b) => ordenTension[a.tension] - ordenTension[b.tension]);

      noticias = clasificadas.slice(0, 10);
      fuentesMonitoreadas = new Set(noticias.map((n) => n.medio)).size;
    }

    // Construir ejes de tensión
    const ejesMap = new Map<string, { count: number; news: Set<string> }>();
    for (const eje of EJES_INTERNOS) {
      ejesMap.set(eje, { count: 0, news: new Set() });
    }
    for (const n of noticias) {
      for (const eje of n.ejes) {
        const entry = ejesMap.get(eje);
        if (entry) {
          entry.count++;
          entry.news.add(n.titulo);
        }
      }
    }
    const totalEjeActivaciones = [...ejesMap.values()].reduce((s, e) => s + e.count, 0);
    const ejesData: BoletinGranoEje[] = [...ejesMap.entries()].map(([nombre, data]) => ({
      nombre,
      cobertura: totalEjeActivaciones > 0 ? Math.round((data.count / totalEjeActivaciones) * 100) : 0,
      noticias: data.count,
      tendencia: data.count > 2 ? '↑' : data.count > 0 ? '→' : '↓',
    }));

    // Fuentes ranking
    const fuentesMap = new Map<string, number>();
    for (const n of noticias) {
      fuentesMap.set(n.medio, (fuentesMap.get(n.medio) || 0) + 1);
    }
    const fuentesRanking = [...fuentesMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, noticias]) => ({ nombre, noticias, nuevas: false }));

    // Tensión general
    const tensiones = noticias.map((n) => n.tension);
    const tensionGeneral: 'ALTA' | 'MEDIA' | 'BAJA' =
      tensiones.includes('ALTA') ? 'ALTA' : tensiones.includes('MEDIA') ? 'MEDIA' : 'BAJA';

    // Nivel de actividad
    const nivelActividad: 'MODERADO' | 'ALTO' | 'CRÍTICO' =
      totalNoticias >= 15 ? 'CRÍTICO' : totalNoticias >= 8 ? 'ALTO' : 'MODERADO';

    // Formatear fechas
    const fmtFecha = (d: Date) =>
      d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

    // Construir datos completos
    const data: BoletinGranoData = {
      periodoInicio: fmtFecha(lunesPasado),
      periodoFin: fmtFecha(domingoPasado),
      semanaNumero: getSemanaNumero(hoy),
      version: 'DECODEX v0.16.0',
      tensionGeneral,
      resumenEjecutivo: coberturaLimitada && !modoPrueba
        ? 'Cobertura limitada para el período analizado. No se encontraron suficientes noticias relevantes al sector cafetero en las fuentes monitoreadas durante esta semana.'
        : modoPrueba
          ? `La semana del ${fmtFecha(lunesPasado)} al ${fmtFecha(domingoPasado)} estuvo marcada por la recuperación parcial del precio internacional del café arábica, que cerró en 185.40 USD/libra en el C-market, un incremento del 3.2% respecto a la semana anterior. Este repunte llega en un momento crítico para los productores bolivianos, que se preparan para el inicio de la cosecha principal en las Yungas de La Paz y Caranavi. Sin embargo, el pronóstico del SENAMHI advierte sobre probabilidades de heladas tempranas en zonas altas (>1,800 msnm) para la próxima semana, lo que genera incertidumbre sobre la fase de desarrollo del grano. En el plano regulatorio, el IBCE emitió un boletín sobre los nuevos requisitos de trazabilidad de la EUDR europea que entrará en vigencia en diciembre, exigiendo coordenadas GPS de las fincas productoras para cualquier exportación a la Unión Europea. Tres cooperativas de Caranavi reportaron dificultades para cumplir con esta exigencia por falta de equipamiento GPS.`
          : `Se identificaron ${totalNoticias} noticias relevantes al sector cafetero boliviano durante la semana del ${fmtFecha(lunesPasado)} al ${fmtFecha(domingoPasado)}. ${tensionGeneral === 'ALTA' ? 'La semana presenta alta tensión con eventos que afectan directamente la rentabilidad o supervivencia de la cadena productiva.' : tensionGeneral === 'MEDIA' ? 'Nivel de actividad moderado con oportunidades y desarrollos relevantes para el sector.' : 'Semana con actividad informativa sin impactos inmediatos significativos.'}`,
      totalNoticias,
      fuentesMonitoreadas,
      ejesActivados: ejesData.filter((e) => e.noticias > 0).length,
      nivelActividad,
      precioCMarket: modoPrueba ? '185.40 USD/libra' : 'N/D',
      variacionSemanal: modoPrueba ? '+3.2%' : 'N/D',
      noticiaMasMencionada: noticias[0]?.titulo || 'N/D',
      ejes: ejesData,
      noticiasDestacadas: noticias.slice(0, 5),
      fuentesRanking,
      cruceTransversal: coberturaLimitada
        ? 'Datos insuficientes para análisis transversal esta semana.'
        : `Las ${totalNoticias} noticias de la semana activaron ${ejesData.filter((e) => e.noticias > 0).length} de los 7 ejes temáticos del boletín. ${tensionGeneral === 'ALTA' ? 'Se observan conexiones entre clima, producción y precios que requieren atención inmediata.' : 'Los ejes de mayor actividad muestran dinámicas normales para la época del año.'}`,
      tendenciaProyeccion: coberturaLimitada
        ? 'Datos insuficientes para tendencia y proyección esta semana.'
        : 'Se recomienda monitorear: evolución del precio C-market, pronósticos climáticos para zonas cafeteras, y avances en implementación EUDR.',
      fuentesMonitoreadasLista: [
        'El Deber', 'Los Tiempos', 'Página Siete', 'El Diario', 'Opinión',
        'ABI', 'ERBOL', 'Bolivia TV', 'IBCE', 'SENASAG',
        'OIC Café', 'SCA', 'Perfect Daily Grind', 'Coffee Review', 'Minuta de Café',
        'Investing.com', 'TradingView', 'Reuters',
      ],
      keywordsResumen: '196 keywords activas en 7 ejes temáticos internos + Lente 9 DECODEX.',
    };

    // Generar HTML
    const html = generarHTMLBoletinDelGrano(data);

    // Generar PDF
    const pdfBuffer = await generarPDFBoletinDelGrano(data);

    // Guardar como Reporte
    const reporte = await db.reporte.create({
      data: {
        id: crypto.randomUUID(),
        tipo: 'BOLETIN_DEL_GRANO',
        fechaInicio: inicioSemana,
        fechaFin: finSemana,
        resumen: `Semana ${data.semanaNumero} — ${totalNoticias} noticias — Tensión ${tensionGeneral}`,
        contenido: JSON.stringify(data),
        totalMenciones: totalNoticias,
        pdfUrl: pdfBuffer.length > 0 ? `/download/boletin-del-grano-semana-${data.semanaNumero}.pdf` : '',
      },
    });

    // Push DB to GitHub as part of generation flow
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils');
      await pushProductosToGithub(`prod: Boletín del Grano generado — semana ${data.semanaNumero}`);
    } catch (gitErr) {
      console.warn('[generate-boletin-grano] Git push falló:', gitErr);
    }

    // Si hay PDF real, guardarlo en download/
    if (pdfBuffer.length > 0) {
      const fs = require('fs');
      const path = `/home/z/my-project/download/boletin-del-grano-semana-${data.semanaNumero}.pdf`;
      fs.writeFileSync(path, pdfBuffer);
    }

    return NextResponse.json({
      success: true,
      reporteId: reporte.id,
      semana: data.semanaNumero,
      totalNoticias,
      tensionGeneral,
      tensiones: {
        ALTA: tensiones.filter((t) => t === 'ALTA').length,
        MEDIA: tensiones.filter((t) => t === 'MEDIA').length,
        BAJA: tensiones.filter((t) => t === 'BAJA').length,
      },
      ejesActivados: data.ejesActivados,
      pdfGenerado: pdfBuffer.length > 0,
      pdfSize: pdfBuffer.length,
      coberturaLimitada,
      htmlLength: html.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[BOLETIN_DEL_GRANO] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
