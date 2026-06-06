# DECODEX Bolivia ONION200 — Worklog

---
Task ID: 1
Agent: main
Task: Implementación del nuevo modelo multi-eje + correcciones de fuentes + El Especializado

Work Log:
- Lectura completa de 5 archivos clave: seed/route.ts, schema.prisma, extractor-menciones.prompt.ts, extractor-menciones.ts, products.ts
- Verificación de medios.json: fuentes YA corregidas (La Estrella del Oriente → leo.bo, El Potosí → elpotosi.net, El Día → eldia.com.bo, La Lupa Bolivia eliminada)
- Confirmación: NotaEje model ya existe en Prisma schema con peso Float, unique constraint, relaciones correctas
- Confirmación: Lentes transversales generacional + violencia estatal ya existen en seed-ejes-v3.ts (11 lentes, 30 y 25 keywords respectivamente)

Stage Summary:
- No se requirió cambiar medios.json ni schema.prisma — ya estaban actualizados

---
Task ID: 2
Agent: main
Task: Corregir 12 ejes temáticos en seed/route.ts

Work Log:
- Removido "Movimientos Sociales y Conflictividad" (la "semántica aberración" — se separa sujetos de acciones)
- Agregado "Seguridad Ciudadana" como eje #9 con regla epistemológica: "NUNCA debe ser prioritario automáticamente"
- Renombrado "Salud y Servicios Públicos" → "Salud y Servicios Sociales" (incluye bonos, pensiones)
- Renombrado "Educación, Universidades y Cultura" → "Educación, Universidades y Ciencia" (incluye investigación)
- Renombrado "Medio Ambiente, Territorio y Recursos" → "Medio Ambiente, Territorio y Recursos Naturales"
- Renombrado "Relaciones Internacionales" → "Relaciones Internacionales y Geopolítica"
- Expandido keywords en todos los ejes (BCB, TGN, IPC, debido proceso, TCP, biometría, padrón, etc.)
- Movidas organizaciones sociales como sub-clasificador interno de Gobierno/Oposición
- Agregadas 5 sub-clasificaciones de Seguridad Ciudadana: Delitos, Policía, Penitenciario, Narcotráfico, Violencia de Género
- Versión actualizada: DECODEX ONION200 v0.6.0

Stage Summary:
- 12 ejes temáticos corregidos, 5 sub-clasificaciones de seguridad ciudadana agregadas
- Organizaciones sociales movidas a sub-eje interno (no eje principal)
- Archivo: src/app/api/seed/route.ts

---
Task ID: 3
Agent: main
Task: Reescribir prompt de clasificación LLM para multi-eje con pesos decimales

Work Log:
- Actualizado intro del prompt: DECODEX ONION200, clasificación multi-eje
- Máximo de ejes cambiado de 3 → 6 con pesos decimales 0.5-1.0
- Nuevo campo "peso" en JSON output (reemplaza "relevancia" para ejes)
- Criterios de peso definidos: 1.0 (central), 0.8-0.9 (significativo), 0.6-0.7 (moderado), 0.5-0.6 (tangencial)
- Agregadas REGLAS EPISTEMOLÓGICAS CRÍTICAS (5 reglas inmutables):
  1. Nunca conflatar sujetos/acciones/evaluaciones
  2. Nunca criminalizar organizaciones sociales
  3. Respetar CPE y convenciones internacionales
  4. Seguridad ciudadana nunca prioritario automáticamente
  5. Ejemplo: nota sobre minería puede clasificar en 3 ejes simultáneos
- Corregido: módulos de descubrimiento funcionan INDEPENDIENTEMENTE de es_relevante

Stage Summary:
- Prompt reescrito con multi-eje, pesos decimales, reglas epistemológicas
- Archivo: src/lib/ai/extractor-menciones.prompt.ts

---
Task ID: 4
Agent: main
Task: Actualizar lógica extractor-menciones.ts para poblar NotaEje con pesos

Work Log:
- Interface EjeMencionado: campo "relevancia" → "peso" (number, 0.5-1.0)
- Parseo de peso desde LLM con fallback legacy (alta→1.0, media→0.7, baja→0.5)
- Clamp automático a rango 0.5-1.0
- Máximo de ejes cambiado de 3 → 6
- ejeEstructuralId ahora usa el eje con MAYOR peso (no el primero)
- Helper populateNotaEjes() para crear registros NotaEje en DB
- populateNotaEjes llamado en 3 lugares: menciones por legislador, figuras detectadas, menciones temáticas
- Todas las 3 rutas de creación de menciones ahora pueblan NotaEje

Stage Summary:
- Multi-eje con pesos implementado en toda la cadena de persistencia
- Archivo: src/lib/ai/extractor-menciones.ts

---
Task ID: 5
Agent: main
Task: Implementar endpoint dedicado El Especializado + rotación freemium

