import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const EJES_TEMATICOS = [
  { slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible' },
  { slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad' },
  { slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones' },
  { slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad' },
  { slug: 'economia', nombre: 'Economía y Política Económica' },
  { slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos' },
  { slug: 'procesos-electorales', nombre: 'Procesos Electorales' },
  { slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura' },
  { slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos' },
  { slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos' },
  { slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales' },
];

const SYSTEM_PROMPT = `Eres un analista de medios boliviano especializado en cobertura política y legislativa. Analiza la siguiente mención de un legislador boliviano en un medio de comunicación y clasifícala.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "tipoMencion": "cita_directa | mencion_pasiva | cobertura_declaracion | contexto | foto_video",
  "sentimiento": "positivo | negativo | neutral | critico | elogioso",
  "ejesTematicos": ["slug1", "slug2"]
}

TIPOS DE MENCIÓN:
- cita_directa: el legislador es citado textualmente con comillas
- mencion_pasiva: se nombra al legislador pero no como fuente principal
- cobertura_declaracion: cobertura de una declaración o rueda de prensa del legislador
- contexto: aparece mencionado en el contexto de un artículo sobre otro tema
- foto_video: aparece en fotografía o video

SENTIMIENTO (del medio/fuente hacia el legislador, no del legislador):
- positivo: cobertura favorable o logros del legislador
- negativo: críticas, controversias o cobertura desfavorable
- neutral: cobertura informativa sin sesgo aparente
- critico: análisis crítico o cuestionamiento directo
- elogioso: reconocimiento o alabanza

EJES TEMÁTICOS — clasifica en máximo 3 ejes (de mayor a menor relevancia):
1. hidrocarburos-energia: gas, petróleo, YPFB, litio, electricidad, subsidios, gasolina, diésel
2. movimientos-sociales: bloqueos, marchas, paros, protestas, COB, CSUTCB, CSCB, conflictos
3. gobierno-oposicion: Asamblea, diputados, senadores, leyes, bancadas, partidos, gestión
4. corrupcion-impunidad: denuncias, auditorías, irregularidades, Fondo Indígena, comisiones
5. economia: inflación, dólar, tipo de cambio, PIB, presupuesto, reservas, empleo
6. justicia-derechos: Fiscalía, tribunales, sentencias, derechos humanos, detenciones
7. procesos-electorales: elecciones, TSE, candidatos, votación, escrutinio
8. educacion-cultura: magisterio, universidades, presupuesto educativo, cultura
9. salud-servicios: hospitales, medicamentos, sistema de salud, servicios públicos
10. medio-ambiente: agua, incendios, minería, deforestación, territorio, autonomías
11. relaciones-internacionales: fronteras, migración, embajadas, cooperación, tratados

Si la mención no encaja en ningún eje, devuelve un array vacío.`;

async function analyzeMencion(titulo: string, texto: string): Promise<{
  tipoMencion: string;
  sentimiento: string;
  ejesTematicos: string[];
}> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analiza esta mención:\n\nTítulo: ${titulo}\nTexto: ${texto}`,
      },
    ],
    temperature: 0.2,
  });

  const raw = (completion?.choices?.[0]?.message?.content || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { tipoMencion: 'contexto', sentimiento: 'neutral', ejesTematicos: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const ejesRaw = Array.isArray(parsed.ejesTematicos) ? parsed.ejesTematicos :
                    Array.isArray(parsed.ejes) ? parsed.ejes :
                    Array.isArray(parsed.temas) ? parsed.temas : [];

    // Validar que los slugs existan en nuestros ejes
    const validSlugs = new Set(EJES_TEMATICOS.map(e => e.slug));
    const ejesValidados = ejesRaw
      .map((s: string) => s.toLowerCase().trim())
      .filter((s: string) => validSlugs.has(s))
      .slice(0, 3); // máximo 3 ejes

    return {
      tipoMencion: parsed.tipoMencion || 'contexto',
      sentimiento: parsed.sentimiento || 'neutral',
      ejesTematicos: ejesValidados,
    };
  } catch {
    return { tipoMencion: 'contexto', sentimiento: 'neutral', ejesTematicos: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mencionId, texto, titulo } = body;

    let tituloText = titulo || '';
    let textoText = texto || '';

    if (mencionId) {
      const mencion = await db.mencion.findUnique({ where: { id: mencionId } });
      if (!mencion) {
        return NextResponse.json({ error: 'Mención no encontrada' }, { status: 404 });
      }
      tituloText = mencion.titulo;
      textoText = mencion.textoCompleto || mencion.texto;
    }

    if (!tituloText && !textoText) {
      return NextResponse.json(
        { error: 'Se requiere mencionId o texto + titulo' },
        { status: 400 }
      );
    }

    const result = await analyzeMencion(tituloText, textoText);

    // Actualizar la mención en la DB
    if (mencionId) {
      await db.mencion.update({
        where: { id: mencionId },
        data: {
          tipoMencion: result.tipoMencion,
          sentimiento: result.sentimiento,
          temas: result.ejesTematicos.join(', '),
        },
      });

      // Crear relaciones con ejes temáticos
      if (result.ejesTematicos.length > 0) {
        // Eliminar relaciones previas
        await db.mencionTema.deleteMany({ where: { mencionId } });

        // Buscar los IDs de los ejes y crear relaciones
        for (const slug of result.ejesTematicos) {
          const eje = await db.ejeTematico.findUnique({ where: { slug } });
          if (eje) {
            await db.mencionTema.create({
              data: {
                mencionId,
                ejeTematicoId: eje.id,
              },
            });
          }
        }
      }
    }

    // Retornar nombres de ejes además de slugs
    const ejesConNombres = result.ejesTematicos.map(slug => {
      const eje = EJES_TEMATICOS.find(e => e.slug === slug);
      return { slug, nombre: eje?.nombre || slug };
    });

    return NextResponse.json({
      tipoMencion: result.tipoMencion,
      sentimiento: result.sentimiento,
      ejesTematicos: ejesConNombres,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en el análisis', details: message }, { status: 500 });
  }
}
