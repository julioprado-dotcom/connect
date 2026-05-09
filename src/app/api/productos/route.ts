// POST /api/productos/activar
// Activa un producto ONION200 con selector de fase (3/7/17 fuentes)
// El producto orquesta la creación de FuenteEstado y programación de captura
//
// GET /api/productos/status
// Retorna el estado actual de todos los productos y fuentes activas

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { guardedParse, RATE, safeError } from '@/lib/rate-guard'

// ─── Fuentes Ola 1 con sus RSS feeds y configuración ─────────────────
const FUENTES_OLA1: Array<{
  nombre: string
  url: string
  rssUrl: string | null
  tipoCheck: 'rss' | 'head'
  frecuenciaBase: string
  nivel: string
  departamento?: string
}> = [
  {
    nombre: 'ABI',
    url: 'https://abi.bo',
    rssUrl: 'https://abi.bo/?feed=rss2',
    tipoCheck: 'rss',
    frecuenciaBase: '1h',
    nivel: '1',
  },
  {
    nombre: 'El Deber',
    url: 'https://deber.com.bo',
    rssUrl: 'https://deber.com.bo/feed/',
    tipoCheck: 'rss',
    frecuenciaBase: '1h',
    nivel: '1',
  },
  {
    nombre: 'La Razón',
    url: 'https://la-razon.com',
    rssUrl: 'https://la-razon.com/feed/',
    tipoCheck: 'rss',
    frecuenciaBase: '1h',
    nivel: '1',
  },
  {
    nombre: 'La Patria',
    url: 'https://lapatriaenlinea.com',
    rssUrl: null,
    tipoCheck: 'head',
    frecuenciaBase: '4h',
    nivel: '2',
    departamento: 'Oruro',
  },
  {
    nombre: 'La Voz de Tarija',
    url: 'https://lavozdetarija.com',
    rssUrl: null,
    tipoCheck: 'head',
    frecuenciaBase: '4h',
    nivel: '2',
    departamento: 'Tarija',
  },
  {
    nombre: 'Leo.bo',
    url: 'https://leo.bo',
    rssUrl: null,
    tipoCheck: 'head',
    frecuenciaBase: '4h',
    nivel: '2',
    departamento: 'Santa Cruz',
  },
  {
    nombre: 'Sol de Pando',
    url: 'https://sdepando.com',
    rssUrl: null,
    tipoCheck: 'head',
    frecuenciaBase: '4h',
    nivel: '2',
    departamento: 'Pando',
  },
]

// ─── Fases de despliegue ──────────────────────────────────────────────
const FASES = {
  test: {
    nombre: 'Test',
    descripcion: '3 fuentes principales para validar pipeline completo',
    fuentes: FUENTES_OLA1.slice(0, 3), // ABI, El Deber, La Razón
  },
  mvp: {
    nombre: 'MVP',
    descripcion: '7 fuentes Ola 1 — datos suficientes para primer producto',
    fuentes: FUENTES_OLA1,
  },
  full: {
    nombre: 'Full',
    descripcion: '17 fuentes viables — cobertura pluralista completa',
    fuentes: FUENTES_OLA1, // Se expandirá cuando se implemente Ola 2
  },
} as const

type FaseKey = keyof typeof FASES

// ─── Validación ──────────────────────────────────────────────────────
const activarSchema = {
  fase: (v: unknown): v is FaseKey => typeof v === 'string' && v in FASES,
}

