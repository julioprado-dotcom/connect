-- ═══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Convertir timestamps numéricos a ISO 8601 strings
-- ═══════════════════════════════════════════════════════════════════════
-- 
-- CAUSA RAÍZ: @prisma/engines@7.x serializaba DateTime como Unix 
-- timestamps (ms) en SQLite en vez de ISO strings (comportamiento 
-- correcto de @prisma/client@6.x con su engine nativo).
--
-- CORRECCIÓN: Remover @prisma/engines@7.x, usar solo @prisma/client@6.19.3
-- que maneja su propio engine con serialización ISO correcta.
--
-- FORMATO: '2026-06-07T08:30:52.000Z' (ISO 8601 con 3 decimales + Z)
--
-- PRECAUCIÓN: Ejecutar SIEMPRE con backup previo de la BD.
-- ═══════════════════════════════════════════════════════════════════════

-- Verificación antes de migrar
SELECT 'PRE-MIGRACION: Conteo de campos numericos por tabla' as info;

SELECT 'Mencion.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM Mencion GROUP BY typeof(fechaCaptura);
SELECT 'Mencion.fechaClasificacion' as campo, typeof(fechaClasificacion) as tipo, COUNT(*) as total FROM Mencion WHERE fechaClasificacion IS NOT NULL GROUP BY typeof(fechaClasificacion);
SELECT 'NotaRaw.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM NotaRaw GROUP BY typeof(fechaCaptura);
SELECT 'NotaRaw.fechaProcesada' as campo, typeof(fechaProcesada) as tipo, COUNT(*) as total FROM NotaRaw WHERE fechaProcesada IS NOT NULL GROUP BY typeof(fechaProcesada);
SELECT 'CapturaLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM CapturaLog GROUP BY typeof(fecha);
SELECT 'Job.fechaCreacion' as campo, typeof(fechaCreacion) as tipo, COUNT(*) as total FROM Job GROUP BY typeof(fechaCreacion);
SELECT 'SystemLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM SystemLog GROUP BY typeof(fecha);
SELECT 'FuenteEstado.ultimoCheck' as campo, typeof(ultimoCheck) as tipo, COUNT(*) as total FROM FuenteEstado WHERE ultimoCheck IS NOT NULL GROUP BY typeof(ultimoCheck);

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Mencion
-- ═══════════════════════════════════════════════════════════════
UPDATE Mencion SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';
UPDATE Mencion SET fechaClasificacion = replace(datetime(fechaClasificacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaClasificacion) = 'integer' AND fechaClasificacion IS NOT NULL;
UPDATE Mencion SET fechaPublicacion = replace(datetime(fechaPublicacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaPublicacion) = 'integer' AND fechaPublicacion IS NOT NULL;
UPDATE Mencion SET fechaVerificacion = replace(datetime(fechaVerificacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaVerificacion) = 'integer' AND fechaVerificacion IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: NotaRaw
-- ═══════════════════════════════════════════════════════════════
UPDATE NotaRaw SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';
UPDATE NotaRaw SET fechaProcesada = replace(datetime(fechaProcesada/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaProcesada) = 'integer' AND fechaProcesada IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: CapturaLog
-- ═══════════════════════════════════════════════════════════════
UPDATE CapturaLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Job
-- ═══════════════════════════════════════════════════════════════
UPDATE Job SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Job SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer' AND fechaInicio IS NOT NULL;
UPDATE Job SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer' AND fechaFin IS NOT NULL;
UPDATE Job SET proximaEjecucion = replace(datetime(proximaEjecucion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(proximaEjecucion) = 'integer' AND proximaEjecucion IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: SystemLog
-- ═══════════════════════════════════════════════════════════════
UPDATE SystemLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: FuenteEstado
-- ═══════════════════════════════════════════════════════════════
UPDATE FuenteEstado SET ultimoCheck = replace(datetime(ultimoCheck/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCheck) = 'integer' AND ultimoCheck IS NOT NULL;
UPDATE FuenteEstado SET ultimoCambio = replace(datetime(ultimoCambio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCambio) = 'integer' AND ultimoCambio IS NOT NULL;
UPDATE FuenteEstado SET ultimoCheckOk = replace(datetime(ultimoCheckOk/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCheckOk) = 'integer' AND ultimoCheckOk IS NOT NULL;
UPDATE FuenteEstado SET ultimoHeadline = replace(datetime(ultimoHeadline/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoHeadline) = 'integer' AND ultimoHeadline IS NOT NULL;
UPDATE FuenteEstado SET ultimoTexto = replace(datetime(ultimoTexto/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoTexto) = 'integer' AND ultimoTexto IS NOT NULL;
UPDATE FuenteEstado SET ultimoMencion = replace(datetime(ultimoMencion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoMencion) = 'integer' AND ultimoMencion IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Reporte
-- ═══════════════════════════════════════════════════════════════
UPDATE Reporte SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Reporte SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer' AND fechaInicio IS NOT NULL;
UPDATE Reporte SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer' AND fechaFin IS NOT NULL;
UPDATE Reporte SET fechaEnvio = replace(datetime(fechaEnvio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEnvio) = 'integer' AND fechaEnvio IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: ReporteSectorial
-- ═══════════════════════════════════════════════════════════════
UPDATE ReporteSectorial SET periodoInicio = replace(datetime(periodoInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(periodoInicio) = 'integer';
UPDATE ReporteSectorial SET periodoFin = replace(datetime(periodoFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(periodoFin) = 'integer';
UPDATE ReporteSectorial SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE ReporteSectorial SET generadoEn = replace(datetime(generadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(generadoEn) = 'integer' AND generadoEn IS NOT NULL;
UPDATE ReporteSectorial SET enviadoEn = replace(datetime(enviadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(enviadoEn) = 'integer' AND enviadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Contrato
-- ═══════════════════════════════════════════════════════════════
UPDATE Contrato SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer';
UPDATE Contrato SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer' AND fechaFin IS NOT NULL;
UPDATE Contrato SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Contrato SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Entrega
-- ═══════════════════════════════════════════════════════════════
UPDATE Entrega SET fechaEnvio = replace(datetime(fechaEnvio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEnvio) = 'integer' AND fechaEnvio IS NOT NULL;
UPDATE Entrega SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: RechazoCaptura
-- ═══════════════════════════════════════════════════════════════
UPDATE RechazoCaptura SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: MencionComentario
-- ═══════════════════════════════════════════════════════════════
UPDATE MencionComentario SET fechaComentario = replace(datetime(fechaComentario/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaComentario) = 'integer' AND fechaComentario IS NOT NULL;
UPDATE MencionComentario SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Medio
-- ═══════════════════════════════════════════════════════════════
UPDATE Medio SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Medio SET fechaComentario = replace(datetime(fechaComentario/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaComentario) = 'integer' AND fechaComentario IS NOT NULL;
UPDATE Medio SET ultimaRevisionHumana = replace(datetime(ultimaRevisionHumana/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimaRevisionHumana) = 'integer' AND ultimaRevisionHumana IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Calificacion
-- ═══════════════════════════════════════════════════════════════
UPDATE Calificacion SET fechaEvaluacion = replace(datetime(fechaEvaluacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEvaluacion) = 'integer';
UPDATE Calificacion SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: IndicadorValor
-- ═══════════════════════════════════════════════════════════════
UPDATE IndicadorValor SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';
UPDATE IndicadorValor SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Cliente
-- ═══════════════════════════════════════════════════════════════
UPDATE Cliente SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Cliente SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Persona
-- ═══════════════════════════════════════════════════════════════
UPDATE Persona SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Persona SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Fallback
-- ═══════════════════════════════════════════════════════════════
UPDATE Fallback SET aplicadaEn = replace(datetime(aplicadaEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(aplicadaEn) = 'integer' AND aplicadaEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: FuenteErrorLog
-- ═══════════════════════════════════════════════════════════════
UPDATE FuenteErrorLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: EnvioReporte
-- ═══════════════════════════════════════════════════════════════
UPDATE EnvioReporte SET fechaEnvio = replace(datetime(fechaEnvio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEnvio) = 'integer' AND fechaEnvio IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Bitacorafuente
-- ═══════════════════════════════════════════════════════════════
UPDATE Bitacorafuente SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Bitacorafuente SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Lente, Keyword
-- ═══════════════════════════════════════════════════════════════
UPDATE Lente SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Lente SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';
UPDATE Keyword SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Keyword SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sugest, SugestAprobacion
-- ═══════════════════════════════════════════════════════════════
UPDATE Sugest SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE Sugest SET editadoEn = replace(datetime(editadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(editadoEn) = 'integer' AND editadoEn IS NOT NULL;
UPDATE SugestAprobacion SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Evento
-- ═══════════════════════════════════════════════════════════════
UPDATE Evento SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE Evento SET editadoEn = replace(datetime(editadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(editadoEn) = 'integer' AND editadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: SuscriptorGratuito
-- ═══════════════════════════════════════════════════════════════
UPDATE SuscriptorGratuito SET fechaSuscripcion = replace(datetime(fechaSuscripcion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaSuscripcion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: User
-- ═══════════════════════════════════════════════════════════════
UPDATE User SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRACIÓN
-- ═══════════════════════════════════════════════════════════════
SELECT '';
SELECT '═══ POST-MIGRACION: Verificacion ═══' as info;
SELECT '';
SELECT 'Mencion.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM Mencion GROUP BY typeof(fechaCaptura);
SELECT 'NotaRaw.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM NotaRaw GROUP BY typeof(fechaCaptura);
SELECT 'CapturaLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM CapturaLog GROUP BY typeof(fecha);
SELECT 'Job.fechaCreacion' as campo, typeof(fechaCreacion) as tipo, COUNT(*) as total FROM Job GROUP BY typeof(fechaCreacion);
SELECT '';
SELECT 'Ejemplo Mencion.fechaCaptura:' as info;
SELECT substr(fechaCaptura, 1, 25) as fechaCaptura FROM Mencion ORDER BY rowid DESC LIMIT 5;
SELECT '';
SELECT 'Ejemplo NotaRaw.fechaCaptura:' as info;
SELECT substr(fechaCaptura, 1, 25) as fechaCaptura FROM NotaRaw ORDER BY rowid DESC LIMIT 5;
SELECT '';
SELECT 'Test: menciones hoy (formato correcto):' as info;
SELECT COUNT(*) as menciones_hoy FROM Mencion WHERE date(fechaCaptura)=date('now');
