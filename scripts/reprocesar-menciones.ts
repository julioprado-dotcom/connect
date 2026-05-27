// ══════════════════════════════════════════════════════════════════
// reprocesar-menciones.ts — Re-procesamiento de menciones existentes
// DECODEX Bolivia — Detección ampliada de actores
//
// FASE 1: Cargar datos (menciones, personas, ejes)
// FASE 2: Procesar con LLM (actores + ejes + tratamiento)
// FASE 3: Crear Persona records para actores recurrentes
// FASE 4: Actualizar menciones (personaId, tratamiento, ejes)
// FASE 5: Resumen estadístico
//
// Ejecutar: bun run scripts/reprocesar-menciones.ts
// ══════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import ZAI from 'z-ai-web-dev-sdk'

// ─── Config ────────────────────────────────────────────────────────
const DELAY_MS = 8000           // 8s entre llamadas LLM (evitar rate limit 429)
const MAX_MENCIONES = 400       // Máximo a procesar
const MIN_TEXTO_LENGTH = 100    // Mínimo largo de texto para procesar
const ACTOR_MIN_FREQ = 2        // Mínimo frecuencia para crear Persona
const TEMPERATURE = 0.1

// Base de datos explícita
const DB_PATH = 'file:/home/z/my-project/connect/prisma/db/custom.db'

// ─── Types ─────────────────────────────────────────────────────────
interface DetectedActor {
  nombre: string
  cargo_rol: string
  tipo: 'legislador' | 'expresidente' | 'ministro' | 'gobernador' | 'alcalde' | 'dirigente_sindical' | 'dirigente_social' | 'dirigente_empresarial' | 'autoridad' | 'otro'
  cita: string
}

interface EjeDetectado {
  slug: string
  cita: string
  relevancia: 'alta' | 'media' | 'baja'
}

interface LLMResult {
  es_relevante: boolean
  actores: DetectedActor[]
  ejes: EjeDetectado[]
  tratamiento: string
  confianza: string
  intencion_medio: string
  resumen: string
  es_duplicado_info?: string
}

interface ActorFreq {
  nombre: string
  tipo: string
  cargo_rol: string
  count: number
  mencionesIds: string[]
  personaIdExistente: string | null
}

// ─── DB ────────────────────────────────────────────────────────────
const db = new PrismaClient({ datasourceUrl: DB_PATH })

// ─── Helpers ───────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function truncar(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max) + '...' : texto
}

function normalizarNombre(n: string): string {
  return n.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Quick regex: detecta si un texto probablemente menciona personas públicas
function tienePosiblesActores(texto: string): boolean {
  const patrones = [
    /(?:senador|diputad|presidente|ministro|gobernador|alcalde|dirigente|secretario|fiscal|defensor)/i,
    /(?:Evo|Morales|Arce|Camacho|Paz|Loza|Roca|Revilla|Condori|Choque|Quispe|Mamani|Lima|Pinto|Clavijo|Garci[aá]|Torres|Barr[oó]n|Villa|Espinoza|Montenegro|Cárdenas|Felipe|Tuto|Patzi|Calder[oó]n|Mamani|Quispe|Claros|Medinaceli|Soria|Illanes)/i,
    /(?:COB|CIDOB|CSUTCB|CONALCAM|FSUTCB|COR|cocalero|campesino|sindicalista)/i,
    /(?:CAINCO|CBN|CNP|IBCE|ANBO|CEB|gremio|empresari)/i,
    /(?:declaró|dijo|afirmó|señaló|expresó|informó|denunció|pidió|exigió)\s+(?:el|la|los|las)\s+\w+/i,
    /(?:\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}\b)/, // Nombres propios
  ]
  return patrones.some(p => p.test(texto))
}

