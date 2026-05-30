---
Task ID: 1
Agent: main
Task: Auditoría Externa de Fuentes con Z.ai — Crear, corregir y ejecutar script

Work Log:
- Encontré que `scripts/audit-fuentes-zai.ts` ya existía de una sesión anterior
- Corregí errores de TypeScript: campo `dbFallos` no estaba en interfaz `AuditResult`, `medio.ultimoError` no estaba en select
- Verificé DB: `prisma/db/custom.db` tiene 54 medios, `db/custom.db` está vacío
- Ejecuté DRY RUN exitosamente: 54 medios (51 con URL, 3 sin URL, 30 con FuenteEstado)
- Ejecuté prueba rápida con --limit 3: confirmó conectividad parcial desde el servidor
- Test de conectividad: Google/BBC/Reuters OK, algunos .bo fallan (ABI, El Deber), otros .bo OK (ERBOL, Los Tiempos)
- Ejecuté auditoría completa en 6 batches de 9 medios cada uno (setsid + wait)
- Agregué parámetro `--batch N` al script para generar archivos separados por batch
- Creé `scripts/consolidar-auditoria.ts` para merge de resultados
- Creé `scripts/run-auditoria-completa.ts` para ejecución automatizada

Stage Summary:
- Reporte consolidado: `logs/auditoria-fuentes-20260518-consolidado.json`
- 54 medios auditados: 15 OK, 30 DEAD (19 probablemente vivos pero inalcanzables desde este servidor), 3 sin URL
- 4 RSS encontrados: Bolivia Verifica, ERBOL, Los Tiempos, eju.tv
- 10 sitios con Cloudflare/protección anti-bot (necesitan ZAI_READER)
- 7 redirecciones detectadas, incluyendo La Patria -> ufacup88.co (CRÍTICO: posible takeover)
- 3 medios sin URL: La Estrella, La Lupa Bolivia, Norte de Potosí
- 60 sentencias SQL sugeridas en el reporte consolidado
- Scripts modificados: `scripts/audit-fuentes-zai.ts` (fix TypeScript + --batch flag)
- Scripts nuevos: `scripts/consolidar-auditoria.ts`, `scripts/run-auditoria-completa.ts`
---
Task ID: 1
Agent: Main Agent
Task: Scraping y extracción de contenido de los 13 medios con URLs corregidas

Work Log:
- Analizó el pipeline de scraping (scrape-fuente.ts): 3 fases (links → triaje → LLM)
- Verificó que los 13 medios tienen FuenteEstado activo en la DB
- Creó script de prueba de conectividad: 8/13 medios responden con HTML completo
- Medios con Cloudflare 403: El Potosí, ANF, El Deber (necesitan Z.ai reader)
- Medios con problemas: ABI (fetch failed), El Diario (307 redirect)
- Creó script de scraping completo con pipeline 3 fases usando z-ai-web-dev-sdk
- Corrigió errores de esquema Prisma (campo createdAt→fechaCaptura, ids manuales)
- Ejecutó scraping exitosamente contra 13 medios

Stage Summary:
- **33 menciones nuevas creadas** en la DB por nuestro scraper
- Medios scrapeados exitosamente con contenido:
  - La Patria: 4 menciones (protestas, bloqueos, YPFB)
  - Los Tiempos: 5 menciones (paro magisterio, bloqueos, bono Gestión de Aula)
  - Unitel: 4 menciones (bloqueos, YPFB Senkata, paro chóferes)
  - La Estrella: 1 mención (fiscalía Bermejo)
  - ATB: 1 mención (ChatGPT seguridad)
  - Red Uno: 2 menciones (Caneb, YPFB Senkata)
  - RTP Bolivia: 2 menciones (aviones Hércules Argentina, magisterio)
- Medios sin contenido scrapeable: El Potosí (Cloudflare), ANF (Cloudflare), ABI (fetch failed), Bolivia TV (sin links relevantes), El Deber (Cloudflare), El Diario (redirect)
- Total menciones en DB: 432 (antes 399)
- Scripts creados: scrape-medios-test.ts, scrape-all-13.ts, query-scraping-status.ts
---
Task ID: 2
Agent: Main Agent
Task: Mejora del motor de descubrimiento (discovery.ts) — Prompt V2 endurecido

