// Triaje por keywords — Filtro local SIN IA, SIN LLM
// DECODEX Bolivia — Pipeline optimizado: Fase 2
//
// Compara título+lead contra diccionario local:
// - Filtro geográfico (anti-keywords extranjeras)
// - Nombres de 169 asambleistas
// - Keywords de 47 ejes temáticos
// - Keywords de indicadores
//
// Regla: prefiere falso positivo sobre falso negativo.
// Es más barato que el LLM clasifique una nota irrelevante a que pierda una relevante.

import db from '@/lib/db'
import type { NotaLink } from './link-extractor'

// ─── Interfaces ────────────────────────────────────────────────

export interface TriajeResult {
  url: string
  titulo: string
  lead: string
  match: boolean
  puntaje: number
  matchedPersonas: string[]      // nombres de asambleistas encontrados
  matchedKeywords: string[]       // keywords de ejes/indicadores encontrados
  matchedEjes: string[]           // slugs de ejes temáticos
  razon: string                   // por qué se seleccionó
  geoFiltrado?: boolean          // true si fue descartado por filtro geográfico
  geoRazon?: string               // razón del filtrado geográfico
}

// ─── Cache del diccionario (TTL 5 min — los datos config cambian poco) ──

interface DiccionarioCache {
  asambleistas: Map<string, string>    // "nombre normalizado" → "ID persona"
  keywords: Map<string, string[]>       // "keyword" → ["eje_slug1", "eje_slug2"]
  indicadores: Map<string, string>      // "keyword" → "indicador_slug"
  expiry: number
}

let diccionarioCache: DiccionarioCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// ─── Función principal ───────────────────────────────────────

/**
 * Triaje de notas por keyword matching local.
 * Recibe una lista de notas y retorna solo las que matchean.
 *
 * @param notas - Lista de notas con título, lead, url
 * @param opciones - Umbral mínimo de puntaje (default: 1)
 * @returns Notas que pasaron el triaje, ordenadas por puntaje descendente
 */