// ─── POST: Activar producto con fase ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fase } = body

    if (!activarSchema.fase(fase)) {
      return NextResponse.json(
        { error: `Fase inválida. Opciones: ${Object.keys(FASES).join(', ')}` },
        { status: 400 },
      )
    }

    // ─── Prerrequisitos automáticos ────────────────────────────────
    const prereqs = await verificarPrerrequisitos()
    if (prereqs.seedEjecutado) {
      console.log(`[Productos] Seed ejecutado: ${prereqs.personasCreadas} personas`)
    }
    if (prereqs.mcCargado) {
      console.log(`[Productos] Marco Conceptual cargado (v${prereqs.mcVersion})`)
    }

    const faseConfig = FASES[fase]
    const resultados: Array<{
      nombre: string
      estado: 'creada' | 'ya_existia' | 'activada' | 'error'
      fuenteEstadoId?: string
      error?: string
    }> = []

    for (const fuente of faseConfig.fuentes) {
      try {
        // 1. Buscar el medio en la DB
        const medio = await db.medio.findFirst({
          where: { nombre: fuente.nombre },
        })

        if (!medio) {
          // Crear medio si no existe
          const nuevoMedio = await db.medio.create({
            data: {
              nombre: fuente.nombre,
              url: fuente.url,
              tipo: 'Digital',
              nivel: fuente.nivel,
              departamento: fuente.departamento || null,
            },
          })

          // Crear FuenteEstado
          await crearFuenteEstado(nuevoMedio.id, fuente)
          resultados.push({ nombre: fuente.nombre, estado: 'creada', fuenteEstadoId: nuevoMedio.id })
          continue
        }

        // 2. Verificar si ya tiene FuenteEstado
        const existente = await db.fuenteEstado.findUnique({
          where: { medioId: medio.id },
        })

        if (existente) {
          // Activar si estaba inactiva
          if (!existente.activo) {
            await db.fuenteEstado.update({
              where: { id: existente.id },
              data: {
                activo: true,
                url: fuente.rssUrl || fuente.url,
                tipoCheck: fuente.tipoCheck,
                frecuenciaBase: fuente.frecuenciaBase,
              },
            })
            resultados.push({ nombre: fuente.nombre, estado: 'activada', fuenteEstadoId: existente.id })
          } else {
            resultados.push({ nombre: fuente.nombre, estado: 'ya_existia', fuenteEstadoId: existente.id })
          }
        } else {
          // Crear FuenteEstado para medio existente
          await crearFuenteEstado(medio.id, fuente)
          resultados.push({ nombre: fuente.nombre, estado: 'creada', fuenteEstadoId: medio.id })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        resultados.push({ nombre: fuente.nombre, estado: 'error', error: msg })
      }
    }

    // 3. Intentar reschedulear el sistema de jobs
    let schedulerStatus = 'no_iniciado'
    try {
      const { rescheduleAll } = await import('@/lib/jobs/scheduler')
      await rescheduleAll()
      schedulerStatus = 'rescheduleado'
    } catch {
      schedulerStatus = 'job_system_no_disponible'
    }

    const creados = resultados.filter(r => r.estado === 'creada').length
    const activadas = resultados.filter(r => r.estado === 'activada').length
    const existentes = resultados.filter(r => r.estado === 'ya_existia').length
    const errores = resultados.filter(r => r.estado === 'error')

    return NextResponse.json({
      mensaje: `Fase "${faseConfig.nombre}" activada: ${creados} nuevas, ${activadas} reactivadas, ${existentes} ya existían`,
      fase: fase,
      faseNombre: faseConfig.nombre,
      fuentes: resultados,
      totalFuentes: faseConfig.fuentes.length,
      schedulerStatus,
      errores: errores.length > 0 ? errores : undefined,
    })
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error, 'productos/activar') },
      { status: 500 },
    )
  }
}

// ─── GET: Estado de productos y fuentes ──────────────────────────────
export async function GET() {
  try {
    // Fuentes activas por fase
    const todasFuentes = await db.fuenteEstado.findMany({
      where: { activo: true },
      include: { medio: { select: { nombre: true, nivel: true, departamento: true } } },
      orderBy: { medio: { nivel: 'asc' } },
    })

    // Conteo de jobs
    const [jobsPendientes, jobsCompletados24h, menciones, capturaLogs] = await Promise.all([
      db.job.count({ where: { estado: 'pendiente' } }),
      db.job.count({
        where: {
          estado: 'completado',
          fechaCreacion: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      db.mencion.count(),
      db.capturaLog.count(),
    ])

    // Estado del MC
    const mc = await db.marcoConceptual.findFirst({ where: { activa: true } })

    // Fuentes con errores
    const fuentesConError = todasFuentes.filter(f => f.error && f.error.length > 0)

    // Determinar fase activa basada en las fuentes configuradas
    const fuentesNombres = new Set(todasFuentes.map(f => f.medio.nombre))
    let faseActiva: FaseKey = 'test'

    if (todasFuentes.length >= 7) {
      faseActiva = 'mvp'
    } else if (todasFuentes.length >= 3) {
      faseActiva = 'test'
    } else if (todasFuentes.length > 0) {
      faseActiva = 'test'
    }

    return NextResponse.json({
      faseActiva,
      fases: {
        test: {
          ...FASES.test,
          fuentesActivas: FASES.test.fuentes
            .map(f => ({
              nombre: f.nombre,
              activa: fuentesNombres.has(f.nombre),
              tipoCheck: f.tipoCheck,
            })),
        },
        mvp: {
          ...FASES.mvp,
          fuentesActivas: FASES.mvp.fuentes
            .map(f => ({
              nombre: f.nombre,
              activa: fuentesNombres.has(f.nombre),
              tipoCheck: f.tipoCheck,
            })),
        },
        full: {
          ...FASES.full,
          fuentesActivas: FASES.full.fuentes
            .map(f => ({
              nombre: f.nombre,
              activa: fuentesNombres.has(f.nombre),
              tipoCheck: f.tipoCheck,
            })),
        },
      },
      fuentes: todasFuentes.map(f => ({
        id: f.id,
        nombre: f.medio.nombre,
        nivel: f.medio.nivel,
        departamento: f.medio.departamento,
        tipoCheck: f.tipoCheck,
        frecuenciaBase: f.frecuenciaBase,
        totalChecks: f.totalChecks,
        totalCambios: f.totalCambios,
        ultimoCheck: f.ultimoCheck,
        ultimoCambio: f.ultimoCambio,
        conError: !!f.error,
        error: f.error || undefined,
      })),
      estadisticas: {
        fuentesActivas: todasFuentes.length,
        fuentesConError: fuentesConError.length,
        jobsPendientes,
        jobsCompletados24h,
        menciones,
        capturaLogs,
      },
      marcoConceptual: mc
        ? { inicializado: true, version: mc.version }
        : { inicializado: false, version: null },
    })
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error, 'productos/status') },
      { status: 500 },
    )
  }
}