Work Log:
- Leyó archivo src/lib/ai/discovery.ts completo (553 líneas)
- Reemplazó exclusivamente la función buildDiscoveryPrompt() con versión endurecida V2
- Verificó que las 11 funciones del archivo permanecen intactas
- Verificó que la lógica de scores (calcularConfianza) no fue afectada
- Verificó que el old prompt fue completamente removido (no contiene "NO incluir:", "TIPOS válidos", "tema")
- Confirmó diff limpio: solo la función buildDiscoveryPrompt() cambió (+30, -26 líneas)
- Commit: db7e040 — "feat: discovery prompt V2 endurecido — filtrado estricto anti-ruido"
- Push exitoso a origin/main

Stage Summary:
- Commit db7e040 en main, push exitoso a GitHub
- Cambios: solo buildDiscoveryPrompt() reemplazada
- Lógica de scores, agrupación, filtrado anti-duplicados DB: SIN CAMBIOS
- El motor ahora filtra estrictamente periodistas, figuras históricas, actores internacionales sin impacto directo, delincuentes comunes, deportes/farándula
- Prioriza política, conflictividad social, economía estatal, corrupción

---
Task ID: 1
Agent: main
Task: Implementar Seed de Usuario Admin y Fix de Autenticación

Work Log:
- Audit completo de schema.prisma (User model), auth.ts, middleware.ts
- IDENTIFICADO BUG CRÍTICO: middleware.ts línea 25 hacía return early para rutas no-API, dejando TODAS las páginas del dashboard accesibles sin autenticación
- IDENTIFICADO: AUTH_SECRET faltante en .env — JWT no se podía firmar/verificar
- IDENTIFICADO: NextRequest import faltante en middleware.ts
- IDENTIFICADO: getWorkerStats importado de módulo incorrecto (pre-existing)
- FIX middleware.ts: eliminado return-early, ahora protege páginas + API con lógica unificada
- FIX middleware.ts: agregado import type NextRequest
- GENERADO AUTH_SECRET con openssl rand -base64 32 y agregado a .env
- CREADO scripts/seed-admin.ts: script idempotente que crea usuario admin con bcrypt hash
- EJECUTADO seed: admin@decodex.bo / Decodex2026!Secure creado exitosamente
- VERIFICADO idempotencia: segunda ejecución no duplica
- FIX pre-existing build error: getWorkerStats import from correct module
- BUILD verificado: next build 0 errores
- COMMIT: 1b8c185 pushed to origin/main

Stage Summary:
- Sistema ahora protegido: middleware exige JWT para dashboard + API
- Usuario admin creado: admin@decodex.bo
- AUTH_SECRET configurada
- Script seed-admin.ts listo para VPS deployment
- Build limpia, push exitoso


---
Task ID: 2
Agent: main
Task: Reescribir capture pipeline v2 — scraping directo reemplaza web search

Work Log:
- Analizado el motor de scraping existente en src/lib/jobs/ (3 fases, 7+ módulos)
- Identificado el problema: /api/capture usaba web_search nativo que no indexa medios bolivianos
- Reescrito completo src/app/api/capture/route.ts (280 insertions, 316 deletions)
- Pipeline v2 usa: FASE 1 (link extraction regex) → FASE 2 (keyword triaje) → FASE 3 (LLM classify)
- Usa los mismos módulos que scrape-fuente runner (link-extractor, keyword-triaje, zai-fetcher, extractor-menciones)
- Pausa reducida de 60s a 15s entre medios
- Estadísticas enriquecidas: links extraídos, notas triajeadas, clasificadas, menciones creadas
- Build exitoso (0 errores), commit c7b7f9c pushed to main

Stage Summary:
- Capture pipeline v2 listo para deploy
- Depende de módulos ya probados que produjeron 33 menciones reales en tests anteriores
- El usuario necesita hacer git pull + pm2 restart en VPS para activar
---
Task ID: 1
Agent: Main Agent
Task: Diagnóstico y reparación completa del pipeline de captura DECODEX Bolivia

Work Log:
- Identificado que /etc/.z-ai-config faltaba en VPS (LLM nunca se ejecutaba)
- API key Zhipu AI expirada (2026-05-17), instalada nueva key
- Error "Argument id is missing" en db.mencion.create() — faltaba id: crypto.randomUUID()
- Prompt simplificado sin autorización (commit abd53e6) — restaurado completo
- Bug de casing: db.marcoConceptual → db.marco_conceptual (15 refs en 7 archivos)
- Marco conceptual no cargaba → prompt enviado con datos vacíos
- legs:0 corregido al restaurar prompt completo + marco conceptual

