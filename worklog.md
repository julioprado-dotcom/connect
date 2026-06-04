---
Task ID: 1
Agent: Main Agent
Task: Fix prompt contamination in products.ts

Work Log:
- Read complete `src/constants/products.ts` from git HEAD (683 lines)
- Identified 4 products with contamination contradicting REGLAS_ANTI_ALUCINACION:
  - SALDO_DEL_DIA: "con perspectiva", "Perspectiva manana", "Cerrar con una perspectiva"
  - EL_FOCO: "Conclusiones" in structure
  - EL_ESPECIALIZADO: "con recomendaciones", "Recomendaciones > Anexos", "Incluir recomendaciones accionables"
  - EL_INFORME_CERRADO: "con prospectiva", "Prospectiva" in structure, "Prospectiva basada..."
- Applied 13 edits total (MultiEdit):
  - SALDO_DEL_DIA: tono→objetivo, estructura sin Perspectiva, "resumen de lo observado"
  - EL_FOCO: "Conclusiones"→"Sintesis"
  - EL_ESPECIALIZADO: "consultor"→"analista", "con recomendaciones"→"objetivo", "Recomendaciones"→"Hallazgos", "recomendaciones accionables"→"hallazgos clave"
  - EL_INFORME_CERRADO: "con prospectiva"→"objetivo", quitado seccion Prospectiva, quitado linea Prospectiva
  - Updated descripcion fields for EL_ESPECIALIZADO and EL_INFORME_CERRADO
- Verified: zero occurrences of recomendacion/conclusion/prospectiv/perspectiv in file
- Committed as 92a57bd, pushed to main

Stage Summary:
- Prompt contamination fully resolved
- All 12 product prompts now aligned with REGLAS_ANTI_ALUCINACION
- No recommendations, conclusions, perspective, or prospectiva in any prompt
- Commit: 92a57bd

---
Task ID: 2
Agent: Main Agent  
Task: Read full project documentation and source code from git

Work Log:
- Read decodex-audit.txt lines 201-2363 (via git show HEAD:decodex-audit.txt)
- Read docs/PROMPT-MESTRO-DECODEX.md (235 lines) - Master project prompt v0.14.0
- Read docs/ESTANDAR_PRODUCTOS.md (126 lines) - Product quality standard
- Read src/lib/ai/extractor-menciones.ts (1077 lines) - Full extraction + DB persistence
- Read src/lib/ai/circuit-breaker.ts (196 lines) - 3-state LLM circuit breaker
- Read src/lib/ai/extractor-menciones.prompt.ts (370 lines) - Dynamic prompt builder from Marco Conceptual
- Read src/lib/bulletin/delivery.ts (205 lines) - Multi-channel formatting
- Read src/lib/bulletin/product-generator.ts (165 lines) - Date ranges, mention queries
- Read src/types/bulletin.ts (200 lines) - All type definitions

Stage Summary:
- Complete understanding of pipeline architecture achieved
- Pipeline flow: Fuente → scrape-fuente → NotaRaw → extractor-menciones (LLM) → Mencion → product-generator → bulletin
- product-generator.getDateRange() returns 7 days for daily products (NOT 1 day)
- Circuit breaker: opens after 4 failures, 5min recovery interval, half-open tests every 30s
- Extractor has 3 dedup layers: NotaRaw, URL-based, cross-medio fingerprint
- Key files for capture diagnosis: scrape-fuente runner, scheduler, circuit-breaker state
- NOTE: ESTANDAR_PRODUCTOS.md line 49 still says "Accion sugerida" for ALERTA - contradicts REGLAS_ANTI_ALUCINACION but this is documentation, not prompt code

Key insight: With only 4 NotaRaws captured in a crisis day, the problem is UPSTREAM of the extractor - it's in the scrape-fuente runner (Phase A of pipeline). The extractor only processes what scrape-fuente captures.

---
Task ID: 5
Agent: Main Agent
Task: Diagnosticar falla de captura — análisis exhaustivo de BD backup

Work Log:
- Descargé backup DB más reciente desde branch db-backup (commit d46d0db, 2026-06-04 12:00)
- Install sqlite3 not available, used Python sqlite3 module
- Analicé NotaRaws, FuenteEstado, CapturaLog, SystemLog, Job tables

Stage Summary:
**Context**: ~2 semanas sin captura (migración May 12 → Jun 1-3)
**Backup snapshot**: June 4 12:00 (VPS showed 104 NotaRaws total for June 4, backup only had 18 at noon)

KEY FINDINGS:
1. FUENTES ACTIVAS: 30 activas, 19 inactivas (se inactivaron durante migración por 3 fallos consecutivos)
2. CHECKS HOY: 16 fuentes con checks (6 capa=2 al 100% cambios, 3 capa=0 inactivas, 1 capa=2 night checkers)
3. SIN CHECKS HOY: 33 fuentes, pero 13 de ellas activas con checks del 3 junio (frecuencia 6h = esperable)
4. ERRORES INACTIVAS: fetch failed (10), tipo_desconocido: zai (3), HTTP 403 (3), 401 (1), 404 (1), 301 (1)
5. CAPTURA LOG: Vacío desde May 12 — los checks nuevos NO se registran en CapturaLog
6. JOB TABLE: No hay jobs desde May 12 — scheduler no usa tabla Job para check_fuente
7. SYSTEM LOG: Con fecha 2000-01-01 (bug de timestamp) pero muestra batch_llm y generar_boletin activos
8. NOTARAWS HOY (backup 12:00): 18 de 3 fuentes. VPS mostró 104 total para el día.
9. CAPA=2 sources: 100% ratio de cambios (12 checks = 12 cambios) — scraping funciona perfecto

DIAGNOSIS:
- El pipeline SÍ está funcionando parcialmente desde que se reinició (Jun 3 22:42)
- El scheduler hace checks directamente (no via Job table) y está activo
- 19 fuentes inactivas necesitan reset de fallosConsecutivos
- "tipo_desconocido: zai" es un bug en strategy resolution
- CapturaLog no registra checks nuevos — probablemente código no actualizado en VPS
