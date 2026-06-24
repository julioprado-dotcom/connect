/**
 * DECODEX v0.16.0 — Verificador Post-Generacion Anti-Alucinacion
 * 
 * Se ejecuta DESPUES de que el LLM genera el texto y ANTES de guardar el producto.
 * Cruza el contenido generado contra las menciones reales para detectar:
 * - Nombres de personas no presentes en las menciones
 * - Instituciones no mencionadas en los datos
 * - Eventos inventados
 * - Cifras o datos no respaldados
 * - Contenido en ingles
 * - Personajes politicos sensibles fuera de contexto
 */

// ─── Personajes politicos bolivianos sensibles ──────────────────────
// Si alguno de estos aparece en el texto generado, verificar
// DOBLEMENTE que esta en las menciones. Si no esta, eliminar.
const PERSONAJES_SENSIBLES = [
  // Nombres completos de políticos — más específicos, menos falsos positivos
  'Evo Morales',
  'Luis Arce',
  'David Choquehuanca',
  'Luis Camacho',
  'Carlos Mesa',
  'Chi Hyun Chung',
  'Felipe Quispe',
  'Samuel Doria Medina',
  'Jorge Quiroga',
  // Instituciones específicas (no genéricas)
  'Tribunal Supremo',
  'Tribunal Constitucional',
  'CIDOB',
  'CONAMAQ',
  'Comunidad Ciudadana',
  'Creemos',
  'Frente Unido',
  // Mantener siglas únicas
  'TSE',
  'OEP',
  'COB',
  'MAS',
]

// ─── Patrones de contenido en ingles ───────────────────────────────
const ENGLISH_PATTERNS = [
  // Requiere 3+ palabras inglesas consecutivas — evita falsos positivos en español bilingue
  /\b(the|is|are|was|were|has|have|had|will|would|could|should)\b\s+(?:of|in|for|to|the|that)\s+\b(president|government|minister|congress|senate)\b/gi,
  /\b(president|government|minister|congress|senate)\b\s+(?:of|in|for)\s+\b(the|a|this|that)\b\s+\w{4,}/gi,
  // Solo secuencias de fecha completas en inglés (no sueltas)
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b,\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi,
]

// ─── Labels politicos fabricados ──────────────────────────────────
// La IA genera labels como "el evista", "el masista", "la derecha" etc.
// Estos NO vienen de las menciones — son fabricaciones del LLM.
// Estrategia: reemplazar por "sector" o eliminar si no hay sustituto.
const LABELS_POLITICOS_FABRICADOS: Array<{
  patron: RegExp
  reemplazo: string
  razon: string
}> = [
  // "el evista" / "la evista" / "los evistas" — label que inventa la IA
  { patron: /\b(el|la|los|las)\s+evistas?\b/gi, reemplazo: '', razon: 'Label politico fabricado "evista"' },
  // "el masista" / "los masistas"
  { patron: /\b(el|la|los|las)\s+masistas?\b/gi, reemplazo: '', razon: 'Label politico fabricado "masista"' },
  // "el derechista" / "la derecha" como adjetivo de actor
  { patron: /\b(el|la|los|las)\s+derechistas?\b/gi, reemplazo: '', razon: 'Label politico fabricado "derechista"' },
  // "el progresista" / "los progresistas"
  { patron: /\b(el|la|los|las)\s+progresistas?\b/gi, reemplazo: '', razon: 'Label politico fabricado "progresista"' },
  // "el opositor" / "los opositores" como label generico
  { patron: /\b(el|la|los|las)\s+opositores?\b/gi, reemplazo: '', razon: 'Label politico fabricado "opositor"' },
  // "el oficialista" / "los oficialistas"
  { patron: /\b(el|la|los|las)\s+oficialistas?\b/gi, reemplazo: '', razon: 'Label politico fabricado "oficialista"' },
  // "el conservador" / "los conservadores"
  { patron: /\b(el|la|los|las)\s+conservadores?\b/gi, reemplazo: '', razon: 'Label politico fabricado "conservador"' },
]

// ─── Tipos ──────────────────────────────────────────────────────────

export interface VerifyResult {
  verified: boolean
  textoLimpio: string
  eliminados: EliminadoItem[]
  alertas: string[]
  estadisticas: {
    oracionesOriginales: number
    oracionesEliminadas: number
    personajesSensiblesEncontrados: number
    personajesSensiblesVerificados: number
    personajesSensiblesEliminados: number
  }
}

interface EliminadoItem {
  texto: string
  razon: string
  tipo: 'personaje_sensible' | 'dato_no_verificado' | 'contenido_ingles' | 'label_fabricado'
}

interface MencionResumen {
  texto: string
  titulo: string
  medio: string
  persona?: string | null
}

// ─── Funcion Principal ──────────────────────────────────────────────

/**
 * Verifica el contenido generado contra las menciones reales.
 * Elimina oraciones que contengan datos no respaldados.
 * 
 * @param textoGenerado - Texto generado por el LLM
 * @param mencionesUsadas - Menciones reales usadas como input
 * @param tipoProducto - Tipo de producto (para logging)
 */
