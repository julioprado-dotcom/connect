
---
Task ID: 1
Agent: Main Agent
Task: Fix "4 OK" bug + dashboard controls + historial visible

Work Log:
- Investigated full data flow: strategies.ts → check-fuente.ts → worker.ts → phase/route.ts → ScrapingPhaseControl.tsx
- Found ROOT CAUSE: check-fuente.ts runner drops `error` field from checkFuente() result when building job data
- checkFuente() catches all errors internally (returns cambiado:false + error field), but runner maps success:true and omits error from data
- Worker sees success:true → calls complete() instead of fail() → job estado = 'completado' instead of 'fallido'
- phase/route.ts reads job resultado, finds no error field → marks as 'completado'

Fix 1: check-fuente.ts — Propagated `error` and `estrategiasProbadas` fields in both return branches (cambiado:true and cambiado:false)
Fix 2: phase/route.ts — Added DETAIL pattern matching as safety net (HTTP 403, fetch failed, timeout, forbidden, vacío, no parseable, ECONNREFUSED, etc.)
Fix 3: PipelineMonitor.tsx — Moved "Forzar Check", "Reprogramar", "Huerfanos", "Limpiar" to compact view (always visible)
Fix 4: PipelineMonitor.tsx — Added "Actividad Reciente" mini-historial in compact view showing last 8 jobs with error detection

Stage Summary:
- Bug "4 OK" fixed at source: error field now propagates from strategies → runner → job resultado → phase handler
- Double safety net: phase handler also checks detalle for error patterns
- Dashboard controls now visible without expanding: Pausar/Reanudar, Forzar Check, Reprogramar, Huerfanos, Limpiar
- Mini historial always visible with color-coded status (red=fail, amber=error, green=changed, gray=no change)
- All changes pass TypeScript compilation
