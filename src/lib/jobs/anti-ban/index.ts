/**
 * Módulo central de anti-ban
 *
 * Re-exporta todos los componentes del sistema anti-ban:
 * - Rotación de User-Agents
 * - Verificador de robots.txt
 * - Limitador de tasa por dominio
 */

export { USER_AGENT_POOL, IDENTITY_UA, getRandomUserAgent } from './user-agents'
export { robotsChecker, RobotsChecker } from './robots-txt'
export { domainRateLimiter, DomainRateLimiter } from './rate-domain'