export async function verifyProduct(
  textoGenerado: string,
  mencionesUsadas: MencionResumen[],
  tipoProducto: string = 'desconocido'
): Promise<VerifyResult> {
  const resultado: VerifyResult = {
    verified: true,
    textoLimpio: textoGenerado,
    eliminados: [],
    alertas: [],
    estadisticas: {
      oracionesOriginales: 0,
      oracionesEliminadas: 0,
      personajesSensiblesEncontrados: 0,
      personajesSensiblesVerificados: 0,
      personajesSensiblesEliminados: 0,
    },
  }

  if (!textoGenerado || textoGenerado.trim().length === 0) {
    resultado.alertas.push('Texto vacio recibido para verificacion')
    return resultado
  }

  // Paso 0: Eliminar labels politicos fabricados por la IA
  // La IA inventa labels como "el evista", "el masista" que NO estan en las menciones
  let textoPreprocesado = textoGenerado
  for (const label of LABELS_POLITICOS_FABRICADOS) {
    const antes = textoPreprocesado
    textoPreprocesado = textoPreprocesado.replace(label.patron, label.reemplazo)
    if (textoPreprocesado !== antes) {
      resultado.alertas.push(label.razon)
      // Limpiar dobles espacios y articulos sueltos
      textoPreprocesado = textoPreprocesado
        .replace(/\s+/g, ' ')
        .replace(/\b(el|la|los|las)\s+[,.]/gi, '$1.')
        .replace(/\s+([,.])/g, '$1')
    }
  }
  if (textoPreprocesado !== textoGenerado) {
    console.warn(`[verify-product] Labels fabricados eliminados en ${tipoProducto}`)
  }

  // Paso 1: Construir corpus de texto verificado de las menciones
  const corpusMenciones = construirCorpusMenciones(mencionesUsadas)
  const nombresEnMenciones = extraerNombresDeMenciones(mencionesUsadas)

  // Paso 2: Dividir texto en oraciones
  const oraciones = dividirEnOraciones(textoPreprocesado)
  resultado.estadisticas.oracionesOriginales = oraciones.length

  // Paso 3: Verificar cada oracion
  const oracionesVerificadas: string[] = []

  for (const oracion of oraciones) {
    const resultadoOracion = verificarOracion(oracion, corpusMenciones, nombresEnMenciones)

    if (resultadoOracion.aprobada) {
      oracionesVerificadas.push(oracion)
    } else {
      resultado.estadisticas.oracionesEliminadas++
      resultado.eliminados.push({
        texto: oracion,
        razon: resultadoOracion.razon,
        tipo: resultadoOracion.tipo,
      })
      console.warn(
        `[verify-product] Contenido eliminado por no estar respaldado por menciones: "${oracion.substring(0, 100)}..." ` +
        `(${resultadoOracion.razon}) [${tipoProducto}]`
      )
    }
  }

  // Paso 4: Detectar personajes sensibles
  const personajesEnTexto = detectarPersonajesSensibles(textoPreprocesado)
  resultado.estadisticas.personajesSensiblesEncontrados = personajesEnTexto.length

  for (const personaje of personajesEnTexto) {
    if (nombresEnMenciones.some(n => normalizar(n).includes(normalizar(personaje)))) {
      resultado.estadisticas.personajesSensiblesVerificados++
    } else {
      resultado.estadisticas.personajesSensiblesEliminados++
      resultado.alertas.push(
        `Personaje sensible "${personaje}" aparece en el texto PERO no en las menciones. ` +
        `Verificar si es legítimo o debe eliminarse.`
      )
    }
  }

  // Paso 5: Detectar contenido en ingles
  const contenidoIngles = detectarContenidoIngles(textoPreprocesado)
  if (contenidoIngles) {
    resultado.alertas.push(`Posible contenido en ingles detectado: "${contenidoIngles}"`)
  }

  // Paso 6: Reconstruir texto limpio
  resultado.textoLimpio = reconstruirTexto(oracionesVerificadas, textoPreprocesado)

  // Paso 7: Determinar si es verificado
  resultado.verified = resultado.eliminados.length === 0

  if (!resultado.verified) {
    console.warn(
      `[verify-product] ALERTA: Se elimino contenido no verificado en ${tipoProducto}: ` +
      `${resultado.eliminados.length} oraciones eliminadas`
    )
  }

  return resultado
}

// ─── Funciones Auxiliares ───────────────────────────────────────────

function construirCorpusMenciones(menciones: MencionResumen[]): string {
  return menciones
    .map(m => `${m.titulo} ${m.texto} ${m.persona ?? ''} ${m.medio}`)
    .join(' ')
    .toLowerCase()
}

function extraerNombresDeMenciones(menciones: MencionResumen[]): string[] {
  const nombres: string[] = []
  for (const m of menciones) {
    if (m.persona) nombres.push(m.persona)
    // Extraer nombres propios del titulo y texto
    const palabras = `${m.titulo} ${m.texto}`.split(/\s+/)
    for (const palabra of palabras) {
      if (palabra.length > 3 && /^[A-ZÁÉÍÓÚÑ]/.test(palabra)) {
        nombres.push(palabra.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''))
      }
    }
  }
  return nombres.map(normalizar)
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .trim()
}

