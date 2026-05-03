# CHANGELOG — DECODEX

---

## [v0.9.0] — 2026-05-04

### Integración de Equipo A (Servicios Externos)

Se integraron los 5 módulos del Equipo A directamente en `src/lib/services/`:

| Módulo | Archivo | Función exportada |
|--------|---------|-------------------|
| A1 — WhatsApp | `whatsapp.ts` + `.types.ts` | `sendWhatsApp()` |
| A2 — Email | `email.ts` + `.types.ts` | `sendEmail()` |
| A3 — Indicadores | `indicadores.ts` + `.types.ts` | `fetchIndicadores()` |
| A4 — Generador PDF | `pdf-generator.ts` + `.types.ts` | `generarInformePDF()` |
| A5 — Cola de Trabajos | `queue.ts` + `.types.ts` | `enqueueJob()` |

- Barrel export en `src/lib/services/index.ts` para importaciones limpias
- Todos los módulos operan en **mock mode** por defecto (variables de entorno controlan el modo real)
- Tipado estricto — **0 uso de `any`** en toda la capa de servicios
- Archivos de ejemplo relocados a `src/lib/services/examples/` (excluidos del build)
- Dependencias agregadas: `pg-boss`, `@types/puppeteer`

### Sistema de Marca DECODEX (Equipo Comercial/Brand)

Nuevo archivo `src/constants/brand.ts` con el sistema de marca completo:

- **Paleta de colores**: Navy `#0F2027`, Blue `#1284BA`, Orange `#FF862F`, Teal `#203A43` + 7 variables CSS
- **Logos**: SVGs en color y blanco (`LOGO_SVG_COLOR`, `LOGO_SVG_WHITE`)
- **Iconografía**: 5 SVGs vectoriales (ojo, correo, gráfico, calendario, escudo)
- **Reglas de canal WhatsApp**: 1600 caracteres máx, estructura fija, emojis permitidos
- **Reglas de canal Email**: layout 600px, tabla HTML, badges de sentimiento
- **Reglas de canal PDF**: A4 con márgenes, header/footer con marca
- **Tono de marca**: formalidad media, pronombre "usted", palabras prohibidas/permitidas
- **Checklist visual**: 10 ítems de verificación de calidad visual

### Core Quick Wins (Seguridad + Calidad)

| ID | Tarea | Detalle |
|----|-------|---------|
| CORE-1 | Protección `/api/seed` | Requiere `SEED_API_KEY` como variable de entorno; wipe forzado requiere autenticación |
| CORE-2 | XSS en BoletinesView | Sanitización con DOMPurify + whitelist de etiquetas seguras |
| CORE-3 | Limpieza de archivos | Ejemplos relocados a `services/examples/`, excluidos de `tsconfig.json` |
| CORE-4 | `.env.example` | Documentación completa de todas las variables de entorno requeridas |
| CORE-5 | Verificación | `tsc --noEmit` = 0 errores TypeScript |

### Actualización de Delivery v2

- Límite de WhatsApp ajustado de 3800 a **1600 caracteres** (real WhatsApp limit)
- Email ahora usa template DECODEX con layout de tabla, badges de sentimiento, header/footer
- Imports sincronizados con `src/constants/brand.ts`

### Métricas de la versión

- **5,582 líneas** de código integradas (módulos Equipo A)
- **319+ tests** cubiertos por la suite del Equipo A
- **0 errores** TypeScript
- **2 vulnerabilidades críticas** resueltas (XSS, seed sin auth)
- **15 archivos nuevos** en `src/lib/services/`

---

## [v0.8.0] — 2026-04-30

### Versión fundacional

- Dashboard administrativo completo con 18 vistas
- Sistema de monitoreo de medios con captura automatizada
- Generadores de productos con preview embebido
- Agente comercial con gestión de suscriptores y clientes
- Base de datos SQLite con Prisma ORM
- Interfaz dark/light theme con Tailwind CSS
- API routes para seed, captura, indicadores, reportes, medios, menciones
- Documentación técnica generada (DOCX + PDF)