// ─── Prompt Builder ────────────────────────────────────────────────
function buildSystemPrompt(
  legisladores: Array<{ id: string; nombre: string; partidoSigla: string; camara: string }>,
  ejes: Array<{ id: string; nombre: string; slug: string }>,
): string {
  const listaLegisladores = legisladores.length > 0
    ? legisladores.map(p => `- ID: ${p.id} | ${p.nombre} (${p.partidoSigla || 'Indep.'}, ${p.camara})`).join('\n')
    : '(Sin legisladores registrados)'

  const listaEjes = ejes.map(e => `- ${e.slug}: ${e.nombre}`).join('\n')

  return `Eres un extractor avanzado de información boliviana para DECODEX Bolivia. Analiza textos de noticias y detecta:

## CONTEXTO POLÍTICO ACTUAL (mayo 2026)
- Rodrigo Paz Pereira es Presidente del Senado y, por sucesión constitucional, actual Presidente del Estado Plurinacional de Bolivia.
- El sistema DECODEX cubre: política, economía, commodities (café, soja, azúcar, maíz, etc.), hidrocarburos, minería, economías regionales.
- Las menciones de productos/commodities (café, soja, etc.) son RELEVANTES aunque no mencionen actores políticos.
- Fuentes como IBCE, Perfect Daily Grind, OIC Café, SCA cubren commodities y son relevantes.

1. ACTORES PÚBLICOS — Incluye TODOS estos tipos:
   - Legisladores (de la lista proporcionada, usar su ID exacto)
   - Presidente del Estado, Vicepresidente
   - Ex presidentes/vicepresidentes de Bolivia
   - Ministros/secretarios de estado, viceministros
   - Gobernadores y alcaldes
   - Dirigentes sindicales (COB, federaciones, centrales)
   - Dirigentes sociales (indígenas, campesinos, cocaleros, regantes)
   - Dirigentes empresariales (CAINCO, cámaras, gremios, IBCE)
   - Autoridades: fiscal, defensor, contralor, tribunal electoral, etc.
   - Cualquier persona pública mencionada por nombre completo
   - Para actores NO legisladores: devolver nombre completo, tipo y cargo/rol

   IMPORTANTE: Si el artículo NO menciona actores humanos pero cubre temas económicos,
   commodities, política institucional o datos relevantes para DECODEX, marcar es_relevante=true
   con actores vacíos pero ejes correspondientes.

2. EJES TEMÁTICOS (de la lista proporcionada)

3. CLASIFICACIÓN PERIODÍSTICA
   - tratamiento_periodistico (NUNCA uses la palabra "sentimiento")
   - intención del medio (independiente del tratamiento)
   - confianza_clasificación

## LEGISLADORES REGISTRADOS
${listaLegisladores}

## EJES TEMÁTICOS
${listaEjes}

## TIPOS DE ACTOR (campo "tipo")
- "legislador" — Si está en la lista de legisladores (usar su ID)
- "expresidente" — Ex presidente/vicepresidente
- "ministro" — Ministro, viceministro, secretario de estado
- "gobernador" — Gobernador departamental
- "alcalde" — Alcalde municipal
- "dirigente_sindical" — Líder sindical (COB, federaciones, centrales obreras)
- "dirigente_social" — Líder social (indígena, campesino, cocalero, regante, vecinal)
- "dirigente_empresarial" — Líder empresarial (CAINCO, cámaras, gremios)
- "autoridad" — Fiscal, defensor, contralor, vocal TSE, etc.
- "otro" — Otro actor público (artista, deportista, etc.)

## TRATAMIENTO PERIODÍSTICO
Valores válidos: tratamiento_informativo, tratamiento_critico, tratamiento_elogioso, tratamiento_editorial, tratamiento_ambiguo, sin_tratamiento

## INTENCIÓN DEL MEDIO
Valores válidos: informativa, opinion, critica, elogiosa, reactiva, sin_intencion

## REGLAS
- Para legisladores: usar el ID exacto de la lista proporcionada
- Para NO legisladores: el campo nombre debe ser el nombre completo tal como aparece
- cita debe ser un fragmento textual REAL del artículo (no inventado)
- Máximo 5 actores por artículo
- Máximo 3 ejes por artículo
- Solo incluir actores que sean personas naturales (NO organizaciones)
- Para organizaciones (COB, CAINCO, IBCE, etc.) NO incluir como actores, pero sí mencionarlas en cargo_rol si un dirigente es miembro
- Rodrigo Paz Pereira = Presidente del Senado / Presidente del Estado. Si aparece como "Presidente Paz" o "Rodrigo Paz", clasificar como senador y usar su ID de la lista.

## FORMATO DE SALIDA
Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "es_relevante": true,
  "actores": [
    { "nombre": "Nombre Completo", "persona_id": "ID_DE_LEGISLADOR_O_NULL", "cargo_rol": "Presidente de la COB", "tipo": "dirigente_sindical", "cita": "fragmento textual donde aparece" }
  ],
  "ejes": [
    { "slug": "movimientos-sociales", "cita": "fragmento relevante", "relevancia": "alta" }
  ],
  "tratamiento": "tratamiento_informativo",
  "confianza": "alta",
  "intencion_medio": "informativa",
  "resumen": "resumen fiel de máximo 150 palabras",
  "es_duplicado_info": "null"
}

Si es_relevante = false:
{"es_relevante": false, "actores": [], "ejes": [], "tratamiento": "sin_tratamiento", "confianza": "baja", "intencion_medio": "sin_intencion", "resumen": ""}`
}

