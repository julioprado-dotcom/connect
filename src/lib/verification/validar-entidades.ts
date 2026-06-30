/**
 * DECODEX — Validación de entidades contra la base de datos Persona
 * 
 * Conecta el módulo de entidades (tabla Persona) al pipeline de generación.
 * Dos funciones:
 * 
 * 1. construirDirectorioEntidades() — Para inyectar al PROMPT antes de generar
 *    Le dice a la LLM: "Pamela Aramayo = Médica oncóloga (NO canciller)"
 * 
 * 2. validarCargosEntidades() — Para POST-PROCESAMIENTO después de generar
 *    Verifica que el texto final no atribuya cargos incorrectos a personas registradas
 */

import { getPersonasCached } from '@/lib/ai/extractor-menciones.cache'

// ─── Cargo keywords para detección en texto ──────────────────────

const CARGO_KEYWORDS = [
  'presidente',
  'vicepresidente',
  'ministro',
  'ministra',
  'canciller',
  'gobernador',
  'gobernadora',
  'alcalde',
  'alcaldesa',
  'senador',
  'senadora',
  'diputado',
  'diputada',
  'fiscal',
  'defensor',
  'defensora',
  'general',
  'comandante',
  'dirigente',
  'líder',
  'lider',
  'secretario',
  'secretaria',
  'viceministro',
  'viceministra',
  'ex presidente',
  'ex ministro',
  'ex canciller',
  'director',
  'directora',
  'gerente',
  'coordinador',
  'coordinadora',
  'consejero',
  'consejera',
  'delegado',
  'delegada',
  'representante',
  'magistrado',
  'magistrada',
  'juez',
  'jueza',
  'rector',
  'rectora',
  'oncólogo',
  'oncóloga',
  'médico',
  'médica',
  'doctor',
  'doctora',
  'periodista',
  'abogado',
  'abogada',
  'economista',
  'ingeniero',
  'ingeniera',
]

/**
 * 1. Construye un directorio verificado de entidades para inyectar al prompt.
 * 
 * Para cada persona mencionada en las menciones que tenga un registro en la
 * tabla Persona, devuelve su nombre + cargoDirectiva real.
 * 
 * Esto se inyecta en el prompt del generador para que la LLM sepa el cargo
 * correcto de cada persona.
 */
export async function construirDirectorioEntidades(
  menciones: Array<{ persona?: string | null }>
): Promise<string> {
  if (!menciones || menciones.length === 0) return ''

  try {
    // Obtener personas de la DB (cache 60s)
    const personasDB = await getPersonasCached()
    if (!personasDB || personasDB.length === 0) return ''

    // Extraer nombres únicos de las menciones
    const nombresMencionados = new Set<string>()
    for (const m of menciones) {
      if (m.persona && m.persona.trim().length > 2) {
        nombresMencionados.add(m.persona.trim())
      }
    }

    if (nombresMencionados.size === 0) return ''

    // Buscar cada nombre mencionado en la DB
    const directorio: string[] = []
    for (const nombreMencion of nombresMencionados) {
      const nombreLower = nombreMencion.toLowerCase()

      // Buscar por nombre completo o por apellido
      let encontrada = personasDB.find(p => p.nombre.toLowerCase() === nombreLower)
      if (!encontrada) {
        // Buscar por apellido (última palabra del nombre)
        const apellido = nombreMencion.split(' ').pop()?.toLowerCase() || ''
        encontrada = personasDB.find(p => {
          const pApellidos = p.nombre.split(' ').slice(1).join(' ').toLowerCase()
          return pApellidos === apellido || pApellidos.includes(apellido)
        })
      }

      if (encontrada && encontrada.cargoDirectiva) {
        directorio.push(`- ${encontrada.nombre}: ${encontrada.cargoDirectiva} (${encontrada.tipo})`)
      }
    }

    if (directorio.length === 0) return ''

    return `
DIRECTORIO VERIFICADO DE ENTIDADES (de la base de datos DECODEX):
Los cargos de estas personas estan verificados. USA EXCLUSIVAMENTE estos cargos:
${directorio.join('\n')}
REGLA: Si una persona aparece en el directorio con un cargo, NO le asignes un cargo diferente.
REGLA: Si una persona mencionada NO aparece en este directorio, NO inventes su cargo. Usa solo "el cargo" o "la autoridad".
`
  } catch (err) {
    console.warn('[validarEntidades] Error construyendo directorio:', err)
    return ''
  }
}

/**
 * 2. Valida que los cargos en el texto generado coincidan con la DB.
 * 
 * Post-procesamiento: para cada nombre propio en el texto, si existe en la
 * tabla Persona con un cargoDirectiva, verifica que el texto no le asigne
 * un cargo diferente.
 * 
 * Si detecta un cargo incorrecto, elimina el nombre de esa atribución:
 * "la canciller Pamela Aramayo declaró" → "la canciller declaró"
 * "el presidente Rodrigo Paz anunció" → se MANTIENE si DB dice "Presidente del Estado"
 */
