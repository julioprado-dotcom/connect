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