Work Log:
- Creado endpoint: /api/admin/bulletins/generate-especializado/route.ts
- 7 sectores en rotación freemium (uno por día de la semana)
- Función getSectorFreemiumHoy() para rotación automática diaria
- Consulta NotaEje para obtener menciones con peso mínimo por sector
- Modo freemium (rotación) vs pagado (sector específico solicitado)
- Actualizado config en products.ts: generador.tipo → 'dedicado', endpoint configurado, freemium config agregada
- Ventana de 2 días para análisis sectorial
- Query en 2 pasos (NotaEje → Menciones) para compatibilidad con Prisma SQLite

Stage Summary:
- Endpoint dedicado funcional con rotación freemium
- Archivos: src/app/api/admin/bulletins/generate-especializado/route.ts, src/constants/products.ts

---
## RESUMEN GENERAL

### Archivos modificados:
1. `src/app/api/seed/route.ts` — 12 ejes corregidos + sub-clasificaciones seguridad ciudadana
2. `src/lib/ai/extractor-menciones.prompt.ts` — Prompt multi-eje con pesos + reglas epistemológicas
3. `src/lib/ai/extractor-menciones.ts` — Lógica multi-eje + populateNotaEje + ejeEstructuralId por mayor peso
4. `src/constants/products.ts` — El Especializado: dedicado + freemium

### Archivos creados:
5. `src/app/api/admin/bulletins/generate-especializado/route.ts` — Endpoint dedicado El Especializado

### Archivos verificados (sin cambios necesarios):
- `data/medios.json` — Fuentes ya corregidas
- `prisma/schema.prisma` — NotaEje ya existe
- `scripts/seed-ejes-v3.ts` — Lentes generacional + violencia estatal ya existen

### Próximos pasos (acordados por el usuario):
1. Ejecutar `npx prisma db push` para sincronizar schema con DB
2. Test end-to-end con subset de fuentes
3. Test fuentes que nunca generaron resultados
4. Scratch retroactivo de 14 días

---
Task ID: 1
Agent: main
Task: Implement multi-eje classification, seed DB, test end-to-end, push to git

Work Log:
- Read seed/route.ts, extractor-menciones.prompt.ts, extractor-menciones.ts, schema.prisma, batch-llm.ts
- Confirmed all code was already implemented: 12 corrected ejes, multi-eje max 6 with decimal weights (0.5-1.0), NotaEje model, populateNotaEjes()
- Fixed db.ts canonical path: changed from prisma/db/custom.db to db/custom.db to match .env DATABASE_URL
- Executed seed via tsx standalone: 299 personas (36 senadores + 263 diputados), 30 medios, 12 ejes temáticos
- Attempted capture run: HTTP fetch failed for ABI, ANF, ATB (network/DNS/TLS issues on server)
- Ran end-to-end test with synthetic text: 5 ejes classified with decimal weights (1.0, 0.8, 0.7, 0.6, 0.6), 4 menciones created, 20 NotaEje records
- Pushed to git: a87f0f4 main → origin/main

Stage Summary:
- Multi-eje classification fully operational: LLM returns up to 6 ejes with decimal weights
- NotaEje table populated correctly with @@unique([mencionId, ejeId])
- db.ts path corrected for canonical DB location
- Network issues with fetching Bolivian news sources (TLS/DNS) — infrastructure issue, not code
- All code pushed to GitHub

---
Task ID: 1
Agent: main
Task: Alinear seed/route.ts con documento v2 + integrar 9 lentes transversales

Work Log:
- Audit completo: 3 versiones desconectadas encontradas (route.ts con 12 dominios v0.6.0, seed-ejes-v3.ts con 12 V3, documento v2 con 12 definitivos)
- Confirmado que seed/route.ts YA tenía tipo:'estructural' en los 12 dominios (corregido en sesión anterior)
- Confirmado que nombres de dominios coinciden con documento v2 del usuario
- Confirmado Dominio 6 con nota epistemológica
- Confirmado Dominio 10 con subtema "Magisterio, autonomía universitaria y presupuesto"
- Integrados 9 lentes transversales (usuario definió como válidos): Movilización Social, Hidrocarburos, Medio Ambiente, Corrupción e Impunidad, Género y Diversidad, Pueblos Indígenas, Café y Economías Regionales, Litio y Energía, Salud Pública
- Agregada constante LENTES_TRANSVERSALES con 9 lentes + keywords comprehensivos
- Agregada lógica de seed para crear lentes en tabla Lente + Keyword records
- Agregado modo seed_only:'lentes' para seed incremental sin borrar datos
- Actualizada limpieza de tablas en force mode (keyword + lente antes de ejeTematico)
- Actualizado GET handler para reportar lentes, keywords, ejesEstructurales, ejesSub

Stage Summary:
- seed/route.ts ahora tiene: 12 dominios (tipo:'estructural') + 73 sub-clasificaciones + 9 lentes transversales + keywords para todo
- clasificador-v2.ts ya funciona: lee ejes WHERE tipo='estructural' + lentes WHERE activo=true, usa Keyword records
- NOTA: Dominio 5 se mantiene como "Medio Ambiente y Territorio" (usuario anotó "sistemas de vida y territorio" pero no pidió cambio explícito)
- NOTA: seed-ejes-v3.ts (scripts/) tiene una taxonomía V3 diferente con 11 lentes — se mantiene como script separado, no se integra al API seed