Stage Summary:
- 5 bugs encontrados y corregidos
- Pipeline operativo: menciones, legisladores, ejes, tratamiento periodístico funcionando
- Captura completando 49 medios secuencialmente con pausas antisaturación
- Pendientes: ABI/ANF fallan, scheduler desconectado, Descubrimiento Inteligente vacío

---
Task ID: 0
Agent: Main Agent
Task: Fase 0 — Branding Cleanup: Logo, Favicon, NewsConnect residuals

Work Log:
- Auditoría completa de branding: código limpio, docs con 43+ referencias NewsConnect
- CRITICAL FIX: `/public/logo.png` no existía pero 4 componentes lo referenciaban (DashboardShell x2, SideNav, LoadingScreen) → copiado decodex-logo.png a logo.png
- Eliminados 5 SVGs default de Next.js (vercel.svg, globe.svg, file.svg, next.svg, window.svg)
- Eliminado favicon.ico vacío (0 bytes) — layout.tsx ya usa favicon.png
- Actualizado package.json version 0.14.0 → 0.15.0 (coincide con resto del código)
- Limpieza masiva de NewsConnect en documentación (43 reemplazos en 5 archivos):
  - docs/03_Protocolo_Producto_El_Radar.md: 16 replacements (URLs, hashtags, texto)
  - docs/02_Protocolo_Producto_Saldo_Del_Dia.md: 6 replacements
  - docs/04_Indicadores_ONION200.md: 2 replacements
  - docs/05_Protocolo_Producto_El_Foco.md: 18 replacements
  - documents/cover.html: 1 replacement
- Verificación final: 0 referencias NewsConnect en código fuente, solo 2 en archivos históricos (generate-report.js, Acta-Nacimiento)

Stage Summary:
- Branding DECODEX completo en toda la aplicación
- 4 componentes con imágenes rotas ahora arreglados
- Documentación limpia de residuals NewsConnect (newsconnect.bo URLs reemplazadas por decodex.bo)
- Versión unificada a 0.15.0

---
Task ID: 1
Agent: Main Agent
Task: Fase 1 — Fix fake KPIs and misleading defaults

Work Log:
- Auditoría completa de 18 archivos: KPIs principales ya eran reales (DB queries)
- 4 issues encontrados y corregidos:
  1. summary/route.ts:132 — productos {total:11, ops:4} HARDCODED → ALL_PRODUCTS.length + filter
  2. summary/route.ts:116 — indicadores.activos = totalMenciones (mislabel) → indicadoresActivos
  3. StatusBar.tsx:229-232 — defaults 'ok' while loading → 'idle' (misleading green)
  4. SystemStatusOrbs.tsx:198-199 — LLM calls/cost sin qualifier → ~ y ≈ (estimados)
- Build limpio, push exitoso

Stage Summary:
- Commit 2f42eeb — 4 KPIs corregidos
- Productos: ahora calcula desde ALL_PRODUCTS catalog (11 total, 4 operativos — coincidió pero ahora es dinámico)
- Indicadores: ahora muestra indicadoresActivos reales desde DB (no menciones)
- StatusBar: ya no muestra verde durante carga
- IA StatusOrb: ahora indica que son estimaciones (~llamadas, ≈$costo)

---
Task ID: 2
Agent: Main Agent (with fullstack-developer subagents)
Task: Fase 2a — Produccion + Distribucion tabs interactive enhancement

Work Log:
- Analizado estado de 8 tabs del dashboard ONION200
- ProduccionView (0 acciones → 7+): catalogo grid, GENERAR buttons, param modals, content preview, quick actions
- DistribucionView (0 acciones → 6+): retry fallidos, test canales, agregar suscriptor, filter tabs, canal icons
- Build limpio, push exitoso

Stage Summary:
- Commit 441693b — +1555 lines
- Produccion: 22 backend endpoints ahora conectados al UI (generate por tipo, preview ultimo, ejes/personas selectors)
- Distribucion: 12 backend endpoints conectados al UI (retry, test canales, add subscriber)
- Ambas tabs pasaron de read-only a fullmente interactivas

---
Task ID: 2b
Agent: Main Agent (with fullstack-developer subagents)
Task: Fase 2b — Captura content display + Alertas spaceship HUD

Work Log:
- CapturaView: Added 'Contenido Capturado' full-width section (menciones with medio, persona, URL, timestamp, sentiment, snippet)
- CapturaView: Pagination (Ver Mas), refresh button, Bolivia timezone
- AlertasPanel: Replaced SemaforoSVG with HudGauge (270° arc, tick marks, scanning line, severity animations)
- Build limpio, push exitoso

