---
Task ID: 1
Agent: Backend Agent
Task: FASE 1 - Prisma Schema + Validations + Fallback + API Endpoints

Work Log:
- Added 6 new fields to Medio model in prisma/schema.prisma (naturaleza, ambito, enfoque, credibilidad, ultimaRevisionHumana, ultimoError)
- Updated medioCreateSchema with new classification fields + URL refine validation
- Updated medioUpdateSchema with categoria, naturaleza, ambito, enfoque, credibilidad, frecuenciaOverride + URL refine
- Replaced silent skip in capture/route.ts with domain extraction fallback from medio.url
- Updated POST /api/medios to handle new classification fields
- Updated PUT /api/medios/[id] to sync URL changes to FuenteEstado and auto-set ultimaRevisionHumana
- Created POST /api/medios/[id]/probe (5-step live diagnostic: DNS, HTTP, RSS, sync)
- Created POST /api/medios/batch-fix (auto-create FuenteEstado, reactivate, classify .gob.bo)
- Created POST /api/medios/[id]/ai-analyze (ZAI LLM classification suggestion)
- Ran prisma generate + prisma db push successfully

Stage Summary:
- 4 files modified, 3 new API routes created
- Database schema updated with 6 new columns
- Capture route no longer silently skips medios without mapped domain

---
Task ID: 3
Agent: Frontend Agent
Task: FASE 2 - Create FuentesView.tsx component

Work Log:
- Created /home/z/my-project/src/components/onion200/FuentesView.tsx (~580 lines)
- Fleet status table with Nombre, Naturaleza badge, Estado Tecnico, Ultima Revision, Credibilidad
- Filter buttons: Todos, Solo con errores, Solo inactivos
- Inline probe diagnostic with terminal-style log output
- Inline edit panel with dropdowns for naturaleza/ambito/enfoque and credibilidad slider
- GUARDAR button (PUT), ANALIZAR IA button (AI suggestion), MARCAR REVISADO
- AUTOCORREGIR FALLOS batch action
- All text in Spanish, no traffic light metaphors
- Matches ONION200 dark sci-fi theme

Stage Summary:
- New component: src/components/onion200/FuentesView.tsx
- Integrated into dashboard as FUENTES tab
- Build passed, committed as 91343da, pushed to main