// ─── Helper: crear FuenteEstado ──────────────────────────────────────
async function crearFuenteEstado(
  medioId: string,
  fuente: { rssUrl: string | null; url: string; tipoCheck: string; frecuenciaBase: string },
): Promise<void> {
  await db.fuenteEstado.create({
    data: {
      medioId,
      url: fuente.rssUrl || fuente.url,
      tipoCheck: fuente.tipoCheck,
      frecuenciaBase: fuente.frecuenciaBase,
      frecuenciaActual: fuente.frecuenciaBase,
      activo: true,
    },
  })
}

// ─── Helper: verificar y ejecutar prerrequisitos automáticamente ─────
async function verificarPrerrequisitos(): Promise<{
  seedEjecutado: boolean
  personasCreadas: number
  mcCargado: boolean
  mcVersion: number | null
}> {
  const [personasCount, mc] = await Promise.all([
    db.persona.count(),
    db.marcoConceptual.findFirst({ where: { activa: true } }),
  ])

  // Si la DB está vacía, ejecutar seed automáticamente
  let seedEjecutado = false
  if (personasCount === 0) {
    try {
      seedEjecutado = await ejecutarSeedAutomatico()
    } catch (error) {
      console.error('[Productos] Error en auto-seed:', error)
    }
  }

  // Si no hay MC, ejecutar seed del MC automáticamente
  let mcCargado = false
  let mcVersion: number | null = null
  if (!mc) {
    try {
      mcCargado = await ejecutarSeedMC()
      mcVersion = 1
    } catch (error) {
      console.error('[Productos] Error en auto-seed MC:', error)
    }
  } else {
    mcCargado = true
    mcVersion = mc.version
  }

  return {
    seedEjecutado,
    personasCreadas: await db.persona.count(),
    mcCargado,
    mcVersion,
  }
}

// ─── Ejecutar seed principal automáticamente ─────────────────────────
async function ejecutarSeedAutomatico(): Promise<boolean> {
  console.log('[Productos] DB vacía — ejecutando seed automático...')

  try {
    const fs = await import('fs')
    const path = await import('path')

    // 1. Medios
    const mediosPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'medios.json')
    const mediosRaw = fs.readFileSync(mediosPath, 'utf-8')
    const medios: Array<Record<string, string>> = JSON.parse(mediosRaw)

    for (const medio of medios) {
      await db.medio.create({
        data: {
          nombre: medio.nombre,
          url: medio.url || '',
          tipo: medio.tipo,
          nivel: String(medio.nivel || '1'),
          departamento: medio.departamento || null,
          plataformas: medio.plataformas || '',
          notas: medio.notas || '',
        },
      }).catch(() => {})
    }

    // 2. Legisladores
    const archivos = [
      { ruta: path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'senadores_completo.json'), camara: 'Senadores' },
      { ruta: path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'diputados_2025_2030_completo.json'), camara: 'Diputados' },
    ]

    let total = 0
    for (const archivo of archivos) {
      try {
        const raw = fs.readFileSync(archivo.ruta, 'utf-8')
        const data = JSON.parse(raw)
        const lista = data.diputados || data.senadores || data
        if (!Array.isArray(lista)) continue

        for (const leg of lista) {
          const nombre = String(leg.nombre || '').replace(/\s+/g, ' ').trim()
          if (!nombre) continue

          await db.persona.create({
            data: {
              nombre,
              camara: archivo.camara,
              departamento: String(leg.departamento || ''),
              partido: leg.partido || '',
              partidoSigla: String(leg.partido_sigla || leg.sigla || '').toUpperCase().trim(),
              tipo: 'Titular',
              cargoDirectiva: leg.cargo_directiva ? String(leg.cargo_directiva) : null,
              email: leg.email ? String(leg.email) : null,
              fotoUrl: String(leg.foto_url || ''),
              periodo: '2025-2030',
            },
          }).catch(() => {})
          total++
        }
      } catch {
        // Archivo no disponible, continuar
      }
    }

    // 3. Indicadores Tier 1
    try {
      const { seedIndicadores } = await import('@/lib/indicadores/capturer-tier1')
      await seedIndicadores()
    } catch {
      // No crítico
    }

    console.log(`[Productos] Seed automático completado: ${medios.length} medios, ${total} legisladores`)
    return true
  } catch (error) {
    console.error('[Productos] Error en seed automático:', error)
    return false
  }
}