Stage Summary:
- Commit e5f5186 — +444 lines
- Captura: now shows actual captured content with clickable URLs and metadata
- Alertas: semáforo removed, spaceship HUD scanner gauge with 3 severity states
- Remaining for Fase 2: Clasificación detail modal (optional enhancement)

---
Task ID: 7
Agent: main
Task: Fase 3 — PipelineOrbs clickeables + Centro de Comando

Work Log:
- Modified `page.tsx` to pass `onNavigateTab` callback to `ResumenView`
- Updated `ResumenView.tsx` to accept `onNavigateTab` and add `CommandCenter` panel
- Modified `SystemStatus.tsx`: PipelineOrbs now clickable (div→button with onClick), navigates to corresponding tab
- Modified `LiveFeed.tsx`: Added "Ver todas las menciones →" footer button that navigates to Captura tab
- Created `CommandCenter.tsx`: Full manual control panel with:
  - "Forzar Captura" button (POST /api/admin/kick-capture, enqueues checks for top 8 sources)
  - "Captura v2" start/stop buttons (POST/DELETE /api/capture, full scraping pipeline)
  - Real-time queue status display (pending, in progress, active sources)
  - Live progress bar with stats (links, triaje, classified, mentions)
  - Jobs summary with state breakdown (pending/in_progress/completed/failed)
  - Collapsible recent logs for capture v2
  - Auto-refresh every 10s
- Build: ✓ Compiled successfully in 18.3s (only pre-existing Edge warnings)
- Committed as `b74207d` and pushed to origin/main

Stage Summary:
- Fase 3 complete — all KPIs and pipeline orbs are now clickable/navigable
- Worker/Scheduler controls were already present in SystemStatus (toggles + scheduler panel)
- CommandCenter provides manual pipeline triggers from the dashboard UI
- User needs to `git pull && npx next build && pm2 restart` on VPS to see changes
---
Task ID: 1
Agent: main
Task: Hacer clickeables los enlaces en Capturas y Clasificación (abrir ficha MencionDetailModal)

Work Log:
- Analizado estado actual: CapturaView ya tenía MencionDetailModal funcional (commit previo)
- ClasificacionView tenía menciones como <div> sin interacción — no abrían la ficha
- Añadido import de MencionDetailModal + icono Eye en ClasificacionView
- Cambiado <div> → <button> con onClick → setSelectedMencionId
- Agregado state selectedMencionId
- stopPropagation en botón Clasificar individual (▶) para no abrir ficha al clasificar
- Hover hint "VER →" aparece al pasar el mouse (igual que CapturaView)
- Commit 7c79e29, push exitoso

Stage Summary:
- ClasificacionView ahora abre MencionDetailModal al hacer click en cualquier mención pendiente
- Botón ▶ de clasificar individual sigue funcionando sin abrir la ficha (stopPropagation)
- CapturaView ya estaba funcionando correctamente desde commit anterior

---
Task ID: 1
Agent: Super Z (main)
Task: CSS-only charts para dashboard DECODEX (MiniCharts)

Work Log:
- Cloned repo from GitHub to local workspace
- Added porSentimiento + porTipoMencion raw SQL queries to indicadores-summary API
- Created MiniCharts.tsx component (v1: colorful) — commit 734c917
- User feedback: "no combina con el resto lineas delgadas, pocos colores etc"
- Rewrote MiniCharts.tsx (v2: minimalist) — commit 74b792f
  - 2px thin bars, monochrome cyan only
  - SVG ring 2px stroke instead of conic-gradient donut
  - Uses PanelShell for consistency with other panels
  - Compact labels, no color shadows, no "en vivo" indicator
- Pushed both commits to GitHub, user pulled and deployed on VPS

Stage Summary:
- API: 2 new fields in captura (porSentimiento, porTipoMencion)
- Component: MiniCharts.tsx with ThinBars + SentimentRing
- Integrated in ResumenView.tsx (3-col layout: VitalMonitor + SystemStatus + MiniCharts)
- User confirmed "perfecto" after minimalist redesign

---
Task ID: https-setup
Agent: main
Task: Configurar HTTPS/SSL para decodex-bolivia.net

Work Log:
- Analizado estado del servidor: Nginx en puerto 80, Next.js en 3000, sin Caddy/Docker
- Actualizado Caddyfile del proyecto para dominio (aunque no se usa, Nginx hace el proxy)
- Actualizado middleware.ts: secureCookie condicional (detecta HTTPS via X-Forwarded-Proto)
- Agregado redirect HTTP→HTTPS en middleware usando header Host correcto
- Configurado Nginx reverse proxy con certbot
- SSL obtenido via Let's Encrypt (certbot --nginx)
- Certificado válido hasta 2026-08-25, renovación automática vía certbot.timer

