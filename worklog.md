---
Task ID: 1
Agent: Super Z (main)
Task: Investigación integral + fixes críticos del sistema DECODEX Bolivia ONION200

Work Log:
- Leí toda la documentación conceptual: CONTEXTO.md, DASHBOARD_DESIGN.md, PROTOCOLOS_PRODUCTO.md, SISTEMA_DE_JOBS.md, ARQUITECTURA_E_V2.md
- Leí prisma/schema.prisma (30+ modelos), scheduler.ts, worker-service.ts, generar-boletin.ts
- Leí dashboard components: ProduccionView.tsx, ResumenView.tsx
- Leí APIs: indicadores-summary/route.ts, dashboard/productos/route.ts, productos/route.ts
- Leí vps-deploy.sh, cron-builder.ts, constants.ts (BOLETINES_SCHEDULE)
- VERIFICADO: Scheduler envía tipoBoletin correcto (EL_TERMOMETRO, etc.) — NO es bug
- CONFIRMADO: vps-deploy.sh tiene `--accept-data-loss` que destruye datos
- CONFIRMADO: No hay datos semilla (Cliente=0, Contrato=0)
- CONFIRMADO: Dashboard API productos tiene catálogo desactualizado

Stage Summary:
- Fix 1 APLICADO: Eliminado --accept-data-loss de vps-deploy.sh línea 140
- Fix 2 APLICADO: Creado prisma/seed-data.ts (1 Cliente + 12 Contratos)
- Fix 3 APLICADO: Sincronizado catálogo en /api/dashboard/productos (12 productos reales)
- Fix 4 APLICADO: Deploy script ahora ejecuta seed-data.ts automáticamente (paso 2c)
- Commit: b4958a6, push a GitHub exitoso
- DEPLOY PENDIENTE: No hay acceso SSH al VPS 8.219.207.43
---
Task ID: 4
Agent: Main Agent
Task: Deploy hardening + Fuente error tracking + On-demand product generation

Work Log:
- Investigated vps-deploy.sh — found 8 critical issues (no timeouts on prisma, CJS cleanup script, no pre-flight checks, no rollback, no structured logging, no health verification, hardcoded DATABASE_URL, poor build timeout handling)
- Investigated fuente scraping pipeline — found error tracking gaps (CapturaLog only has plain string errors, FuenteEstado.error gets overwritten, safeFetch errors only go to console.log, no error history, no phantom source detection)
- Rewrote vps-deploy.sh (220 → 784 lines) with all 8 fixes applied
- Created FuenteErrorLog Prisma model with structured error fields and indexes
- Created fuente-error-logger.ts utility with automatic error classification
- Created 3 API endpoints: /api/fuentes/errores, /api/fuentes/status, /api/productos/generar
- Integrated error logging into check-first/strategies.ts
- All changes committed and pushed to GitHub (commit 39ec284)

Stage Summary:
- vps-deploy.sh: Fully hardened with timeouts, pre-flight checks, rollback tags, structured logging, health verification
- Fuente errors: Structured error log system with 12 error types, classification, history, resolution tracking
- Products: On-demand generation API for admin audit/verification
- 7 files changed, 1108 insertions, 43 deletions
- Commit: 39ec284 pushed to main
---
Task ID: 1-3
Agent: main
Task: Sacar custom.db de git permanentemente + limpiar deploy script + unificar rutas

Work Log:
- Investigado estado actual: custom.db está trackeada en git (10MB), no está en .gitignore
- .gitignore actualizado: agregado `prisma/db/custom.db` y `prisma/db/backups/`
- `git rm --cached prisma/db/custom.db` — sacada del índice, archivo sigue en disco
- `git rm --cached -r prisma/db/backups/` — backups también sacados
- vps-deploy.sh: eliminados todos los hacks de skip-worktree (3 bloques: pre-reset, post-reset, sync-to-repo)
- vps-deploy.sh: eliminado sync de BD al repo (ya no tiene sentido si no está trackeada)
- db.ts: actualizado comentario de "DB trackeada en git" a "BD fuente de verdad, en .gitignore"
- Commit d741e92 push a GitHub