function dividirEnOraciones(texto: string): string[] {
  // Dividir por puntos, saltos de linea, o dobles saltos
  const bloques = texto.split(/(?<=[.!?\n])\s*\n*/).filter(s => s.trim().length > 0)
  return bloques
}

interface ResultadoVerificacionOracion {
  aprobada: boolean
  razon: string
  tipo: EliminadoItem['tipo']
}

function verificarOracion(
  oracion: string,
  corpusMenciones: string,
  nombresEnMenciones: string[]
): ResultadoVerificacionOracion {
  const oracionNorm = normalizar(oracion)

  // Verificar personajes sensibles
  for (const personaje of PERSONAJES_SENSIBLES) {
    const personajeNorm = normalizar(personaje)
    if (oracionNorm.includes(personajeNorm)) {
      // Si el personaje NO esta en las menciones, marcar como sospechoso
      const estaEnMenciones = nombresEnMenciones.some(n => n.includes(personajeNorm))
      if (!estaEnMenciones) {
        return {
          aprobada: false,
          razon: `Personaje sensible "${personaje}" no aparece en las menciones proporcionadas`,
          tipo: 'personaje_sensible',
        }
      }
    }
  }

  // Verificar si la oracion tiene datos especificos (nombres propios, numeros de ley, cifras)
  // Si tiene datos especificos, al menos una palabra clave debe estar en las menciones
  const tieneDatosEspecificos = /(?:ley|decreto|resolucion|articulo)\s+\d+/i.test(oracion) ||
    /(?:\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:%|por ciento|bolivianos|bs|usd)/i.test(oracion) ||
    /(?:presidente|ministro|gobernador|alcalde|senador|diputado)\s+[A-ZÁÉÍÓÚÑ]/i.test(oracion)

  if (tieneDatosEspecificos) {
    // Extraer palabras clave de la oracion
    const palabrasClave = oracion
      .split(/\s+/)
      .filter(p => p.length > 4 && !esStopWord(p))
      .map(normalizar)

    const tieneCoincidencia = palabrasClave.some(palabra =>
      corpusMenciones.includes(palabra)
    )

    if (!tieneCoincidencia) {
      return {
        aprobada: false,
        razon: 'Dato especifico (ley, decreto, cifra, cargo) sin respaldo en menciones',
        tipo: 'dato_no_verificado',
      }
    }
  }

  return { aprobada: true, razon: '', tipo: 'dato_no_verificado' }
}

function esStopWord(palabra: string): boolean {
  const stops = new Set([
    'este', 'esta', 'esto', 'estos', 'estas', 'aquel', 'aquella',
    'que', 'donde', 'cuando', 'como', 'por', 'para', 'con', 'sin',
    'sobre', 'entre', 'hacia', 'hasta', 'desde', 'durante', 'tras',
    'mientras', 'según', 'contra', 'bajo', 'sobre', 'ante', 'mediante',
    'fue', 'ser', 'estar', 'haber', 'tener', 'hacer', 'poder', 'decir',
    'este', 'ese', 'aquel', 'su', 'sus', 'mi', 'tu', 'nuestro',
    'más', 'menos', 'muy', 'bien', 'mal', 'ya', 'todavía', 'aún',
    'también', 'además', 'incluso', 'solo', 'cada', 'todo', 'otro',
    'mismo', 'tanto', 'poco', 'mucho', 'bastante', 'demasiado',
  ])
  return stops.has(palabra.toLowerCase())
}

function detectarPersonajesSensibles(texto: string): string[] {
  const encontrados: string[] = []
  for (const personaje of PERSONAJES_SENSIBLES) {
    const regex = new RegExp(`\\b${personaje}\\b`, 'gi')
    if (regex.test(texto)) {
      encontrados.push(personaje)
    }
  }
  return [...new Set(encontrados)]
}

function detectarContenidoIngles(texto: string): string | null {
  for (const pattern of ENGLISH_PATTERNS) {
    const match = pattern.exec(texto)
    if (match) {
      return match[0]
    }
  }
  return null
}

function reconstruirTexto(oracionesVerificadas: string[], textoOriginal: string): string {
  // Si no se elimino nada, devolver original
  if (oracionesVerificadas.length === textoOriginal.split(/(?<=[.!?\n])\s*\n*/).filter(s => s.trim().length > 0).length) {
    return textoOriginal
  }

  // Reconstruir manteniendo saltos de linea del original
  let resultado = oracionesVerificadas.join(' ')
  
  // Restaurar encabezados (lineas que empiezan con #)
  const encabezados = textoOriginal.match(/^#{1,3}\s+.+$/gm)
  if (encabezados) {
    for (const encabezado of encabezados) {
      if (!resultado.includes(encabezado.trim())) {
        resultado = resultado + '\n\n' + encabezado
      }
    }
  }

  return resultado
}