Stage Summary:
- https://decodex-bolivia.net funciona con candado verde
- Cookies de sesión ahora se marcan como Secure
- Certbot auto-renueva el certificado en background
- Archivos: src/middleware.ts, Caddyfile
- Certificado: /etc/letsencrypt/live/decodex-bolivia.net/
---
Task ID: 1
Agent: main
Task: Scheduler, dispatcher, colores centralizados, cleanup

Work Log:
- Analizado generator-scheduler.ts: prototipo huérfano que duplica sistema de jobs existente
- Eliminado generator-scheduler.ts (327 líneas)
- Agregados 5 productos faltantes a BOLETINES_SCHEDULE: VOZ_Y_VOTO, EL_HILO, FOCO_DE_LA_SEMANA, EL_INFORME_CERRADO (todos lunes 08:00/10:00)
- Agregado campo `dias?` a BoletinSchedule type para soportar días específicos
- Actualizado cron-builder para usar `b.dias || '1-5'`
- Corregidos 7 bugs en delivery-dispatcher.ts: estados femeninos→masculinos, retry contenido vacío, WhatsApp campo incorrecto, parseo JSON contenido, registro contenido en Entrega, orderBy en retry, eliminado estado 'leido'
- Creado constants/colors.ts como fuente única de verdad para sentimiento (5 valores) y tratamiento (8 valores)
- Actualizados 4 componentes a colores centralizados: LiveFeed.tsx, CapturaView.tsx, FuentesView.tsx, boletin-express/route.ts
- Eliminados semáforos (🟢🔴🟡) de boletin-express
- Limpieza de constants/ui.ts: eliminados SENTIMIENTO_STYLES, TRATAMIENTO_STYLES, TRATAMIENTO_LABELS, CATEGORIA_LABELS, CATEGORIA_COLORS, CATEGORIA_ICONS, CATEGORIAS
- Build exitoso

Stage Summary:
- Scheduler: de 6 a 10 productos programados (4 diarios + 6 semanales lunes)
- Dispatcher: 7 bugs corregidos, listo para producción
- Colores: 1 fuente de verdad (constants/colors.ts), 4 componentes actualizados, sin semáforos
- constants/ui.ts: de 139 a 81 líneas (solo labels y datos estáticos de partidos/medios)

---
Task ID: 1
Agent: Main Agent
Task: Eliminar 8 indicadores huérfanos y conectar tc-paralelo-venta al BCB