Stage Summary:
- La BD ya NO viaja en git. `git pull` / `git reset --hard` jamás la tocan.
- El deploy script quedó limpio: sin hacks, sin skip-worktree, sin sync al repo.
- Se necesita hacer un deploy completo en el VPS para que los fixes de código entrén en producción.
- **IMPORTANTE**: El VPS necesita ejecutar un bootstrap de una sola vez:
  1. Primero: `git rm --cached prisma/db/custom.db` (sacar del índice local)
  2. Después: `bash vps-deploy.sh` (ahora es seguro)

---
Task ID: 1
Agent: Main Agent
Task: Analizar problema "Paz es el Presidente" - clasificacion de nombres parciales + commit CAPTURA integration

Work Log:
- Analice la imagen del dashboard: mencion "Paz convoca al dialogo..." mostraba "Sin clasificar"
- Investigue el pipeline completo: keyword-triaje → batch-llm → extractor-menciones → LLM
- Identifique 3 causas raiz del problema:
  1. cargoDirectiva NO se incluia en la lista enviada al LLM (solo: nombre, partido, camara)
  2. El prompt no instruye al LLM a hacer matching parcial de nombres
  3. El fuzzy matching en extractor-menciones.ts solo buscaba nombres completos
- Investigue la base de datos: 5 legisladores con "Paz" en su nombre, ninguno con cargoDirectiva
- Solo 1 legislador tiene cargoDirectiva "Presidente" (Diego Avila Navajas, Senado)
- Implemente 3 fixes:
  1. extractor-menciones.cache.ts: agregar cargoDirectiva al select de personas
  2. extractor-menciones.ts: incluir cargoDirectiva en la lista del LLM + matching parcial
  3. extractor-menciones.prompt.ts: reglas de MATCHING PARCIAL y CONTEXTO DE CARGO
- Los archivos previamente modificados (CAPTURA integration) tambien se incluyeron
- Cree branch: fix/captura-integration-clasificacion-nombres
- Commit: 96ed919 con mensaje detallado
- Push fallido: sin credenciales GitHub desde este entorno

Stage Summary:
- Branch creado localmente: fix/captura-integration-clasificacion-nombres (commit 96ed919)
- 5 archivos modificados: capture/route.ts, CapturaView.tsx, extractor-menciones.cache.ts, extractor-menciones.prompt.ts, extractor-menciones.ts
- Push pendiente: necesita ejecutarse desde VPS con credenciales GitHub
- El fix para "Paz=Presidente" opera a nivel del LLM: el prompt ahora le indica hacer matching parcial y usar cargoDirectiva para confirmar
---
Task ID: 1
Agent: main
Task: Expandir módulo de inteligencia para auto-detectar figuras, ejes, keywords y tendencias

Work Log:
- Analizado el pipeline LLM completo: prompt → extractor → crearMenciones → batch-llm
- Expandido prompt del LLM con 5 dimensiones nuevas de detección:
  - personas_detectadas: figuras políticas no en lista (Presidente, Ministros, etc.)
  - ejes_sugeridos: nuevos ejes temáticos detectados
  - keywords_nuevas: keywords no rastreadas
  - tendencias: patrones emergentes en la política boliviana
- Implementado auto-creación de Persona (tipo FIGURA_DETECTADA) en DB
- Implementado almacenamiento en SugerenciaInteligencia (ejes sugeridos)
- Implementado almacenamiento en AprendizajeSistema (keywords + tendencias)
- crearMencionesExtraidas ahora procesa figuras detectadas como menciones
- Cache incluye cargoDirectiva y tipo en query de personas
- Commit f5acbcf pusheado a main en GitHub

Stage Summary:
- 3 archivos modificados: extractor-menciones.ts, extractor-menciones.prompt.ts, extractor-menciones.cache.ts
- 242 líneas agregadas, 8 eliminadas
- Push exitoso a origin/main: a72c2b2..f5acbcf
- El sistema ahora auto-detecta Rodrigo Paz como "Presidente de Bolivia" y lo crea en la BD