export async function trijarNotas(
  notas: NotaLink[],
  opciones?: { puntajeMinimo?: number },
): Promise<TriajeResult[]> {
  const puntajeMin = opciones?.puntajeMinimo ?? 1

  // Cargar diccionario (cacheado)
  const dict = await getDiccionario()

  // Texto normalizado rápido
  const normalizar = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/[^a-z0-9áéíóúñü\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const resultados: TriajeResult[] = []

  for (const nota of notas) {
    const texto = normalizar(`${nota.titulo} ${nota.lead || ''}`)
    if (texto.length < 10) continue

    // ── 0. Filtro geográfico: descartar notas claramente NO bolivianas ──
    const geoCheck = filtrarGeografia(nota.titulo, nota.lead || '')
    if (geoCheck.filtrado) {
      resultados.push({
        url: nota.url,
        titulo: nota.titulo,
        lead: nota.lead || '',
        match: false,
        puntaje: 0,
        matchedPersonas: [],
        matchedKeywords: [],
        matchedEjes: [],
        razon: '',
        geoFiltrado: true,
        geoRazon: geoCheck.razon,
      })
      continue
    }

    const matchedPersonas: string[] = []
    const matchedKeywords: string[] = []
    const matchedEjes = new Set<string>()
    let puntaje = 0

    // 1. Buscar asambleistas (puntaje alto — nombre completo)
    for (const [nombreNorm, personaId] of dict.asambleistas) {
      if (texto.includes(nombreNorm)) {
        matchedPersonas.push(nombreNorm)
        puntaje += 3 // alta prioridad: mención directa a asambleista
      } else {
        // Buscar apellido (2+ palabras del nombre)
        const partes = nombreNorm.split(' ')
        if (partes.length >= 2) {
          // Tomar las 2-3 palabras más significativas del apellido
          const apellidos = partes.slice(1).join(' ')
          if (apellidos.length >= 6 && texto.includes(apellidos)) {
            matchedPersonas.push(nombreNorm)
            puntaje += 2 // prioridad media: solo apellido coincide
          }
        }
      }
    }

    // 2. Buscar keywords de ejes temáticos
    for (const [keyword, ejes] of dict.keywords) {
      if (texto.includes(keyword)) {
        matchedKeywords.push(keyword)
        puntaje += 1
        for (const eje of ejes) {
          matchedEjes.add(eje)
        }
      }
    }

    // 3. Buscar keywords de indicadores
    for (const [keyword, slug] of dict.indicadores) {
      if (texto.includes(keyword)) {
        matchedKeywords.push(keyword)
        puntaje += 1 // misma prioridad que ejes
      }
    }

    // Determinar razón
    let razon = ''
    if (matchedPersonas.length > 0) {
      razon = `Asambleista: ${matchedPersonas[0]}`
    } else if (matchedKeywords.length > 0) {
      razon = `Keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
    }

    resultados.push({
      url: nota.url,
      titulo: nota.titulo,
      lead: nota.lead || '',
      match: puntaje >= puntajeMin,
      puntaje,
      matchedPersonas,
      matchedKeywords,
      matchedEjes: [...matchedEjes],
      razon,
    })
  }

  // Filtrar por puntaje mínimo y ordenar descendente
  return resultados
    .filter(r => r.match)
    .sort((a, b) => b.puntaje - a.puntaje)
}

// ─── Cargar diccionario ──────────────────────────────────────

async function getDiccionario(): Promise<{
  asambleistas: Map<string, string>
  keywords: Map<string, string[]>
  indicadores: Map<string, string>
}> {
  // Retornar cache si es válido
  if (diccionarioCache && diccionarioCache.expiry > Date.now()) {
    return {
      asambleistas: diccionarioCache.asambleistas,
      keywords: diccionarioCache.keywords,
      indicadores: diccionarioCache.indicadores,
    }
  }

  // Consultas en paralelo
  const [personas, ejes] = await Promise.all([
    db.persona.findMany({
      where: { activa: true },
      select: { id: true, nombre: true },
    }),
    db.ejeTematico.findMany({
      where: { activo: true },
      select: { id: true, slug: true, keywords: true },
    }),
  ])

  // 1. Construir mapa de asambleistas (nombre normalizado → ID)
  const asambleistas = new Map<string, string>()
  for (const p of personas) {
    const norm = normalizarNombre(p.nombre)
    if (norm.length >= 3) {
      asambleistas.set(norm, p.id)
    }
  }

  // 2. Construir mapa de keywords → ejes
  const keywords = new Map<string, string[]>()
  for (const eje of ejes) {
    if (!eje.keywords) continue
    const kws = eje.keywords.split(',').map(k => normalizarNombre(k.trim())).filter(k => k.length >= 3)
    for (const kw of kws) {
      const existing = keywords.get(kw) || []
      existing.push(eje.slug)
      keywords.set(kw, existing)
    }
  }

  // 3. Construir mapa de keywords de indicadores
  const indicadores = new Map<string, string>()
  // Indicadores clave que buscamos en notas (sin necesidad de DB — hardcodeados por ahora)
  const indicadoresFijos = [
    { keywords: ['tipo de cambio', 'dolar', 'dolar oficial', 'dolar paralelo', 'brecha cambiaria', 'devaluacion', 'devaluación'], slug: 'tc-oficial' },
    { keywords: ['reservas internacionales', 'reservas netas', 'rin', 'divisas'], slug: 'reservas-internacionales' },
    { keywords: ['inflacion', 'ipc', 'indice de precios', 'canasta familiar'], slug: 'inflacion' },
    { keywords: ['litio', 'carbonato de litio', 'ylb', 'salar de uyuni', 'baterias'], slug: 'litio' },
    { keywords: ['gas natural', 'gnp', 'exportacion de gas', 'ypfb', 'volumen de gas'], slug: 'gas-natural' },
    { keywords: ['zinc', 'estaño', 'plata', 'lme', 'precio del zinc', 'precio minero', 'comibol', 'huanuni'], slug: 'precio-minero' },
    { keywords: ['deficit fiscal', 'presupuesto', 'tgn', 'gasto fiscal', 'financiamiento'], slug: 'presupuesto-fiscal' },
    { keywords: ['pib', 'producto interno bruto', 'crecimiento economico', 'recesion'], slug: 'pib' },
  ]

  for (const ind of indicadoresFijos) {
    for (const kw of ind.keywords) {
      indicadores.set(normalizarNombre(kw), ind.slug)
    }
  }

  // Guardar en cache
  diccionarioCache = {
    asambleistas,
    keywords,
    indicadores,
    expiry: Date.now() + CACHE_TTL,
  }

  console.log(`[Triaje] Diccionario cargado: ${asambleistas.size} asambleistas, ${keywords.size} keywords, ${indicadores.size} indicadores`)

  return { asambleistas, keywords, indicadores }
}

// ─── Helpers ─────────────────────────────────────────────────

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9áéíóúñü\s]/g, '') // solo letras y números
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Filtro geográfico ─────────────────────────────────────
//
// Detecta noticias claramente sobre otros países que no tienen
// contexto boliviano. Solo actúa si NO hay override (asambleista).
// Estrategia: lista blanca de términos Bolivia > lista negativa extranjera.

/**
 * Verifica si una nota tiene contexto boliviano explícito.
 * Si tiene CUALQUIER término de Bolivia, se considera relevante.
 */
function tieneContextoBolivia(textoNorm: string): boolean {
  const BOLIVIA_WHITELIST = [
    'bolivia', 'boliviano', 'boliviana', 'bolivianos', 'bolivianas',
    'plurinacional', 'estado plurinacional',
    'la paz', 'cochabamba', 'santa cruz', 'oruro', 'potosi', 'potosí',
    'sucre', 'beni', 'pando', 'tarija',
    'trinidad', 'cobija', 'guayaramerin', 'guayaramerín', 'riberalta', 'yacuiba',
    'montero', 'sacaba', 'villa tunari', 'el alto', 'viacha',
    'ypfb', 'bcb', 'banco central de bolivia',
    'tse', 'tribunal supremo electoral', 'tsj', 'tribunal supremo de justicia',
    'asamblea legislativa', 'camara de diputados', 'camara de senadores',
    'congreso boliviano', 'senado', 'diputados', 'diputado', 'senador', 'senadora',
    'mas ', 'mas-ips', 'movimiento al socialismo', 'creemos', 'comunidad ciudadana',
    'cristiano democratico', 'fuerza comunal',
    'arce', 'luiz arce', 'luis arce',
    'choquehuanca', 'david choquehuanca',
    'salar de uyuni', 'uyuni', 'salar', 'coipasa', 'sajama', 'illimani',
    'titikaka', 'titicaca', 'chiquitania', 'pantanal', 'madidi',
    'gas natural bolivia', 'gnp', 'gas del pacifico',
    'comibol', 'huanuni', 'viloco', 'malku khota', 'don mario',
    'ylb', 'litio bolivia', 'evolving', 'liti',
    'evo morales', 'eva Copa', 'copa', 'mesa', 'carlos mesa',
    'chi hyun chung', 'chi', 'jorge quiroga', 'quiroga',
    'samuel doria medina', 'doria medina', 'ruben costas', 'costas',
    'importaciones de Bolivia', 'exportaciones de Bolivia',
    'bolivia exporta', 'bolivia importa',
    'ministro de', 'ministra de', 'ministro de economia',
    'viceministro', 'viceministra',
    'poblacion boliviana', 'ciudadanos bolivianos',
    'caletto', 'calello', 'kaltillo',
  ]
  return BOLIVIA_WHITELIST.some(kw => textoNorm.includes(kw))
}

/**
 * Verifica si una nota tiene señales fuertes de ser sobre otro país.
 * Requiere: mención de país extranjero + líder/lugar extranjero específico.
 */
function tieneSenalesExtranjeras(textoNorm: string): { filtrado: boolean; razon: string } {
  // Pares: [señal_primaria, señales_secundarias]
  // Solo se filtra si hay señal primaria + al menos una secundaria
  const REGLAS_EXTRANJERAS: Array<[string, string[]]> = [
    ['argentina', ['buenos aires', 'kirchner', 'milei', 'macri', 'massa', 'cristina fernandez', 'alberto fernandez', 'peso argentino', 'central bank argentina', 'congreso argentino', 'peronista', 'juntos por el cambio', 'caba', 'la plata', 'cordoba argentina', 'rosario', 'mendoza argentina']],
    ['brasil', ['brasilia', 'lula', 'bolsonaro', 'dilma', 'temer', 'real planalto', 'congreso nacional brasil', 'petrobras', 'banco central brasil', 'reales ', 'governo federal', 'federal do brasil']],
    ['chile', ['santiago de chile', 'boric', 'pinera', 'piñera', 'bachalet', 'banco central chile', 'congreso nacional chile', 'valparaiso', 'moneda', 'chileno', 'pensiones chile', 'afp']],
    ['peru', ['lima', 'dina boluarte', 'castillo', 'pedro castillo', 'keiko fujimori', 'fujimori', 'congreso peruano', 'banco central peru', 'peruano', 'peruana', 'puno peru']],
    ['colombia', ['bogota', 'petro', 'duque', 'uribe', 'santos colombia', 'banco central colombia', 'farc', 'eln', 'congreso colombiano', 'peso colombiano']],
    ['venezuela', ['caracas', 'maduro', 'guaido', 'chavez', 'chávez', 'pdvsa', 'congreso venezolano', 'bolivar venezolano']],
    ['ee uu', ['washington dc', 'biden', 'trump', 'kamala', 'harris', 'congreso estadounidense', 'casa blanca', 'pentagono', 'federal reserve', 'white house', 'capitolio', 'republicano', 'democrata']],
    ['estados unidos', ['washington dc', 'biden', 'trump', 'kamala', 'harris', 'congreso estadounidense', 'casa blanca', 'federal reserve', 'white house', 'capitolio', 'republicano', 'democrata']],
    ['china', ['pekin', 'beijing', 'xi jinping', 'jinping', 'partido comunista china', 'congreso chino', 'shanghai', 'shenzhen', 'xinhua', 'taiwan', 'estrecho taiwan']],
    ['rusia', ['moscu', 'moscú', 'putin', 'kremlin', 'duma', 'congreso ruso', 'san vladimir']],
    ['ucrania', ['kiev', 'kiiv', 'zelenski', 'zelensky', 'congreso ucraniano', 'donetsk', 'donbas']],
    ['mexico', ['ciudad de mexico', 'amlo', 'lopez obrador', 'sheinbaum', 'claude sheinbaum', 'congreso mexicano', 'banco central mexico', 'peso mexicano', 'morena']],
    ['cuba', ['la habana', 'diaz-canel', 'raul castro', 'fidel castro', 'congreso cubano', 'partido comunista cuba']],
    ['yemen', ['sanaa', 'houthi', 'huti', 'congreso yemeni']],
    ['iran', ['teheran', 'tehran', 'rohani', 'raisi', 'congreso irani', 'asamblea irani']],
    ['israel', ['jerusalen', 'tel aviv', 'netanyahu', 'benjamin', 'knesset', 'idf', 'hamas', 'gaza strip', 'cisjordania']],
    ['gaza', ['gaza strip', 'hamas', 'cinta de gaza']],
    ['francia', ['paris', 'macron', 'assemblee nationale', 'eliseo', 'lyon', 'marsella']],
    ['españa', ['madrid', 'sanchez', 'pedro sanchez', 'rajoy', 'congreso de los diputados', 'pp ', 'psoe', 'moncloa']],
    ['corea', ['seul', 'pyongyang', 'kim jong', 'yoon suk', 'corea norte', 'corea sur']],
    ['japon', ['tokio', 'kishida', 'shinzo abe', 'diet japones', 'boj']],
    ['india', ['nueva delhi', 'modi', 'parlamento indio', 'rupee', 'lok sabha', 'rajya sabha']],
    ['turquia', ['ankara', 'erdogan', 'grand asamblea nacional', 'lira']],
    ['egipto', ['el cairo', 'al sisi', 'sisi', 'parlamento egipcio']],
    ['libano', ['beirut', 'hezbol', 'parlamento libanes']],
    ['siria', ['damasco', 'assad', 'asad', 'parlamento sirio']],
    ['haiti', ['puerto principe', 'port-au-prince', 'preval', 'aristide', 'prime minister haiti']],
    ['nicaragua', ['managua', 'ortega', 'daniel ortega', 'sandinista']],
    ['guatemala', ['guatemala city', 'ciudad de guatemala', 'arevalo', 'giammattei']],
    ['honduras', ['tegucigalpa', 'castro honduras', 'xiomara castro', 'juan orlando']],
    ['el salvador', ['san salvador', 'bukele', 'nayib bukele', 'asamblea salvadorena']],
    ['ecuador', ['quito', 'noboa', 'correa', 'rafael correa', 'asamblea ecuatoriana', 'banco central ecuador']],
    ['paraguay', ['asuncion', 'asunción', 'santiago pena', 'marcos pena', 'congreso paraguayo']],
    ['uruguay', ['montevideo', 'lacalle pou', 'luis lacalle', 'congreso uruguayo']],
    ['panama', ['panama city', 'panamá', 'cortizo', 'congreso panameño']],
    ['republica dominicana', ['santo domingo', 'abinader', 'congreso dominicano']],
    ['congo', ['kinshasa', 'tshisekedi', 'congo']],
    ['sudan', ['jartum', 'khartoum', 'al burhan']],
    ['somalia', ['mogadiscio', 'al shabab', 'al-shabab']],
    ['etioquia', ['addis abeba', 'abiy ahmed', 'parlamento etiope']],
    ['marruecos', ['rabat', 'marrakech', 'marruecos']],
    ['argel', ['argel', 'tebboune', 'argelia']],
    ['sudafrica', ['pretoria', 'pretoria ', 'ramaphosa', 'parlamento sudafricano', 'cape town']],
    ['nigeria', ['abuja', 'tinubu', 'parlamento nigeriano', 'lagos']],
    ['filipinas', ['manila', 'marcos ', 'bongbong', 'parlamento filipino']],
    ['tailandia', ['bangkok', 'prayut', 'parlamento tailandes']],
    ['australia', ['canberra', 'albanese', 'parlamento australiano']],
    ['canada', ['ottawa', 'trudeau', 'justin trudeau', 'parlamento canadiense', 'house of commons']],
    ['reino unido', ['londres', 'westminster', 'sunak', 'starmer', 'parliament', 'downing street', 'british ']],
    ['europa', ['parlamento europeo', 'europa ', 'union europea', 'comision europea', 'bruselas', 'strasburgo']],
    ['onu', ['secretario general', 'antonio guterres', 'consejo seguridad', 'asamblea general onu']],
  ]

  for (const [primaria, secundarias] of REGLAS_EXTRANJERAS) {
    if (!textoNorm.includes(primaria)) continue
    // Verificar si hay al menos una señal secundaria del mismo país/región
    const senalEncontrada = secundarias.find(s => textoNorm.includes(s))
    if (senalEncontrada) {
      return {
        filtrado: true,
        razon: `Señal extranjera: "${primaria}" + "${senalEncontrada}"`,
      }
    }
  }

  return { filtrado: false, razon: '' }
}

/**
 * Filtro geográfico: descarta notas que son claramente sobre otros países.
 * Las notas que mencionan asambleistas NO se filtran (override en el loop principal).
 */
function filtrarGeografia(titulo: string, lead: string): { filtrado: boolean; razon: string } {
  const textoNorm = titulo.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Si tiene contexto boliviano explícito, nunca filtrar
  if (tieneContextoBolivia(textoNorm)) {
    return { filtrado: false, razon: '' }
  }

  // Solo analizar geografía si el título tiene 15+ chars (títulos cortos = poco contexto)
  if (textoNorm.length < 15) {
    return { filtrado: false, razon: '' }
  }

  // Verificar señales extranjeras
  return tieneSenalesExtranjeras(textoNorm)
}

/**
 * Invalidar cache del diccionario (para pruebas o cuando se actualizan datos config)
 */
export function invalidarCacheDiccionario(): void {
  diccionarioCache = null
}
