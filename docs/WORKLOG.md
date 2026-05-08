# DECODEX Bolivia — Worklog

## 2026-05-08 — Etapa 150: T6-T8 implementados

### T6: Activar fuentes (fase test) + EL_ESPECIALIZADO
- `EL_ESPECIALIZADO` en products.ts: `activo: false` → `activo: true`
- Creado `src/app/api/seed-fuentes/route.ts` (POST + GET)
  - POST: crea FuenteEstado para medios sin estado, solo activa nivel 1 en fase test
  - GET: reporta total fuentes, activas, medios huérfanos, distribución por nivel
- Frecuencia por nivel: N1=1h, N2=4h, N3=6h
- Tipo check por categoría: TV/Radio=RSS, Agencias=RSS, otros=HEAD

### T7: Conectar GeneratorScheduler en instrumentation
- `src/instrumentation.ts` ahora inicia GeneratorScheduler después de initJobSystem
- Productos programados: EL_TERMOMETRO(07:00), SALDO_DEL_DIA(19:00), EL_FOCO(09:00), EL_RADAR(08:00), EL_ESPECIALIZADO(10:00)
- getScheduler() como singleton — revisión cada 5 minutos

### T8: Reclaim de jobs huérfanos
- `reclaimOrphanJobs()` en queue.ts — timeout default 10 minutos
- Se ejecuta: (1) al arrancar en instrumentation, (2) cada 60s en health monitor
- Reset a `pendiente` sin incrementar intentos (no falló, se perdió el worker)
- Log detallado de jobs recuperados

### Fix adicional
- product-generator.ts: removidos tipoActor/tipoAccion (no existen en schema Prisma)

### Commits
- c055d0e: feat(T6-T8): fuentes test + scheduler + reclaim huerfanos
- ce8eec3: fix(T1-T5): desbloqueo pipeline + optimizacion conexiones lentas

---

## Tareas pendientes: T9-T10 + Etapa 150

- T9: Polling 30s mínimo + debounce onFocus (DashboardCommandCenter)
- T10: StatusOrbs con onClick → navegación
- Etapa 150: Desacoplar configuración Bolivia (country-agnostic)
