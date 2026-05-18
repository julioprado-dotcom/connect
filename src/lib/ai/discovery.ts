// ═══════════════════════════════════════════════════════════════════════
// MOTOR DE DESCUBRIMIENTO INTELIGENTE — DECODEX Bolivia
// ═══════════════════════════════════════════════════════════════════════
//
// Detecta actores y temas emergentes que NO están en la base de datos.
// Se ejecuta después de la clasificación normal, sobre noticias
// que no fueron vinculadas a ninguna persona existente.
//
// Flujo:
// 1. Recolectar textos de menciones huérfanas del día (sin personaId)
// 2. Enviar a LLM para extraer entidades nombradas
// 3. Filtrar las que ya existen en la DB (anti-duplicados)
// 4. Agrupar por frecuencia de aparición en medios distintos
// 5. Guardar en SugerenciaInteligencia para aprobación del admin
// ═══════════════════════════════════════════════════════════════════════

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// ─── Interfaces ──────────────────────────────────────────────────

interface EntidadDetectada {
  nombre: string;
  tipo: 'persona' | 'organizacion' | 'tema';
  cargo?: string;
  contexto: string;
  medioNombre: string;
  medioId: string;
  menciones: string[]; // URLs o fragmentos
}

interface DiscoveryResult {
  sugerenciasCreadas: number;
  entidadesDetectadas: number;
  entidadesFiltradas: number;
  detalles: string[];
}

// ─── In-memory cache ────────────────────────────────────────────

let cachePersonasExistentes: { ids: Set<string>; nombres: Set<string>; expiry: number } | null = null;
const CACHE_TTL = 300_000; // 5 minutos

async function getPersonasExistentes(): Promise<{ ids: Set<string>; nombres: Set<string> }> {
  if (cachePersonasExistentes && cachePersonasExistentes.expiry > Date.now()) {
    return { ids: cachePersonasExistentes.ids, nombres: cachePersonasExistentes.nombres };
  }

  const personas = await db.persona.findMany({
    where: { activa: true },
    select: { id: true, nombre: true },
  });

  const ids = new Set(personas.map(p => p.id));
  const nombres = new Set<string>();

  for (const p of personas) {
    // Normalizar: minúsculas, sin tildes
    const norm = p.nombre.toLowerCase().trim();
    const sinAcentos = norm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    nombres.add(norm);
    nombres.add(sinAcentos);

    // También agregar apellidos (palabras 2+) para matching parcial
    const partes = norm.split(' ');
    if (partes.length >= 2) {
      const apellidos = partes.slice(1).join(' ');
      nombres.add(apellidos);
    }
  }

  cachePersonasExistentes = { ids, nombres, expiry: Date.now() + CACHE_TTL };
  return { ids, nombres };
}

