/**
 * Rotación de User-Agents para el sistema anti-ban
 *
 * Módulo encargado de proporcionar agentes de usuario realistas para
 * las solicitudes HTTP, rotando entre diferentes navegadores y sistemas
 * operativos para evitar patrones detectables.
 */

/** Agente de usuario identitario del bot DECODEX (solicitudes que deben ser rastreables) */
export const IDENTITY_UA =
  'DECODEX-Bot/1.0 (Bolivia Data Observatory; +https://decodex.bo/bot)'

/**
 * Grupo de User-Agents disponibles para rotación.
 * Mezcla de Chrome, Firefox y Edge en Windows, macOS y Linux.
 * Algunos incluyen pistas de localización Bolivia (es-BO).
 */
export const USER_AGENT_POOL: string[] = [
  // --- Chrome en Windows ---
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36,gzip(gfe)',

  // --- Chrome en macOS ---
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',

  // --- Chrome en Linux ---
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',

  // --- Firefox en Windows ---
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',

  // --- Firefox en macOS ---
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',

  // --- Firefox en Linux ---
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',

  // --- Edge en Windows ---
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',

  // --- Chrome en macOS con localización Bolivia ---
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 (es-BO)',

  // --- Chrome en Linux con localización Bolivia ---
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 (es-BO, es)',
]

/**
 * Obtiene un User-Agent aleatorio del grupo de rotación.
 * Utiliza crypto.randomUUID como semilla para mayor entropía.
 *
 * @returns Un string de User-Agent seleccionado aleatoriamente del grupo.
 */
export function getRandomUserAgent(): string {
  // Índice aleatorio basado en el tamaño del grupo
  const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % USER_AGENT_POOL.length
  return USER_AGENT_POOL[randomIndex]
}
