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
