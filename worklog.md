---
Task ID: 1
Agent: Main Agent
Task: Correccion Anti-Alucinacion en Generadores de Productos DECODEX Bolivia ONION200 v0.16.0

Work Log:
- Paso 0: Diagnostico completo de 5 generadores LLM, verificacion de DB (399 menciones en prisma/db/custom.db), identificacion de prompts debiles y temperaturas altas
- Paso 1: Modificado src/constants/products.ts con 7 reglas anti-alucinacion obligatorias inyectadas al INICIO de cada system prompt (12 productos). Temperaturas corregidas: RESTRINGIDO=0.0, MODERADO=0.1, ABIERTO=0.2
- Paso 2: Creado src/lib/verification/verify-product.ts con sistema de verificacion post-generacion (personajes sensibles, datos no verificados, contenido en ingles)
- Paso 3: Integrado verifyProduct() en 5 generadores: termometro, saldo, radar, foco, generic
- Paso 4: Creado script de prueba (scripts/test-termometro-regen.ts). DB verificada con 399 menciones y todos los eventos clave. LLM rate-limited (429) - regeneracion pendiente
- Paso 5: Reporte final creado en download/REPORTE-URGENTE-ANTI-ALUCINACION.md

Stage Summary:
- 6 commits: 9e731f8 -> 819b36d
- 7 reglas anti-alucinacion implementadas en 12 productos
- Verificacion post-generacion integrada en 5 endpoints
- Temperaturas maximo 0.2 (antes hasta 0.6)
- DB verificada: 399 menciones con todos los eventos clave
- Regeneracion de El Termometro pendiente (API LLM 429)
---
Task ID: 2
Agent: Main Agent
Task: Implementar control de flujo en el worker (rate limiting, max concurrent, backpressure)

Work Log:
- Analizado el sistema completo: worker.ts, queue.ts, constants.ts, check-fuente.ts, anti-ban/rate-domain.ts
- Identificados los puntos críticos de saturación:
  1. /api/capture no usa la cola de jobs, hace HTTP+LLM sincrónicos
  2. check_fuente auto-encola scrape_fuente sin límite
  3. Scheduler puede encolar 33+ check_fuente al iniciar
  4. Sin monitoreo de event loop lag

Cambios implementados:
- constants.ts: Agregadas constantes WORKER_CONFIG.maxEventLoopLagMs, QUEUE_LIMITS.maxHeavyPending/maxBatchEnqueue, CHECK_FIRST_CONFIG.maxConcurrentChecks, FLOW_CONTROL (event loop, concurrencia, cooldown, memoria)
- worker.ts: Agregado measureEventLoopLag(), heavyJobPressure(), checks de event loop lag (>500ms → pausa 10s), heap crítico (>450MB → pausa 30s), presión de heavy jobs (>3 scrape pendientes → espera)
- queue.ts: Agregado checkHeavyPressure() en enqueue() para rechazar scrape_fuente cuando hay 3+ pendientes, isCaptureOnCooldown/markCaptureEnqueue para cooldown global
- /api/capture/route.ts: Agregado rate limiting con cooldown de 30s entre capturas (HTTP 429)
- /api/jobs/route.ts: Agregados checks de flow control en POST: max 3 check_fuente pendientes, max 3 scrape_fuente pendientes (HTTP 429)

Stage Summary:
- Build exitoso sin errores
- Worker ahora tiene 3 capas de protección: event loop lag, heap memory, heavy job pressure
- Endpoints de captura y jobs tienen rate limiting con HTTP 429
- No más saturación del event loop posible por jobs masivos

---
Task ID: 1-recover-menciones
Agent: Main
Task: Investigar documentación, recuperar menciones borradas, regenerar productos

Work Log:
- Leído CONTEXTO.md, ESTANDAR_PRODUCTOS.md, 04_Indicadores_ONION200.md
- Leídos protocolos de producto: Saldo del Día, El Radar, El Foco
- Verificado estado DB: 247 menciones restantes, todas con fechaPublicacion = null
- Confirmado que 152 menciones fueron borradas incorrectamente (medios bolivianos + café)
- El código ya tenía fallback para fechaPublicacion IS NULL → usa fechaCaptura
- Recuperadas 152 menciones del backup snapshot-2026-05-13_23-noche
- Recuperadas 657 relaciones MencionTema + 466 MencionLente
- Total final: 399 menciones, 1355 MencionTema, 852 MencionLente
- Reconstruido servidor con npx next build + next start
- Generados 6 productos ONION200 todos con menciones reales:
  - EL_TERMOMETRO: 356 menciones
  - SALDO_DEL_DIA: 356 menciones
  - EL_FOCO: 356 menciones
  - EL_ESPECIALIZADO: 356 menciones
  - EL_RADAR: 18 menciones (ventana semanal)
  - BOLETIN_DEL_GRANO: 18 menciones (ventana semanal, café)

Stage Summary:
- Datos recuperados completamente desde backup
- Todos los productos ONION200 generados exitosamente con menciones reales
- Criterio verificado: el sistema monitorea medios bolivianos E internacionales (incluido café)
- Documentación revisada: CONTEXTO.md, ESTANDAR_PRODUCTOS.md, protocolos de producto
---
Task ID: 1
Agent: Main Agent (Ingeniero Backend DECODEX)
Task: Eliminar indicadores macroequivocados y construir indicadores reales del pipeline (Captura, Clasificación, Producción, Distribución)

Work Log:
- Explorado sistema completo: API routes, componentes dashboard, Prisma schema
- Identificado que 12 Indicadores/IndicadorValor macroeconómicos tenían 0 valores → datos equivocados
- Descubierto que modelo `Producto` no existe en Prisma — productos son `Reporte`
- Descubierto que Prisma v6 no soporta `distinct` en `count()` ni `esDegradado` en `FuenteEstado`
- Descubierto que `$queryRaw` devuelve BigInt para COUNT() — requiere conversión a Number
- Corregido bug preexistente en clasificacion/route.ts (paréntesis extra)
- Reescrito `/api/dashboard/indicadores-summary` — ahora consulta tablas reales del pipeline
- Reescrito `IndicadoresWidget.tsx` — 4 tarjetas: Captura, Clasificación, Producción, Distribución
- Reescrito `IndicadoresView.tsx` — vista completa con tabs por etapa y KPIs detallados
- Actualizado `/api/dashboard/summary` — indicadores ahora reflejan menciones reales

Stage Summary:
- API `/api/dashboard/indicadores-summary` devuelve datos reales: 399 menciones, 58 medios, 33 fuentes, 38 productos, 9 lentes, 44 ejes
- Widget muestra 4 etapas con status badges, KPIs, barras de progreso
- Vista completa permite explorar cada etapa con detalle
- Captura: 399 menciones, 58 medios, 33 fuentes activas, 29 con fallos
- Clasificación: 99% con eje, 89% con lente, 100% con sentimiento
- Producción: 38 reportes (6 tipos), 0 enviados, 38 pendientes
- Distribución: 0 envíos, 0 suscriptores — requiere configuración
- Servidor corriendo en puerto 3000, ambas APIs responden correctamente