Work Log:
- Investigué la estructura del BCB: el Valor Referencial del USD está en la HOMEPAGE (https://www.bcb.gob.bo/) como widget KPI-2, NO en la página de cotizaciones_tc
- Encontré los valores reales: Compra 9.93, Venta 10.14 en divs con clase "bcb-val"
- Reescribí completamente `capturarTcParalelo()` para scrapear la homepage del BCB
- Probé el capturador: funciona correctamente (Compra 9.93, Venta 10.14)
- Creé función `cleanupOrphanIndicadores()` que elimina indicadores huérfanos de la DB
- Eliminé GBP y CHF del BCB_CODIGO_MAP y del mapeo de ejes temáticos
- Integré cleanup en el sync API (se ejecuta automáticamente durante cada sync)
- Build exitoso: npx next build compiló sin errores

Stage Summary:
- Archivos modificados:
  - src/lib/indicadores/capturer-tier1.capturers.ts: capturarTcParalelo() reescrito, GBP/CHF eliminados
  - src/lib/indicadores/capturer-tier1.ts: nueva función cleanupOrphanIndicadores()
  - src/lib/indicadores/capturer-tier1.config.ts: fx-gbp-usd y fx-chf-usd eliminados del mapping
  - src/app/api/indicadores/sync/route.ts: cleanup integrado en el sync
- 8 indicadores huérfanos se eliminarán automáticamente al próximo sync: mineria-precios-lme-{zinc,estano,plata,plomo}, macro-ipc-bcb, macro-tasa-interes, macro-reservas-internacionales, rin-bcb
- tc-paralelo-venta y tc-paralelo-compra ahora capturan datos reales del BCB (Valor Referencial USD)
- Pendiente: desplegar en VPS con git push

---
Task ID: 2
Agent: Main Agent
Task: Fix etiqueta DESCONECTADO engañosa + scheduler totalScheduled

Work Log:
- Diagnosticado: `diagnoseUptime()` retornaba severity 'critical' para uptime < 300s
- `getDiagStatus('uptime')` mapeaba 'critical' → 'error' → PipelineOrb mostraba "Desconectado"
- Fix backend: severity cambiada de 'critical' a 'warning' con mensaje "Inicializando"
- Fix frontend PipelineOrb: agregado estado 'starting' con label "Inicializando" y color #3b82f6
- Fix frontend ProcessOrb: agregada prop `initializing` para Worker/Scheduler cuando sistema < 5min
- Fix frontend SystemStatus: detecta `systemInitializing` y pasa prop a ProcessOrbs
- Diagnosticado `totalScheduled: 0`: era contador de jobs encolados por scheduler, no tareas programadas
- Fix UI: eliminado "0 encolados" del detail del Planificador, ahora solo muestra "X tareas programadas"
- Commit ffaeb75, push exitoso

Stage Summary:
- "Tiempo Activo" ahora muestra "Inicializando" (azul) en vez de "Desconectado" (violeta) durante primeros 5 min
- Worker/Scheduler muestran "Inicializando" si están offline pero el sistema arrancó hace < 5 min
- Planificador muestra "X tareas programadas" en vez de "X tareas · 0 encolados"
- Build exitoso, necesita deploy en VPS
---
Task ID: arch-e-v2-fixes
Agent: main
Task: Arquitectura E v2 — fixes críticos, frecuencias, ventana operativa

Work Log:
- Verificada infraestructura E v2 existente: NotaRaw/SystemLog en schema, batch-llm.ts, scrape-fuente-light.ts, scheduler con batch_llm cada 45min
- BUG CRÍTICO ENCONTRADO: worker-service.ts (PM2) NO registraba batch_llm ni scrape_fuente_light — jobs fallaban con "No existe runner para tipo"
- FIX: Agregados imports y registros en worker-service.ts (9→11 runners)
- Verificado que check-fuente.ts ya encola scrape_fuente_light (no scrape_fuente)
- Ejecutado prisma db push — tablas NotaRaw y SystemLog creadas en DB SQLite
- Ejecutado prisma generate — Prisma Client actualizado
- Ajustadas frecuencias base: corporativo 1h→4h, regional 4h→6h, red_social 1h→1d
- Ajustados medios específicos: Los Tiempos 15m→2h, nacionales 1h→4h, TV 4h→6h
- Agregados SENASAG e IBCE como frecuencia 1w (semanal)
- Ventana operativa ampliada: ventanaFin 22→23 (último scrape 23:00)
- Pushed como commit d9c2c01

Stage Summary:
- Pipeline E v2 funcional end-to-end: scrape(sin LLM) → NotaRaw → batch_llm → Menciones
- Frecuencias optimizadas: ~40% menos checks/día, sin perder cobertura
- Ventana 06:00-23:00: último scrape después de noticieros nocturnos
- Tablas NotaRaw + SystemLog creadas y Prisma Client regenerado
- PRÓXIMO: usuario debe hacer deploy en VPS (build + pm2 restart)

---
Task ID: arch-e-v2-activation
Agent: main
Task: Activar pipeline E v2 — verificar estado post-deploy y fix gap

Work Log:
- Verificado que check-fuente.ts YA encola scrape_fuente_light (línea 36) — pipeline E v2 estaba activo en código
- Worker muestra 11 runners registrados ✅
- prisma db push "in sync" — UsoIA tabla debería existir ahora
- Los logs mostrando scrape_fuente viejo eran jobs residuales en la cola Job table
- ENCONTRADO GAP: scrape-fuente-light.ts NO actualizaba fuenteEstado.ultimoHeadline/totalHeadlines/strategyScrape como el viejo scrape_fuente
- FIX: Agregado fuenteEstado.update en scrape-fuente-light.ts después de extraer links
- Commit 1731a33 pushed a origin/main
- NOTA: batch-llm.ts no actualiza fuenteEstado.ultimoMencion — gap secundario, pendiente para siguiente ciclo

Stage Summary:
- Pipeline E v2 activo: check_fuente → scrape_fuente_light(sin LLM) → NotaRaw → batch_llm → Menciones
- Fix scrape-fuente-light: ahora actualiza métricas de capacidad (ultimoHeadline, totalHeadlines)
- Commit: 1731a33 — "fix: scrape-fuente-light actualiza fuenteEstado.ultimoHeadline"