async function getSugerenciasExistentes(): Promise<Set<string>> {
  const sugerencias = await db.sugerenciaInteligencia.findMany({
    where: { estado: 'pendiente' },
    select: { datoPropuesto: true },
  });

  const nombres = new Set<string>();
  for (const s of sugerencias) {
    try {
      const dato = typeof s.datoPropuesto === 'string' ? JSON.parse(s.datoPropuesto) : s.datoPropuesto;
      if (dato?.nombre) {
        nombres.add(String(dato.nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      }
    } catch { /* ignore */ }
  }
  return nombres;
}

// ─── Recolectar menciones huérfanas del día ────────────────────

async function getMencionesHuerfanasDelDia(): Promise<Array<{
  id: string;
  texto: string;
  titulo: string;
  medioId: string;
  medioNombre: string;
  url: string;
}>> {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const menciones = await db.mencion.findMany({
    where: {
      personaId: null,
      fechaCaptura: { gte: hoyInicio },
      url: { not: '' },
    },
    include: {
      Medio: { select: { id: true, nombre: true } },
    },
    take: 100, // Máximo 100 menciones para no saturar
    orderBy: { fechaCaptura: 'desc' },
  });

  return menciones
    .filter(m => {
      const texto = m.textoCompleto || m.texto || m.titulo || '';
      return texto.length >= 80; // Texto mínimo para análisis
    })
    .map(m => ({
      id: m.id,
      texto: (m.textoCompleto || m.texto || '').substring(0, 500),
      titulo: m.titulo || '',
      medioId: m.Medio?.id || '',
      medioNombre: m.Medio?.nombre || 'Desconocido',
      url: m.url,
    }));
}

// ─── Prompt de descubrimiento ──────────────────────────────────

function buildDiscoveryPrompt(): string {
  return `Eres un analista de inteligencia de medios especializado en Bolivia. Tu tarea es identificar ACTORES Y TEMAS EMERGENTES que aparecen en las noticias pero que NO son figuras políticas establecidas.

INSTRUCCIONES:
1. Lee los textos de noticias proporcionados.
2. Identifica TODOS los nombres propios de PERSONAS que aparezcan mencionados como actores políticos, gubernamentales, empresariales, sindicales o sociales relevantes.
3. Identifica ORGANIZACIONES o instituciones mencionadas como actores clave.
4. Identifica TEMAS o conceptos recurrentes que no sean temas políticos estándar.

NO incluir:
- Nombres de periodistas (reporteros de los medios)
- Personas que solo aparecen como datos históricos o contextuales
- Figuras internacionales que no tengan relevancia directa para Bolivia
- Temas ya cubiertos por ejes temáticos estándar (hidrocarburos, elecciones, etc.)

FORMATO DE SALIDA:
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks):
{
  "entidades": [
    {
      "nombre": "Nombre completo",
      "tipo": "persona",
      "cargo_likely": "cargo o rol probable según el contexto",
      "contexto": "en qué contexto aparece (1 frase)",
      "medio": "nombre del medio donde se detectó",
      "fragmento": "fragmento textual donde aparece (máximo 100 chars)"
    }
  ]
}

TIPOS válidos: "persona", "organizacion", "tema"
Máximo 15 entidades por lote.
Si no encuentras entidades relevantes, devuelve: {"entidades": []}`;
}

// ─── Extraer entidades con LLM ─────────────────────────────────

async function extractEntidades(textos: Array<{ texto: string; titulo: string; medioNombre: string; url: string }>): Promise<EntidadDetectada[]> {
  if (textos.length === 0) return [];

  const zai = await ZAI.create();

  // Construir contenido: agrupar textos por medio para contexto
  const contenido = textos.map((t, i) =>
    `[NOTA ${i + 1}] Medio: ${t.medioNombre}\nTítulo: ${t.titulo}\nTexto: ${t.texto.substring(0, 400)}`
  ).join('\n\n---\n\n');

  const systemPrompt = buildDiscoveryPrompt();

  try {
    const completion = await zai.chat.completions.create({
      model: 'glm-4-air',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analiza estas notas periodísticas bolivianas y detecta actores/temas emergentes:\n\n${contenido}` },
      ],
      temperature: 0.1,
      signal: AbortSignal.timeout(45000), // 45s timeout
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[discovery] LLM no devolvió JSON válido');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const entidades = Array.isArray(parsed?.entidades) ? parsed.entidades : [];

    return entidades.map((e: Record<string, unknown>) => ({
      nombre: String(e.nombre || '').trim(),
      tipo: (e.tipo === 'organizacion' ? 'organizacion' : e.tipo === 'tema' ? 'tema' : 'persona') as EntidadDetectada['tipo'],
      cargo: String(e.cargo_likely || e.cargo || '').trim(),
      contexto: String(e.contexto || '').trim(),
      medioNombre: String(e.medio || '').trim(),
      menciones: [String(e.fragmento || '').substring(0, 100)],
    })).filter(e => e.nombre.length >= 3);

  } catch (err) {
    console.warn('[discovery] Error en extracción LLM:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Agrupar entidades por nombre y calcular confianza ─────────

function agruparEntidades(entidades: EntidadDetectada[]): Map<string, {
  nombre: string;
  tipo: string;
  cargo: string;
  contextos: string[];
  medios: Map<string, { nombre: string; id: string; menciones: string[] }>;
  frecuencia: number;
}> {
  const grupos = new Map<string, {
    nombre: string;
    tipo: string;
    cargo: string;
    contextos: string[];
    medios: Map<string, { nombre: string; id: string; menciones: string[] }>;
    frecuencia: number;
  }>();

  for (const ent of entidades) {
    // Normalizar nombre para agrupación
    const key = ent.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (!grupos.has(key)) {
      grupos.set(key, {
        nombre: ent.nombre,
        tipo: ent.tipo,
        cargo: ent.cargo,
        contextos: [],
        medios: new Map(),
        frecuencia: 0,
      });
    }

    const grupo = grupos.get(key)!;
    grupo.frecuencia++;

    if (ent.contexto && !grupo.contextos.includes(ent.contexto)) {
      grupo.contextos.push(ent.contexto);
    }

    // Si hay medio distinto, agregar
    const medioKey = ent.medioNombre.toLowerCase();
    if (ent.medioNombre && !grupo.medios.has(medioKey)) {
      grupo.medios.set(medioKey, { nombre: ent.medioNombre, id: '', menciones: [] });
    }

    // Actualizar cargo si el actual está vacío
    if (!grupo.cargo && ent.cargo) {
      grupo.cargo = ent.cargo;
    }
  }

  return grupos;
}

// ─── Calcular confianza basada en redundancia de medios ─────────

function calcularConfianza(numMedios: number, frecuencia: number): number {
  // Base: 10 puntos por mención, hasta 30
  let score = Math.min(frecuencia * 10, 30);
  // Bonus por diversidad de medios: 20 por cada medio distinto, hasta 70
  score += Math.min(numMedios * 20, 70);
  return Math.min(score, 100);
}

// ─── Función principal: ejecutar descubrimiento ────────────────

export async function ejecutarDescubrimiento(): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    sugerenciasCreadas: 0,
    entidadesDetectadas: 0,
    entidadesFiltradas: 0,
    detalles: [],
  };

  try {
    console.log('[discovery] Iniciando motor de descubrimiento inteligente...');

    // 1. Obtener menciones huérfanas del día
    const menciones = await getMencionesHuerfanasDelDia();
    console.log(`[discovery] ${menciones.length} menciones huérfanas encontradas hoy`);

    if (menciones.length === 0) {
      result.detalles.push('Sin menciones huérfanas para analizar');
      return result;
    }

    // 2. Extraer entidades con LLM
    const todasEntidades: EntidadDetectada[] = [];

    // Procesar en lotes de 20 para no saturar el prompt
    const LOTE_SIZE = 20;
    for (let i = 0; i < menciones.length; i += LOTE_SIZE) {
      const lote = menciones.slice(i, i + LOTE_SIZE);
      const entidades = await extractEntidades(lote);
      todasEntidades.push(...entidades);
      console.log(`[discovery] Lote ${Math.floor(i / LOTE_SIZE) + 1}: ${entidades.length} entidades extraídas`);

      // Delay entre lotes para no saturar la API
      if (i + LOTE_SIZE < menciones.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    result.entidadesDetectadas = todasEntidades.length;
    console.log(`[discovery] Total entidades detectadas: ${todasEntidades.length}`);

    if (todasEntidades.length === 0) {
      result.detalles.push('No se detectaron entidades nuevas');
      return result;
    }

    // 3. Filtrar contra personas existentes
    const existentes = await getPersonasExistentes();
    const sugerenciasPendientes = await getSugerenciasExistentes();

    const entidadesNuevas = todasEntidades.filter(ent => {
      const norm = ent.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const partes = norm.split(' ');
      const apellido = partes.length >= 2 ? partes.slice(1).join(' ') : '';

      // Existe en la DB?
      if (existentes.nombres.has(norm)) return false;
      if (apellido && existentes.nombres.has(apellido)) return false;

      // Ya sugerido?
      if (sugerenciasPendientes.has(norm)) return false;

      return true;
    });

    result.entidadesFiltradas = todasEntidades.length - entidadesNuevas.length;
    console.log(`[discovery] ${entidadesNuevas.length} entidades nuevas después de filtrar (${result.entidadesFiltradas} ya conocidas)`);

    if (entidadesNuevas.length === 0) {
      result.detalles.push(`${result.entidadesFiltradas} entidades ya existen en la DB`);
      return result;
    }

    // 4. Agrupar por nombre
    const grupos = agruparEntidades(entidadesNuevas);

    // 5. Crear sugerencias para las de mayor confianza
    for (const [key, grupo] of grupos) {
      const numMedios = grupo.medios.size;
      const confianza = calcularConfianza(numMedios, grupo.frecuencia);

      // Solo sugerir si aparece en al menos 2 medios distintos (confianza >= 30)
      if (confianza < 30) {
        result.detalles.push(`${grupo.nombre}: confianza ${confianza} (descartado — aparece en ${numMedios} medio${numMedios > 1 ? 's' : ''})`);
        continue;
      }

      const tipoSugerencia = grupo.tipo === 'tema' ? 'nuevo_tema'
        : grupo.tipo === 'organizacion' ? 'nueva_persona' // organizaciones se tratan como "actores"
        : 'nueva_persona';

      const datoPropuesto: Record<string, unknown> = {
        nombre: grupo.nombre,
        tipo: grupo.tipo,
        cargo: grupo.cargo || null,
        medios: Object.fromEntries(
          Array.from(grupo.medios.values()).map(m => [m.nombre, m.menciones])
        ),
        numMedios,
        frecuencia: grupo.frecuencia,
        contextos: grupo.contextos.slice(0, 3),
      };

      // Verificar que no exista una sugerencia pendiente idéntica
      const existente = await db.sugerenciaInteligencia.findFirst({
        where: {
          estado: 'pendiente',
          tipo: tipoSugerencia,
        },
      });

      // Verificar por nombre en datoPropuesto (JSON search)
      const todasPendientes = await db.sugerenciaInteligencia.findMany({
        where: { estado: 'pendiente', tipo: tipoSugerencia },
      });

      const yaExiste = todasPendientes.some(s => {
        try {
          const dato = typeof s.datoPropuesto === 'string'
            ? JSON.parse(s.datoPropuesto)
            : s.datoPropuesto;
          return String(dato?.nombre || '').toLowerCase() === grupo.nombre.toLowerCase();
        } catch { return false; }
      });

      if (yaExiste) {
        result.detalles.push(`${grupo.nombre}: ya sugerido previamente (actualizando confianza)`);
        // Actualizar confianza si la nueva es mayor
        try {
          const sug = todasPendientes.find(s => {
            try {
              const dato = typeof s.datoPropuesto === 'string'
                ? JSON.parse(s.datoPropuesto)
                : s.datoPropuesto;
              return String(dato?.nombre || '').toLowerCase() === grupo.nombre.toLowerCase();
            } catch { return false; }
          });
          if (sug && confianza > sug.confianza) {
            await db.sugerenciaInteligencia.update({
              where: { id: sug.id },
              data: {
                confianza,
                datoPropuesto: datoPropuesto as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              },
            });
          }
        } catch { /* ignore */ }
        continue;
      }

      await db.sugerenciaInteligencia.create({
        data: {
          tipo: tipoSugerencia,
          datoPropuesto: datoPropuesto as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          confianza,
          estado: 'pendiente',
        },
      });

      result.sugerenciasCreadas++;
      result.detalles.push(
        `${grupo.nombre} (${tipoSugerencia}): confianza ${confianza}, ${numMedios} medio${numMedios > 1 ? 's' : ''}, ${grupo.frecuencia} mención${grupo.frecuencia > 1 ? 'es' : ''}`
      );
    }

    console.log(`[discovery] Completado: ${result.sugerenciasCreadas} sugerencias creadas, ${result.entidadesFiltradas} filtradas`);

  } catch (err) {
    console.error('[discovery] Error en motor de descubrimiento:', err);
    result.detalles.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

// ─── Crear persona desde sugerencia ────────────────────────────

export async function aprobarSugerenciaPersona(
  sugerenciaId: string,
  datosExtra?: {
    camara?: string;
    departamento?: string;
    partido?: string;
    partidoSigla?: string;
    tipo?: string;
  }
): Promise<{ personaId: string; success: boolean; error?: string }> {
  try {
    const sugerencia = await db.sugerenciaInteligencia.findUnique({
      where: { id: sugerenciaId },
    });

    if (!sugerencia) {
      return { personaId: '', success: false, error: 'Sugerencia no encontrada' };
    }

    if (sugerencia.estado !== 'pendiente') {
      return { personaId: '', success: false, error: `Sugerencia ya ${sugerencia.estado}` };
    }

    const dato = typeof sugerencia.datoPropuesto === 'string'
      ? JSON.parse(sugerencia.datoPropuesto)
      : sugerencia.datoPropuesto;

    const nombre = String(dato?.nombre || '').trim();
    if (!nombre) {
      return { personaId: '', success: false, error: 'Nombre vacío en la sugerencia' };
    }

    const personaId = `per_${nombre.toLowerCase().replace(/\s+/g, '_').substring(0, 40)}_${Date.now()}`;

    await db.persona.create({
      data: {
        id: personaId,
        nombre,
        camara: datosExtra?.camara || 'Desconocida',
        departamento: datosExtra?.departamento || 'Nacional',
        partido: datosExtra?.partido || dato?.cargo || 'Sin partido',
        partidoSigla: datosExtra?.partidoSigla || '',
        tipo: datosExtra?.tipo || 'externo',
        activa: true,
        fechaActualizacion: new Date(),
      },
    });

    await db.sugerenciaInteligencia.update({
      where: { id: sugerenciaId },
      data: {
        estado: 'aprobada',
        procesadaEn: new Date(),
      },
    });

    console.log(`[discovery] Persona creada desde sugerencia: ${nombre} (${personaId})`);

    return { personaId, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { personaId: '', success: false, error: msg };
  }
}

// ─── Rechazar sugerencia ───────────────────────────────────────

export async function rechazarSugerencia(sugerenciaId: string): Promise<boolean> {
  try {
    await db.sugerenciaInteligencia.update({
      where: { id: sugerenciaId },
      data: {
        estado: 'rechazada',
        procesadaEn: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Invalidar cache ───────────────────────────────────────────

export function invalidarCacheDiscovery(): void {
  cachePersonasExistentes = null;
}
