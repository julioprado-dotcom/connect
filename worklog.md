---
Task ID: 1
Agent: Super Z (main)
Task: Analizar duplicados, implementar dedup en origen, arreglar texto original, crear panel de Control de Calidad

Work Log:
- Analizada BD (vacía - migración limpia, sin datos para analizar duplicados)
- Explorado código completo de dedup: extractor-menciones.ts (4 capas), deduplicacion.ts (LLM cross-medio), batch-llm.ts
- Identificado que Mencion.textoCompleto guardaba LLM resumen (~200 chars), no texto original
- Identificado que Capa 0 de dedup (NotaRaw pendiente) no existía
- Identificado que Capa 1 solo verificaba mismo medioId+url, no cross-medio
- Identificado que batch-llm no filtraba duplicados antes de enviar al LLM

Cambios implementados:

1. **extractor-menciones.ts** - `crearMencionesExtraidas()`:
   - NUEVA Capa 0: Verifica NotaRaw pendiente con misma URL antes de procesar
   - Capa 1 mejorada: Ahora busca URL en CUALQUIER medio (cross-medio), no solo mismo medioId
   - Enriquecimiento: Si duplicado encontrado tiene texto corto (<500 chars) y nuevo trae texto largo, actualiza textoCompleto
   - textoCompleto ahora prioriza textoOriginal > resultado.resumen > leg.contexto (antes era textoOriginal || leg.contexto)
   - Path 2 (referencia_tematica) ahora incluye deduplicacionLog

2. **batch-llm.ts** - Runner principal:
   - Filtro de dedup ANTES de enviar al LLM: compara URLs de NotaRaw pendientes contra menciones existentes
   - Elimina duplicados entre pendientes (misma URL, mantiene la de mayor puntaje)
   - Marca NotaRaw duplicadas como procesadas+descartadas con fecha
   - Log en SystemLog incluye estadísticas de dedup

3. **APIs de Control de Calidad** (nuevas):
   - `/api/dashboard/quality/duplicates` (GET/POST/DELETE) - Detectar, marcar, eliminar duplicados
   - `/api/dashboard/quality/merge` (POST) - Fusionar grupo manteniendo mejor clasificado
   - `/api/dashboard/quality/reclassify` (POST) - Re-clasificar mención con IA
   - `/api/dashboard/quality/stats` (GET) - Métricas de calidad del sistema

4. **Panel UI de Control de Calidad** (nuevo):
   - Componente `CalidadView.tsx` con 3 tabs: Resumen, Dup. por URL, Dup. por Título
   - Stats de calidad: % clasificadas, con eje, con tratamiento, con texto original
   - Lista de grupos duplicados expandible con score de calidad por mención
   - Acciones: Fusionar (transferir datos al mejor), Eliminar, Re-clasificar con IA
   - Log de acciones en tiempo real
   - Info panel: 5 capas de dedup explicadas

5. **Dashboard principal** (modificado):
   - Nueva pestaña "CALIDAD" con icono ShieldCheck
   - Añadida a perfiles analista y admin

Stage Summary:
- Dedup en origen: 5 capas de protección (NotaRaw pendiente, URL cross-medio, persona+URL, cross-medio LLM, batch filter)
- Texto original: ahora se preserva en textoCompleto desde NotaRaw.texto
- Panel de calidad: UI completa para auditoría, fusión y eliminación de duplicados
- Todos los archivos nuevos compilan sin errores TypeScript
- Archivos del core (extractor-menciones.ts, batch-llm.ts) solo tienen errores pre-existentes
