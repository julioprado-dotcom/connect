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

const SYSTEM_PROMPT = `Eres un analista de medios boliviano. Clasifica la mención.
Responde ÚNICAMENTE con JSON (sin markdown):
{"tipoMencion":"cita_directa|mencion_pasiva|cobertura_declaracion|contexto|foto_video","sentimiento":"positivo|negativo|neutral|critico|elogioso","ejesTematicos":["slug1","slug2"]}

Ejes temáticos disponibles (máximo 3, orden relevancia):
- hidrocarburos-energia: gas, petróleo, YPFB, litio, subsidios, gasolina
- movimientos-sociales: bloqueos, marchas, paros, protestas, COB
- gobierno-oposicion: Asamblea, diputados, senadores, leyes, bancadas
- corrupcion-impunidad: denuncias, auditorías, irregularidades
- economia: inflación, dólar, PIB, presupuesto, reservas
- justicia-derechos: Fiscalía, tribunales, derechos humanos
- procesos-electorales: elecciones, TSE, candidatos, votación
- educacion-cultura: magisterio, universidades, presupuesto educativo
- salud-servicios: hospitales, medicamentos, salud pública
- medio-ambiente: agua, incendios, minería, territorio
- relaciones-internacionales: fronteras, migración, cooperación`;

const validSlugs = new Set(EJES_TEMATICOS.map(e => e.slug));

async function analyzeSingle(titulo: string, texto: string): Promise<{
  tipoMencion: string;
  sentimiento: string;
  ejesTematicos: string[];
}> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Título: ${titulo}\nTexto: ${texto}` },
      ],
      temperature: 0.2,
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { tipoMencion: 'contexto', sentimiento: 'neutral', ejesTematicos: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const ejesRaw = Array.isArray(parsed.ejesTematicos) ? parsed.ejesTematicos :
                    Array.isArray(parsed.ejes) ? parsed.ejes :
                    Array.isArray(parsed.temas) ? parsed.temas : [];

    const ejesValidados = ejesRaw
      .map((s: string) => s.toLowerCase().trim())
      .filter((s: string) => validSlugs.has(s))
      .slice(0, 3);

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
    const limit = Math.min(50, Math.max(1, body.limit || 10));

    // Obtener menciones sin clasificar
    const menciones = await db.mencion.findMany({
      where: { sentimiento: 'no_clasificado' },
      take: limit,
      include: { persona: { select: { nombre: true } }, medio: { select: { nombre: true } } },
    });

    if (menciones.length === 0) {
      return NextResponse.json({
        analizadas: 0,
        mensaje: 'No hay menciones pendientes de análisis',
        ejesDisponibles: EJES_TEMATICOS.length,
      });
    }

    let analizadas = 0;
    let errores = 0;
    const detalles: string[] = [];

    for (const mencion of menciones) {
      try {
        const result = await analyzeSingle(
          mencion.titulo || '',
          mencion.textoCompleto || mencion.texto || ''
        );

        // Actualizar mención
        await db.mencion.update({
          where: { id: mencion.id },
          data: {
            tipoMencion: result.tipoMencion,
            sentimiento: result.sentimiento,
            temas: result.ejesTematicos.join(', '),
          },
        });

        // Crear relaciones con ejes temáticos
        if (result.ejesTematicos.length > 0) {
          await db.mencionTema.deleteMany({ where: { mencionId: mencion.id } });
          for (const slug of result.ejesTematicos) {
            const eje = await db.ejeTematico.findUnique({ where: { slug } });
            if (eje) {
              await db.mencionTema.create({
                data: { mencionId: mencion.id, ejeTematicoId: eje.id },
              });
            }
          }
        }

        analizadas++;
        detalles.push(`${mencion.persona.nombre}: ${result.tipoMencion} / ${result.sentimiento} / [${result.ejesTematicos.join(',')}]`);
      } catch {
        errores++;
        detalles.push(`${mencion.persona.nombre}: ERROR`);
      }
    }

    return NextResponse.json({
      analizadas,
      errores,
      totalProcesadas: menciones.length,
      detalles,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error en el análisis batch', details: message }, { status: 500 });
  }
}
