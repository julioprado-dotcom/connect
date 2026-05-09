# DECODEX Bolivia — Worklog

## 2026-05-09 — Sistema de Backup y Archivo (Anti-Purge)

### Problema resuelto
- 50 jobs se perdieron por `deleteMany` sin backup previo
- `purgeCompleted()` y `purgeFailed()` eliminaban permanentemente
- `purge_menciones` limpiaba texto sin archivo
- Mantenimiento nocturno (04:00 AM) ejecutaba purges sin salvaguarda

### Implementación

#### 1. src/lib/backup.ts — Lógica core (nuevo)
- `createSnapshot()`: copia completa del archivo SQLite antes de purge
- `archiveBeforePurge()`: export JSON de Job, Mencion, CapturaLog, IndicadorValor, FuenteEstado
- `rotateSnapshots()`: conserva 7 diarios + 4 semanales, elimina el resto
- `rotateArchives()`: elimina JSON archives > 90 días
- `listBackups()`: listar snapshots + archives con tamaño y fecha
- `restoreFromSnapshot()`: restaurar DB desde snapshot (con pre-restore backup)
- `getBackupSummary()`: resumen del estado del sistema de backup
- Timezone: America/La_Paz (UTC-4) en timestamps

#### 2. src/lib/jobs/runners/mantenimiento.ts — Pre-flight backup
- Antes de cualquier tarea destructiva (limpiar_jobs, purge_menciones, limpiar_logs):
  1. Crear snapshot de la DB completa
  2. Exportar a JSON las tablas que van a ser afectadas
- Si el snapshot falla → EL PURGE SE CANCELA (no se elimina nada)
- Reporte de registros archivados incluido en resultados del mantenimiento

#### 3. /api/backup — Endpoint de administración (nuevo)
- GET: listar backups disponibles + resumen del sistema
- POST: crear backup manual (snapshot / archive / full)
- PATCH: restaurar DB desde snapshot (con pre-restore automático)

#### 4. Actualizaciones de tipos y seguridad
- types.ts: TareaMantenimiento +backup_snapshot, +backup_archive
- proxy.ts: /api/backup como público (GET/POST/PATCH)

### Commits
- ae69aad: feat(backup): sistema de backup y archivo — anti-purge

---

## 2026-05-08 — Etapa 150: T6-T10 implementados

### T1-T5: Desbloqueo pipeline + optimización (sesión anterior)
- ce8eec3: fix(T1-T5)

### T6: Activar fuentes (fase test) + EL_ESPECIALIZADO
- `EL_ESPECIALIZADO` en products.ts: `activo: false` → `activo: true`
- Creado `src/app/api/seed-fuentes/route.ts` (POST + GET)
- Frecuencia por nivel: N1=1h, N2=4h, N3=6h

### T7: Conectar GeneratorScheduler en instrumentation
- `src/instrumentation.ts` inicia GeneratorScheduler + initJobSystem
- 5 productos programados + mantenimiento nocturno 04:00 AM

### T8: Reclaim de jobs huérfanos
- `reclaimOrphanJobs()` en queue.ts — timeout 10 min
- Se ejecuta al arrancar + cada 60s en health monitor

### T9: Polling inteligente con debounce onFocus
- `usePolling()` hook — pausa intervals cuando tab pierde foco
- Intervalos: mínimo 30s (MC=60s), zero peticiones en background

### T10: StatusOrbs navegables
- onClick → navegación a sección relevante del dashboard
- Accesibilidad: role=button, tabIndex, onKeyDown

### Commits
- 8993bb5: feat(T9-T10): polling inteligente + StatusOrbs navegables
- c055d0e: feat(T6-T8): fuentes test + scheduler + reclaim huerfanos
- ce8eec3: fix(T1-T5): desbloqueo pipeline + optimizacion conexiones lentas

---

## Tareas pendientes

- Dashboard "Jobs Recientes" (muestra 0 jobs)
- Estabilidad de fuentes (Radio Sangabriel, La Razón/El Deber)
- UI de trigger manual desde dashboard
- Migración PostgreSQL para producción
- Autenticación funcional (PostMessage API)
- Desacoplar configuración Bolivia (country-agnostic)
