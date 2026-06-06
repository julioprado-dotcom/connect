/**
 * Services Barrel — DECODEX Bolivia
 * Punto de entrada unificado para los 5 módulos del Equipo A.
 *
 * Módulos:
 *   A1 — WhatsApp Business API (whatsapp.ts)
 *   A2 — Email Service (email.ts)
 *   A3 — Indicadores Reales (indicadores.ts)
 *   A4 — PDF Generator (pdf-generator.ts)
 *   A5 — Cola de Trabajos (queue.ts)
 *
 * Todos funcionan en modo mock automático sin credenciales.
 */

// ─── A1: WhatsApp Business API ────────────────────────────────────
export {
  sendWhatsApp,
  validatePhone,
  fragmentMessage,
  getServiceStatus as getWhatsAppStatus,
  resetConfig as resetWhatsAppConfig,
  classifyError,
  shouldRetry,
  MAX_MESSAGE_LENGTH,
  RETRY_DELAYS_MS,
  MAX_RETRIES,
} from './whatsapp'
export type {
  WhatsAppOptions,
  WhatsAppDeliveryResult,
  WhatsAppServiceStatus,
  WhatsAppConfig,
  PhoneValidationResult,
  WhatsAppErrorType,
} from './whatsapp.types'

// ─── A2: Email Service ───────────────────────────────────────────
export {
  validateEmail,
  inlineStyles,
  getServiceStatus as getEmailStatus,
  preview,
  sendEmail,
  sendBulk,
} from './email'
export type {
  Attachment,
  EmailDeliveryResult,
  EmailOptions,
  EmailPreview,
  EmailValidationResult,
  EmailServiceStatus,
  EmailType,
} from './email.types'

// ─── A3: Indicadores Económicos Reales ───────────────────────────
export {
  fetchIndicadores,
  getAvailableSlugs,
  getIndicador,
  getAllIndicadores,
  fetchIndicadoresPorCategoria,
  getServiceStatus as getIndicadoresStatus,
  getCategorias,
  clearCache as clearIndicadoresCache,
  configureService as configureIndicadores,
  resetService as resetIndicadores,
  getCacheStats,
} from './indicadores'
export type {
  IndicadorReal,
  SlugIndicador,
  FetchIndicadoresResult,
  FetchError,
  FuenteConfig,
  CategoriaIndicador,
  CategoriaInfo,
  IndicadoresServiceConfig,
} from './indicadores.types'

// ─── A4: Generador de PDF ────────────────────────────────────────
export {
  generarHTMLInforme,
  htmlToPDF,
  generarInformeSemanal,
  generarFichaPersona,
  generarInformeAdHoc,
  generarInformePDF,
} from './pdf-generator'
export type {
  InformeData,
  TipoInforme,
  PDFGenerationOptions,
  HTMLToPDFOptions,
  PDFGenerationResult,
  InformeSemanalData,
  FichaPersonaData,
  InformeAdHocData,
  RankingPersonaEntry,
  Tendencia,
} from './pdf-generator.types'

// ─── A5: Cola de Trabajos ───────────────────────────────────────
export {
  initializeQueue,
  enqueueJob,
  getJobStatus,
  cancelJob,
  retryJob,
  getQueueStats,
  registerHandler,
  startWorkers,
  stopWorkers,
  getServiceStatus as getQueueStatus,
  purgeCompleted,
  resetState as resetQueueState,
  getJobConfig,
  getSupportedJobTypes,
  setMockDelayScale,
} from './queue'
export type {
  JobType,
  JobPayload,
  JobResult,
  EnqueuedJob,
  QueueStats,
  JobTypeConfig,
  JobHandler,
  QueueServiceStatus,
} from './queue.types'
