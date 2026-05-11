# DECODEX Bolivia — Worklog

## 2026-05-10 — Integración Z.ai page_reader: 15 fuentes activas, diagnóstico scraper

### Objetivo
Activar Z.ai page_reader en el pipeline de scraping para bypassar limitaciones del contenedor
(TLS, Cloudflare 403, DNS) y habilitar monitoreo masivo de fuentes.

### Acciones realizadas

#### 1. Activación masiva de fuentes
- Las 15 fuentes de FuenteEstado cambiaron a `activo=true` + `tipoCheck='zai'`
- Antes: solo 4 activas (1 con zai, 3 con fetch directo fallando)
- Después: 15 activas, todas usando Z.ai page_reader como estrategia primaria

#### 2. Pruebas masivas de conectividad Z.ai

| Fuente | Z.ai | Error | Diagnóstico |
|--------|------|-------|-------------|
| la-razon.com | ✅ OK (1.2M chars) | — | Funcional |
| boliviaverifica.bo | ✅ OK (179K chars) | — | Funcional |
| elmundo.com.bo | ✅ OK (639K chars) | — | Funcional |
| abi.bo | ✅ OK (144K chars) | — | Funcional |
| lostiempos.com | ✅ OK (cambio detectado) | — | Funcional |
| eju.tv | ✅ OK | — | Funcional (procesado en cola) |
| opinion.com.bo | ✅ OK | — | Funcional (procesado en cola) |
| reduno.tv | ✅ OK | — | Funcional (procesado en cola) |
| unitel.bo | ✅ OK | — | Funcional (procesado en cola) |
| vision360.bo | ✅ OK | — | Funcional (procesado en cola) |
| anf.com.bo | ❌ FAIL | DNS could not be resolved | Dominio caído |
| atb.com.bo | ❌ FAIL | ERR_CERT_COMMON_NAME_INVALID | Certificado SSL roto |
| tvbolivia.tv | ❌ FAIL | DNS could not be resolved | Dominio caído |
| deber.com.bo | ❌ FAIL | DNS could not be resolved | Dominio caído |
| eldiario.net.bo | ❌ FAIL | DNS could not be resolved | Dominio caído |

**Resultado: 10/15 fuentes funcionan con Z.ai. 5 fallan por dominios caídos (no es problema del sistema).**

#### 3. Diagnóstico del pipeline de productos

**CAPTURA — Funcionando:**
- check_fuente: 33 jobs completados, detección de cambios operativa
- scrape_fuente: 8 scrapes completados
- Fuentes con cambios detectados: La Razón (4), Bolivia Verifica (2), ABI (1), El Mundo (1), Los Tiempos (1)

**PRODUCTOS — Sin generar (cuello de botella identificado):**
- 0 reportes generados
- 0 entregas
- 0 boletines
- Solo 1 mención creada (de 8 scrapes)

**CONTENIDO — Muy bajo:**
- Menciones: 1
- Indicadores configurados: 0
- Indicadores valores: 0

**COMERCIAL — Vacío:**
- Clientes: 0, Contratos: 0, Suscriptores: 0

#### 4. Observaciones clave sobre el scraper

El scraper (`scrape-fuente.ts`) descarga HTML correctamente con Z.ai pero casi no crea menciones.
De 8 scrapes exitosos, solo 1 generó una mención (ABI). Las demás devolvieron `totalMencionesCreadas: 0`.

**Causas probables (sin modificar código, solo observación):**
- El parser de HTML puede no estar adaptado a la estructura de cada sitio
- Las fuentes Z.ai devuelven HTML limpio (procesado por Jina reader), no HTML crudo
- El extractor de enlaces/artículos puede no encontrar patrones en el HTML procesado
- Posible doble `recordRequest` en scrape-fuente.ts línea 60 (bug conocido T5)

### Proximas acciones (priorizadas)

1. **REVISAR scrape-fuente.ts** — Entender por qué 7/8 scrapes no crean menciones
   - Verificar qué devuelve el HTML de Z.ai vs lo que espera el parser
   - Corregir doble `recordRequest` (bug T5)
   - Adaptar extractores a HTML limpio de Jina reader

2. **PROBAR extractor manual** — Tomar HTML de La Razón (1.2M chars disponible) y verificar
   que el parser identifica artículos y extrae datos correctamente

3. **VERIFICAR dominios caídos** — Buscar URLs alternativas para las 5 fuentes caídas:
   - ANF: ¿anf.com.bo sigue existiendo? Buscar mirror
   - ATB: Certificado SSL roto → ¿www.atb.com.bo funciona?
   - El Deber: ¿eldeber.com.bo vs deber.com.bo?
   - El Diario: ¿eldiario.net.bo caído?
   - Bolivia TV: ¿tvbolivia.tv caído?

