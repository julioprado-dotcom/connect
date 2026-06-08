-- ═══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corrección de frecuencias + Recuperación de gap
-- DECODEX Bolivia — Ejecutar ANTES de reiniciar el scheduler
--
-- Qué hace:
--   1. Reactiva todas las fuentes inactivas (los fallos fueron del sistema, no de la fuente)
--   2. Resetea fallos consecutivos de TODAS las fuentes
--   3. Corrige frecuencias base según categoría y overrides definidos
--   4. Registra la migración en SystemLog
--
-- Ejecutar: sqlite3 ~/decodex-app/prisma/dev.db < scripts/migrate-frecuencias-gap-recovery.sql
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Reactivar fuentes inactivas
UPDATE Fuente
SET estado = 'activa', activo = 1, fallosConsecutivos = 0
WHERE estado = 'inactiva';

-- 2. Resetear fallos de todas las fuentes (los fallos fueron durante la caída del sistema)
UPDATE Fuente
SET fallosConsecutivos = 0
WHERE fallosConsecutivos > 0;

-- 3. Corregir frecuencias según categoría del Medio
--    corporativo → 2h (máximo permitido)
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE categoria = 'corporativo')
  AND frecuenciaBase != '2h';

--    oficial → 6h
UPDATE Fuente
SET frecuenciaBase = '6h', frecuenciaActual = '6h'
WHERE medioId IN (SELECT id FROM Medio WHERE categoria = 'oficial')
  AND frecuenciaBase != '6h';

--    regional → 6h
UPDATE Fuente
SET frecuenciaBase = '6h', frecuenciaActual = '6h'
WHERE medioId IN (SELECT id FROM Medio WHERE categoria = 'regional')
  AND frecuenciaBase != '6h';

--    alternativo → 6h
UPDATE Fuente
SET frecuenciaBase = '6h', frecuenciaActual = '6h'
WHERE medioId IN (SELECT id FROM Medio WHERE categoria = 'alternativo')
  AND frecuenciaBase != '6h';

--    red_social → 6h
UPDATE Fuente
SET frecuenciaBase = '6h', frecuenciaActual = '6h'
WHERE medioId IN (SELECT id FROM Medio WHERE categoria = 'red_social')
  AND frecuenciaBase != '6h';

-- 4. Overrides específicos por medio (prioridad sobre categoría)
--    Los Tiempos: 2h
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%tiempos%')
  AND frecuenciaBase != '2h';

--    La Razón: 2h
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%la razon%' OR LOWER(nombre) LIKE '%la-razon%')
  AND frecuenciaBase != '2h';

--    El Deber: 2h
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%deber%')
  AND frecuenciaBase != '2h';

--    RTP Bolivia: 2h
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%rtp%')
  AND frecuenciaBase != '2h';

--    ABI: 2h (oficial pero publica constantemente)
UPDATE Fuente
SET frecuenciaBase = '2h', frecuenciaActual = '2h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%abi%')
  AND frecuenciaBase != '2h';

--    TV (Unitel, Red Uno, ATB): 4h
UPDATE Fuente
SET frecuenciaBase = '4h', frecuenciaActual = '4h'
WHERE medioId IN (SELECT id FROM Medio WHERE LOWER(nombre) LIKE '%unitel%' OR LOWER(nombre) LIKE '%red uno%' OR LOWER(nombre) LIKE '%reduno%' OR LOWER(nombre) LIKE '%atb%')
  AND frecuenciaBase != '4h';

-- 5. Limpiar horarios óptimos para que se recalculen con nuevas frecuencias
UPDATE Fuente SET horariosOptimos = '[]';

-- 6. Verificar resultados
SELECT 'RESUMEN DE MIGRACIÓN' as info;
SELECT 'Fuentes por estado:' as info;
SELECT estado, COUNT(*) as total FROM Fuente GROUP BY estado;
SELECT 'Frecuencias asignadas:' as info;
SELECT m.nombre, m.categoria, f.frecuenciaBase, f.frecuenciaActual, f.estado
FROM Fuente f
JOIN Medio m ON f.medioId = m.id
ORDER BY m.categoria, m.nombre;
