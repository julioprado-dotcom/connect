---
Task ID: 1
Agent: main
Task: Diagnosticar y corregir 3 bugs críticos del pipeline DECODEX

Work Log:
- Analicé batch-llm.ts, keyword-triaje.ts, extractor-menciones.prompt.ts, extractor-menciones.ts, clasificador-v2.ts
- Identifiqué 3 bugs críticos que explican los problemas reportados por el usuario
- Fix 1: batch-llm.ts - reescrito sistema de procesamiento con reintentos, sin descarte en error transitorio
- Fix 2: keyword-triaje.ts - nuevo filtro de contenido irrelevante (deportes, espectáculo, entretenimiento)
- Fix 3: extractor-menciones.prompt.ts - exclusiones de contenido SIEMPRE activas en criterios de relevancia
- Build exitoso, push a GitHub completado

Stage Summary:
- BUG 1 (pendientes acumulándose): batch-llm descartaba notas permanentemente al primer error 429/timeout sin reintentar. Fix: 3 reintentos con 10s, errores transitorios persistentes se dejan para próximo ciclo
- BUG 2 (jalando fútbol): keyword-triaje no tenía filtro anti-deportes. Fix: nuevo filtro que verifica señal deportiva + ausencia de contexto político
- BUG 3 (solo clasifica actores): prompt LLM no excluía deportes de es_relevante. Fix: exclusiones SIEMPRE activas en criterios de relevancia
- IMPORTANTE: Se necesita `pm2 restart decodex-worker` en VPS para que los fixes tomen efecto en el worker

---
Task ID: 2
Agent: main
Task: Verificar scraping por fuente - crear endpoint + vista de estado de capturas

Work Log:
- Leí modelo Prisma: Medio + FuenteEstado (rastrea ultimoCheck, ultimoHeadline, ultimoMencion, contadores) + NotaRaw
- Leí runners check-fuente.ts, scrape-fuente-light.ts, scheduler.ts para entender flujo completo
- Descubrí que FuentesView usaba /api/medios (sin datos de FuenteEstado) — datos de scraping nunca se mostraban en UI
- Creé endpoint /api/dashboard/fuentes/scraping-status con datos completos por fuente
- Creé componente CapturasStatusView con tabla filtrable + filas expandibles con detalle completo
- Integré CapturasStatusView dentro de FuentesView
- Build exitoso, push a GitHub completado (commit fa27b06)
- Consulté backup DB (2026-05-09) para diagnosticar estado real

Stage Summary:
- DIAGNÓSTICO CRÍTICO: De 34 medios activos, solo 5 fueron alguna vez chequeados. 29 NUNCA scrapeados.
- Los Tiempos (fuente P0) NUNCA fue chequeado (0 checks)
- De los 5 chequeados, NINGUNO detectó cambios de contenido (0 cambios totales)
- Resultado: 0 Menciones creadas, pipeline completamente no funcional
- Errores: La Razón y El Deber bloqueados por Cloudflare WAF, 3 fuentes con DNS errors
- Creados: scraping-status/route.ts, CapturasStatusView.tsx, FuentesView.tsx modificado
- PENDIENTE DEPLOY: Código pusheado pero requiere `git pull && pm2 restart` en VPS
- No hay acceso SSH desde este entorno — el usuario debe ejecutar el deploy manualmente

---
Task ID: 3
Agent: main
Task: Diagnosticar cadena de dependencias rota (todo en 0) + crear scripts de fix

Work Log:
- Analicé usuario diagnóstico: ESTADOS groupBy vacío, feActivo 0/0, Menciones=0, Reportes=0
- Leí schema.prisma: modelo Producto no existe, el correcto es Reporte + ReporteSectorial
- Leí scheduler-service.ts: solo programa fuentes con estado='activa' (línea 91)
- Leí source-lifecycle.ts: una fuente solo se promueve a 'activa' tras check exitoso via registrarResultadoCheck()
- Leí queue.ts: enqueue() sí crea registros en tabla Job
- Leí mantenimiento.ts: purge_notas_raw elimina >48h, pero no explica pérdida de menciones
- Identificada cadena rota: Sin FuenteEstado activas → scheduler no programa → worker idle → 0 scraping → 0 menciones → 0 reportes
- Creé scripts/diagnostico-completo.js: analiza 10 tablas, da diagnóstico con soluciones
- Creé scripts/fix-pipeline.js: crea FE faltantes, activa todas, limpia jobs, encola check_fuente+batch_llm, soporta --dry-run
- Push a GitHub (commit ca9cc04)

Stage Summary:
- RAÍZ DEL PROBLEMA: Scheduler filtra `estado: 'activa'` pero FuenteEstado puede estar vacía/null/creada
- SINCAD: No hay fuente activa → 0 check_fuente → 0 scrape → 0 NotasRaw → 0 menciones → 0 boletines
- Scripts creados para diagnóstico y reparación completa del pipeline
- El usuario necesita ejecutar en VPS: git pull → node scripts/diagnostico-completo.js → node scripts/fix-pipeline.js → pm2 restart decodex-scheduler decodex-worker