4. **INDICADORES** — Tabla Indicador vacía, no hay capturers activos

5. **JOB SYSTEM** — Worker secuencial se cuelga cuando un Z.ai tarda mucho.
   Considerar timeout por job.

### Commits previos de esta sesión
- 871aede: fix: pipeline scraping end-to-end funcional con Z.ai SDK
- 84ab1c8: feat: integrar Z.ai SDK page_reader como fallback para scraping

### Protocolo de reinicio verificado
```bash
# Verificar: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Si 000 → levantar:
cd /home/z/my-project/connect && (setsid ./node_modules/.bin/next start -p 3000 > /dev/null 2>&1 &)
# IMPORTANTE: usar ./node_modules/.bin/next (npx resuelve versión equivocada)
```

### Notas de entorno
- Los procesos background (`nohup`, `setsid`) NO sobreviven entre llamadas de herramienta
- El worker loop corre dentro del proceso Next.js, requiere servidor vivo para procesar
- Jobs insertados manualmente en SQLite con fechas string NO funcionan con Prisma
  (deben insertarse via Prisma Client para formato DateTime correcto)
- Worker secuencial: si un job se cuelga, toda la cola se bloquea
  (reclaim manual: UPDATE Job SET estado='pendiente' WHERE estado='en_progreso')

---

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

---

## 2026-05-11 — Axis 4C: Widgets Grupo 1 (Alertas, Indicadores, Fuentes, Medios)

### Objetivo
Crear 4 widgets nuevos para el dashboard con sus APIs summary correspondientes.
Integrarlos en DashboardCommandCenter con el sistema 3-tier CollapsibleWidget.

### Acciones realizadas

#### 1. Widget: Alertas Tempranas (NUEVO)
- **Archivo:** `src/components/dashboard/widgets/AlertasWidget.tsx`
- **API:** `src/app/api/dashboard/alertas-summary/route.ts`
- Consulta menciones con tratamiento critico/agresivo
- 3 contadores: criticas, agresivas, total
- Lista ultimas 10 alertas con persona, medio, tratamiento, timestamp
- Status semantico: error si agresivas>5, warn si hay alertas, ok si no
- Estado vacio: "Sin alertas registradas" con status idle

#### 2. Widget: Indicadores (NUEVO)
- **Archivo:** `src/components/dashboard/widgets/IndicadoresWidget.tsx`
- **API:** `src/app/api/dashboard/indicadores-summary/route.ts`
- Consulta Indicador con include valores (ultimos 2 para tendencia)
- Tendencia up/down/stable calculada automaticamente
- Color por categoria: monetario, minero, climatico, economico, hidrocarburos, social
- Delta porcentual cuando hay 2 valores
- Badge "no confiable" si el ultimo valor no es confiable

#### 3. Widget: Fuentes Monitoreadas (NUEVO)
- **Archivo:** `src/components/dashboard/widgets/FuentesWidget.tsx`
- **API:** `src/app/api/dashboard/fuentes-summary/route.ts`
- Usa `determinarCapa()` de source-lifecycle.ts para capa real C0-C4
- Distribucion visual por capa con barra de colores
- Tabla con estado, frecuencia, ultimo check, fallos consecutivos
- Badges de capa (C0-C4) y estado (activa/validando/inactiva/deprecada)
- Status semantico: error si >30% inactivas, warn si hay degradadas

#### 4. Widget: Medios Registrados (NUEVO)
- **Archivo:** `src/components/dashboard/widgets/MediosWidget.tsx`
- **API:** `src/app/api/dashboard/medios-summary/route.ts`
- Consulta medios con include fuenteEstado y count menciones
- Contadores: total, activos, monitoreados
- Distribucion por categoria con badges de color
- Lista medios con tipo, nivel, menciones, departamento, capa de fuente

#### 5. Integracion en DashboardCommandCenter
- 4 widgets lazy-loaded con dynamic import + ChunkErrorBoundary
- 3 nuevos GroupHeaders: "ONION200" (violeta), "Alertas Tempranas" (rojo), "Configuracion" (sky)
- Fuentes + Medios en grid 2 columnas
- Layout: Sistema → Analisis → ONION200 → Alertas Tempranas → Configuracion → Acciones Rapidas

### Commits
- 5ee31b7: axis-4c: 4 nuevos widgets + 4 APIs summary