export async function validarCargosEntidades(
  texto: string,
  menciones: Array<{ persona?: string | null }>
): Promise<{ texto: string; correcciones: string[] }> {
  if (!texto || !menciones || menciones.length === 0) {
    return { texto, correcciones: [] }
  }

  const correcciones: string[] = []

  try {
    const personasDB = await getPersonasCached()
    if (!personasDB || personasDB.length === 0) {
      return { texto, correcciones: [] }
    }

    // Construir mapa: apellido_lower → { nombre, cargoDirectiva, tipo }
    const entidadMap = new Map<string, { nombre: string; cargo: string; tipo: string }>()
    for (const p of personasDB) {
      if (!p.cargoDirectiva) continue
      const apellidos = p.nombre.split(' ').slice(1).join(' ').toLowerCase()
      entidadMap.set(apellidos, {
        nombre: p.nombre,
        cargo: p.cargoDirectiva,
        tipo: p.tipo,
      })
      // También por nombre completo
      entidadMap.set(p.nombre.toLowerCase(), {
        nombre: p.nombre,
        cargo: p.cargoDirectiva,
        tipo: p.tipo,
      })
    }

    if (entidadMap.size === 0) return { texto, correcciones: [] }

    // Buscar patrones "el/la [cargo] [Nombre Persona]" en el texto
    let textoCorregido = texto

    // Regex: captura article + cargo + nombre propio
    const patronNombre = /\b(el|la|los|las)\s+([A-ZÁÉÍÓÚÑÜa-záéíóúñü]+(?:\s+[a-záéíóúñü]+){0,2})\s+([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){0,4})\b/g

    let match
    while ((match = patronNombre.exec(textoCorregido)) !== null) {
      const fullMatch = match[0]
      const article = match[1]
      const cargoTexto = match[2].toLowerCase()
      const nombreTexto = match[3]

      // Verificar si este nombre está en la DB
      const nombreLower = nombreTexto.toLowerCase()
      const apellido = nombreTexto.split(' ').pop()?.toLowerCase() || ''
      
      const entidad = entidadMap.get(nombreLower) || entidadMap.get(apellido)
      
      if (!entidad) continue

      // El cargo en el texto coincide con el de la DB?
      const cargoDBLower = entidad.cargo.toLowerCase()
      const cargoTextoLower = cargoTexto.toLowerCase()

      // Verificar si el cargo del texto es compatible con el de la DB
      const esCompatible = verificarCompatibilidadCargo(cargoTextoLower, cargoDBLower)

      if (!esCompatible) {
        // Cargo incompatible: el nombre está mal asociado
        // "la canciller Pamela Aramayo" → "la canciller"
        const replacement = `${article} ${match[2]}`
        textoCorregido = textoCorregido.replace(fullMatch, replacement)
        correcciones.push(
          `Cargo incorrecto corregido: "${fullMatch}" → "${replacement}" (DB: ${entidad.nombre} = ${entidad.cargo})`
        )
        console.log(`[validarEntidades] Corregido: "${fullMatch}" → "${replacement}" (DB: ${entidad.nombre} = ${entidad.cargo})`)
      }
    }

    // Cleanup
    textoCorregido = textoCorregido.replace(/  +/g, ' ')

    return { texto: textoCorregido, correcciones }
  } catch (err) {
    console.warn('[validarEntidades] Error en validación:', err)
    return { texto, correcciones: [] }
  }
}

/**
 * Verifica si el cargo mencionado en el texto es compatible con el cargo en la DB.
 * 
 * Ejemplos:
 * - texto: "presidente", DB: "Presidente del Estado" → compatible
 * - texto: "canciller", DB: "Médica oncóloga" → NO compatible
 * - texto: "ministro", DB: "Ministro de Obras Públicas" → compatible
 * - texto: "oncóloga", DB: "Médica oncóloga" → compatible
 */
function verificarCompatibilidadCargo(cargoTexto: string, cargoDB: string): boolean {
  // Extraer la raíz del cargo del texto
  const raizTexto = extraerRaizCargo(cargoTexto)
  const raizDB = extraerRaizCargo(cargoDB)

  // Si la raíz del texto está contenida en la raíz del DB, es compatible
  if (raizDB.includes(raizTexto) || raizTexto.includes(raizDB)) return true

  // Si ambas comparten la misma raíz fundamental
  if (raizTexto === raizDB) return true

  // Lista de equivalencias aceptables
  const EQUIVALENCIAS: Record<string, string[]> = {
    'presidente': ['presidente del estado', 'presidente de la camara', 'presidente del senado', 'ex presidente'],
    'vicepresidente': ['vicepresidente del estado'],
    'ministro': ['ministra', 'viceministro', 'viceministra'],
    'gobernador': ['gobernadora'],
    'alcalde': ['alcaldesa'],
    'senador': ['senadora'],
    'diputado': ['diputada'],
    'fiscal': ['fiscal general'],
  }

  for (const [base, variantes] of Object.entries(EQUIVALENCIAS)) {
    if (variantes.some(v => raizTexto.includes(v) || raizDB.includes(v))) return true
  }

  return false
}

/**
 * Extrae la raíz fundamental de un cargo.
 * "Presidente del Estado Plurinacional" → "presidente"
 * "Médica oncóloga" → "medica oncologa"
 */
function extraerRaizCargo(cargo: string): string {
  return cargo
    .toLowerCase()
    .replace(/^(el|la|los|las|del|de)\s+/g, '')
    .replace(/\s+(del?|la|los?|las?|en|de|y|e)\s+/g, ' ')
    .trim()
}