// ─── Ejecutar seed del Marco Conceptual automáticamente ──────────────
async function ejecutarSeedMC(): Promise<boolean> {
  console.log('[Productos] MC no encontrado — ejecutando seed...')

  try {
    // Datos mínimos del MC inline para evitar import de archivo externo
    const principios = {
      principios: [
        { numero: 1, nombre: "Objetividad Activa", definicion: "Práctica de basar el análisis en hechos verificables" },
        { numero: 2, nombre: "Transparencia Metodológica", definicion: "Práctica de hacer explícitos los criterios y el razonamiento" },
        { numero: 3, nombre: "Honestidad Informativa", definicion: "Compromiso de reflejar fielmente el contenido del texto fuente" },
        { numero: 4, nombre: "Pluralismo Informativo", definicion: "Reconocimiento de que la realidad tiene múltiples voces legítimas" },
        { numero: 5, nombre: "Contexto Institucional Boliviano", definicion: "Comprensión de las estructuras políticas del Estado Plurinacional" },
        { numero: 6, nombre: "Independencia Analítica", definicion: "El sistema produce resultados que reflejan la realidad documentada" },
        { numero: 7, nombre: "Ética del Dato", definicion: "Solo procesa información públicamente disponible en medios" },
        { numero: 8, nombre: "Enfoque Analítico-Institucional", definicion: "Técnicas de análisis de información, no de mercadotecnia" },
        { numero: 9, nombre: "Rigor Periodístico", definicion: "Responder las preguntas fundamentales del periodismo" },
      ],
    }

    await db.marcoConceptual.create({
      data: {
        version: 1,
        activa: true,
        principios,
        contextoInstitucional: {},
        lineasEditoriales: {},
        ejesInstitucionales: {
          descripcion: "Los 12 Ejes Temáticos Institucionales son universales, neutrales y aplican a TODOS los productos del sistema (gratuitos y pagos). Definidos por relevancia legislativa/general. Los ejes PERSONALIZADOS por cliente van en EjeTematicoCliente (tabla separada).",
          ejes: [
            { orden: 1, slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible', keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos' },
            { orden: 2, slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad', keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio' },
            { orden: 3, slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones', keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro' },
            { orden: 4, slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad', keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,YPFB' },
            { orden: 5, slug: 'economia', nombre: 'Economía y Política Económica', keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo' },
            { orden: 6, slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos', keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,delito,policía' },
            { orden: 7, slug: 'procesos-electorales', nombre: 'Procesos Electorales', keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio' },
            { orden: 8, slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura', keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio' },
            { orden: 9, slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos', keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enferneros,sistema de salud' },
            { orden: 10, slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos', keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión,litio,Pachamama' },
            { orden: 11, slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales', keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea' },
            { orden: 12, slug: 'mineria', nombre: 'Minería y Metales Estratégicos', keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estano,zinc,plata,plomo,oro,YLB,litio,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM' },
          ],
          subclasificaciones: 35,
          dimensiones: ['produccion', 'precio', 'conflicto', 'regulacion', 'infraestructura'],
        },
        escalaTratamiento: {},
        reglasDesambiguacion: {},
        criteriosRelevancia: {},
        exclusionesEtica: {},
        terminologiaPermitida: {},
        terminologiaProhibida: {},
        preguntasFundamentales: {},
        parametros: {
          umbral_similitud_duplicado: 0.80,
          ventana_deduplicacion_hs: 48,
          confianza_minima_auto: 0.75,
          confianza_minima_revision: 0.50,
          max_menciones_por_medio_dia: 50,
          historial_contexto_dias: 30,
          costo_maximo_diario_usd: 5.00,
          activar_deduplicacion: true,
          activar_clasificacion_auto: true,
        },
        creadoPor: 'sistema',
      },
    })

    console.log('[Productos] Marco Conceptual v1 creado automáticamente')
    return true
  } catch (error) {
    console.error('[Productos] Error creando MC:', error)
    return false
  }
}