// ─── LLM Call con retry (exponential backoff para 429) ────────────
const MAX_RETRIES = 3

async function callLLM(systemPrompt: string, texto: string): Promise<LLMResult | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `TEXTO DE LA NOTICIA:\n${truncar(texto, 6000)}` },
        ],
        temperature: TEMPERATURE,
        signal: AbortSignal.timeout(60000),
      })

      const raw = (completion?.choices?.[0]?.message?.content || '').trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('  ⚠️ No JSON found in LLM response')
        return null
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        es_relevante: !!parsed.es_relevante,
        actores: Array.isArray(parsed.actores) ? parsed.actores.slice(0, 5).filter((a: Record<string, unknown>) => a.nombre && a.tipo) : [],
        ejes: Array.isArray(parsed.ejes) ? parsed.ejes.slice(0, 3).filter((e: Record<string, unknown>) => e.slug) : [],
        tratamiento: parsed.tratamiento || 'sin_tratamiento',
        confianza: parsed.confianza || 'baja',
        intencion_medio: parsed.intencion_medio || 'sin_intencion',
        resumen: parsed.resumen || '',
        es_duplicado_info: parsed.es_duplicado_info || undefined,
      }
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('429') && attempt < MAX_RETRIES - 1) {
        const waitMs = 15000 * (attempt + 1)  // 15s, 30s, 45s
        console.warn(`  ⏳ Rate limit 429 — reintento ${attempt + 1}/${MAX_RETRIES} en ${waitMs / 1000}s...`)
        await sleep(waitMs)
        continue
      }
      console.warn('  ❌ Error LLM:', msg.slice(0, 80) || err)
      return null
    }
  }
  return null
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now()
  console.log('═══════════════════════════════════════════════════')
  console.log('  RE-PROCESAMIENTO DE MENCIONES — DECODEX Bolivia')
  console.log('  Estrategia: Detección ampliada de actores')
  console.log('═══════════════════════════════════════════════════')

  // ── FASE 1: Cargar datos ──────────────────────────────────────
  console.log('\n📁 FASE 1: Cargando datos...')

  const menciones = await db.mencion.findMany({
    where: { textoCompleto: { not: '' } },
    select: {
      id: true, titulo: true, textoCompleto: true, texto: true,
      medioId: true, url: true, fechaCaptura: true, fechaPublicacion: true,
      tratamientoPeriodistico: true, confianzaClasificacion: true,
      personaId: true,
    },
    orderBy: { fechaCaptura: 'desc' },
    take: MAX_MENCIONES,
  })

  const personas = await db.persona.findMany({
    where: { activa: true },
    select: { id: true, nombre: true, partidoSigla: true, camara: true, tipo: true },
  })

  const ejes = await db.ejeTematico.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, slug: true },
  })

  // Lentes puede no existir en la DB
  let lentesCount = 0
  try {
    lentesCount = await db.lente.count({ where: { activo: true } })
  } catch { /* tabla no existe */ }

  console.log(`  Menciones: ${menciones.length}`)
  console.log(`  Personas (legisladores): ${personas.length}`)
  console.log(`  Ejes temáticos: ${ejes.length}`)
  console.log(`  Lentes: ${lentesCount}`)

  // ── Pre-filtrar menciones con texto suficiente ──────────────
  // Ya NO usamos tienePosiblesActores() para permitir temas económicos/commodities
  const mencionesAProcesar = menciones.filter(m => {
    const textoCompleto = m.textoCompleto || m.texto || ''
    return textoCompleto.length >= MIN_TEXTO_LENGTH
  })

  console.log(`  Menciones con texto suficiente: ${mencionesAProcesar.length} / ${menciones.length}`)
  console.log(`  Menciones a procesar: ${Math.min(mencionesAProcesar.length, MAX_MENCIONES)}`)

  // ── FASE 2: Procesar con LLM ──────────────────────────────────
  console.log('\n🤖 FASE 2: Procesando con LLM...')

  const systemPrompt = buildSystemPrompt(
    personas.map(p => ({ id: p.id, nombre: p.nombre, partidoSigla: p.partidoSigla || '', camara: p.camara || '' })),
    ejes.map(e => ({ id: e.id, nombre: e.nombre, slug: e.slug })),
  )

  const actorFrequency = new Map<string, ActorFreq>()
  const resultados = new Map<string, LLMResult>()
  let procesadas = 0
  let conActores = 0
  let conEjes = 0
  let errores = 0

  // Mapa slug → id para ejes
  const ejeSlugToId = new Map(ejes.map(e => [e.slug, e.id]))

  for (let i = 0; i < mencionesAProcesar.length && procesadas < MAX_MENCIONES; i++) {
    const m = mencionesAProcesar[i]
    procesadas++

    // Progress
    const pct = Math.round((procesadas / Math.min(mencionesAProcesar.length, MAX_MENCIONES)) * 100)
    process.stdout.write(`\r  [${pct}%] ${procesadas}/${Math.min(mencionesAProcesar.length, MAX_MENCIONES)} | Con actores: ${conActores} | Con ejes: ${conEjes} | Errores: ${errores}`)

    const textoCompleto = m.textoCompleto || m.texto || ''
    const result = await callLLM(systemPrompt, textoCompleto)

    if (!result) {
      errores++
      continue
    }

    resultados.set(m.id, result)

    // Acumular frecuencia de actores
    for (const actor of result.actores) {
      const nombreNorm = normalizarNombre(actor.nombre)
      const existing = actorFrequency.get(nombreNorm)
      const personaIdExistente = actor.persona_id || null

      if (existing) {
        existing.count++
        existing.mencionesIds.push(m.id)
        if (personaIdExistente) existing.personaIdExistente = personaIdExistente
      } else {
        actorFrequency.set(nombreNorm, {
          nombre: actor.nombre,
          tipo: actor.tipo || 'otro',
          cargo_rol: actor.cargo_rol || '',
          count: 1,
          mencionesIds: [m.id],
          personaIdExistente,
        })
      }

      conActores++
    }

    if (result.ejes.length > 0) conEjes++

    // Delay entre llamadas
    await sleep(DELAY_MS)
  }

  console.log(`\n  ✅ Procesamiento completado`)
  console.log(`  Procesadas: ${procesadas} | Con actores: ${conActores} | Con ejes: ${conEjes} | Errores: ${errores}`)

  // ── FASE 3: Crear Persona records para actores recurrentes ───
  console.log('\n👤 FASE 3: Creando Persona records para actores recurrentes...')

  // Filtrar actores con frecuencia >= ACTOR_MIN_FREQ y sin personaId existente
  const actoresRecurrentes = Array.from(actorFrequency.entries())
    .filter(([_, data]) => data.count >= ACTOR_MIN_FREQ && !data.personaIdExistente)
    .sort((a, b) => b[1].count - a[1].count)

  console.log(`  Actores detectados (total únicos): ${actorFrequency.size}`)
  console.log(`  Actores recurrentes (≥${ACTOR_MIN_FREQ} menciones): ${actoresRecurrentes.length}`)

  // Mapa nombre normalizado → personaId (para linking)
  const nombreToPersonaId = new Map<string, string>()
  // Pre-cargar legisladores existentes
  for (const p of personas) {
    nombreToPersonaId.set(normalizarNombre(p.nombre), p.id)
  }

  let personasCreadas = 0
  for (const [nombreNorm, data] of actoresRecurrentes) {
    // Verificar si ya existe una Persona con nombre similar
    const existente = await db.persona.findFirst({
      where: { nombre: { contains: data.nombre.split(' ').slice(-1)[0] || data.nombre } }
    })

    if (existente) {
      nombreToPersonaId.set(nombreNorm, existente.id)
      console.log(`  📌 Ya existe: "${data.nombre}" → ${existente.nombre} (${existente.id})`)
      continue
    }

    // Determinar campos para nueva Persona
    const tipo = data.tipo === 'legislador' ? 'diputado' : data.tipo
    const camara = {
      'expresidente': 'Nacional',
      'ministro': 'Nacional',
      'gobernador': 'Departamental',
      'alcalde': 'Municipal',
      'dirigente_sindical': 'Sindical',
      'dirigente_social': 'Social',
      'dirigente_empresarial': 'Empresarial',
      'autoridad': 'Nacional',
      'otro': 'Otro',
    }[data.tipo] || 'Otro'

    try {
      const nuevaPersona = await db.persona.create({
        data: {
          nombre: data.nombre,
          tipo,
          camara,
          departamento: '',
          partido: '',
          partidoSigla: '',
          cargoDirectiva: data.cargo_rol || null,
          activa: true,
          periodo: '2025-2030',
          fechaActualizacion: new Date(),
        }
      })
      nombreToPersonaId.set(nombreNorm, nuevaPersona.id)
      personasCreadas++
      console.log(`  ✅ Creada: "${data.nombre}" (${data.tipo}, ${data.count} menciones) → ${nuevaPersona.id}`)
    } catch (err: any) {
      console.warn(`  ⚠️ Error creando "${data.nombre}":`, err.message?.slice(0, 60))
    }
  }

  console.log(`  Personas creadas: ${personasCreadas}`)

  // ── FASE 4: Actualizar menciones ──────────────────────────────
  console.log('\n🔄 FASE 4: Actualizando menciones...')

  let mencionesActualizadas = 0
  let temasCreados = 0
  let lentesCreados = 0

  for (const [mencionId, result] of resultados.entries()) {
    if (!result.es_relevante) continue

    // 4a. Encontrar personaId
    let personaId: string | null = null
    for (const actor of result.actores) {
      if (actor.persona_id) {
        // Legislator con ID directo
        personaId = actor.persona_id
        break
      }
      const nombreNorm = normalizarNombre(actor.nombre)
      const pId = nombreToPersonaId.get(nombreNorm)
      if (pId) {
        personaId = pId
        break
      }
    }

    // 4b. Mapear tratamiento → sentimiento
    const tratamiento = result.tratamiento
    const sentimientoMap: Record<string, string> = {
      'tratamiento_critico': 'negativo',
      'tratamiento_elogioso': 'positivo',
      'tratamiento_informativo': 'neutro',
      'tratamiento_editorial': 'critico',
      'tratamiento_ambiguo': 'mixto',
    }
    const sentimiento = sentimientoMap[tratamiento] || 'no_clasificado'

    // 4c. Mapear tratamiento → tipoMencion
    const tipoMencion = !personaId && result.ejes.length > 0 ? 'referencia_tematica'
      : sentimiento === 'positivo' ? 'mencion_positiva'
      : sentimiento === 'negativo' ? 'mencion_critica'
      : 'mencion_pasiva'

    try {
      // 4d. Actualizar mención
      await db.mencion.update({
        where: { id: mencionId },
        data: {
          ...(personaId ? { personaId } : {}),
          tratamientoPeriodistico: tratamiento !== 'sin_tratamiento' ? tratamiento : null,
          confianzaClasificacion: result.confianza,
          intencionMedio: result.intencion_medio !== 'sin_intencion' ? result.intencion_medio : null,
          sentimiento,
          tipoMencion,
          ...(result.resumen && result.resumen.length > 20 && !result.resumen.startsWith('Cobertura') ? { texto: result.resumen } : {}),
        }
      })
      mencionesActualizadas++

      // 4e. Crear MencionTema relations
      for (const eje of result.ejes) {
        const ejeId = ejeSlugToId.get(eje.slug)
        if (!ejeId) continue
        try {
          await db.mencionTema.upsert({
            where: { mencionId_ejeTematicoId: { mencionId, ejeTematicoId: ejeId } },
            create: { mencionId, ejeTematicoId: ejeId },
            update: {},
          })
          temasCreados++
        } catch { /* already exists */ }
      }

    } catch (err: any) {
      // Silently continue — some menciones might have validation issues
    }
  }

  console.log(`  Menciones actualizadas: ${mencionesActualizadas}`)
  console.log(`  MencionTema creados: ${temasCreados}`)

  // ── FASE 5: Resumen ──────────────────────────────────────────
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  RE-PROCESAMIENTO COMPLETADO — ${elapsed}s`)
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Menciones procesadas: ${procesadas}`)
  console.log(`  Menciones actualizadas: ${mencionesActualizadas}`)
  console.log(`  Actores únicos detectados: ${actorFrequency.size}`)
  console.log(`  Actores recurrentes (≥${ACTOR_MIN_FREQ}): ${actoresRecurrentes.length}`)
  console.log(`  Nuevas Personas creadas: ${personasCreadas}`)
  console.log(`  MencionTema creados: ${temasCreados}`)
  console.log(`  Errores LLM: ${errores}`)

  // Actor frequency top 20
  console.log('\n📊 TOP 20 ACTORES MÁS MENCIONADOS:')
  const topActores = Array.from(actorFrequency.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
  for (const [_, data] of topActores) {
    const icon = data.personaIdExistente || nombreToPersonaId.get(normalizarNombre(data.nombre)) ? '✅' : '🆕'
    console.log(`  ${icon} ${data.count}x | ${data.nombre} (${data.tipo}) — ${data.cargo_rol}`)
  }

  await db.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
