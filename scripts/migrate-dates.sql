-- ═══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Convertir timestamps numéricos a ISO 8601 strings
-- DECODEX Bolivia — v0.16.0
-- ═══════════════════════════════════════════════════════════════════════
--
-- CAUSA RAÍZ: @prisma/engines@7.x serializaba DateTime como Unix
-- timestamps (ms) en SQLite en vez de ISO strings (comportamiento
-- correcto de @prisma/client@6.x con su engine nativo).
--
-- CORRECCIÓN: overrides en package.json fuerza @prisma/engines@6.19.3
-- + código explícito new Date() en puntos de creación.
--
-- FORMATO ESPERADO: '2026-06-07T08:30:52.000Z' (ISO 8601)
--
-- PRECAUCIÓN: Ejecutar SIEMPRE con backup previo de la BD.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── VERIFICACIÓN PRE-MIGRACIÓN ──────────────────────────────────
SELECT '═══ PRE-MIGRACION ═══' as info;
SELECT 'Mencion.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM Mencion GROUP BY typeof(fechaCaptura);
SELECT 'NotaRaw.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM NotaRaw GROUP BY typeof(fechaCaptura);
SELECT 'NotaRaw.fechaProcesada' as campo, typeof(fechaProcesada) as tipo, COUNT(*) as total FROM NotaRaw WHERE fechaProcesada IS NOT NULL GROUP BY typeof(fechaProcesada);
SELECT 'CapturaLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM CapturaLog GROUP BY typeof(fecha);
SELECT 'Job.fechaCreacion' as campo, typeof(fechaCreacion) as tipo, COUNT(*) as total FROM Job GROUP BY typeof(fechaCreacion);
SELECT 'SystemLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM SystemLog GROUP BY typeof(fecha);
SELECT 'FuenteEstado.ultimoCheck' as campo, typeof(ultimoCheck) as tipo, COUNT(*) as total FROM FuenteEstado WHERE ultimoCheck IS NOT NULL GROUP BY typeof(ultimoCheck);

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Mencion (6 campos DateTime)
-- ═══════════════════════════════════════════════════════════════
UPDATE Mencion SET fechaPublicacion = replace(datetime(fechaPublicacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaPublicacion) = 'integer' AND fechaPublicacion IS NOT NULL;
UPDATE Mencion SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';
UPDATE Mencion SET fechaClasificacion = replace(datetime(fechaClasificacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaClasificacion) = 'integer' AND fechaClasificacion IS NOT NULL;
UPDATE Mencion SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Mencion SET fechaVerificacion = replace(datetime(fechaVerificacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaVerificacion) = 'integer' AND fechaVerificacion IS NOT NULL;
UPDATE Mencion SET evidenciaTimestamp = replace(datetime(evidenciaTimestamp/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(evidenciaTimestamp) = 'integer' AND evidenciaTimestamp IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: NotaRaw (2 campos DateTime)
-- ═══════════════════════════════════════════════════════════════
UPDATE NotaRaw SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';
UPDATE NotaRaw SET fechaProcesada = replace(datetime(fechaProcesada/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaProcesada) = 'integer' AND fechaProcesada IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: CapturaLog (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE CapturaLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Job (4 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Job SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Job SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer' AND fechaInicio IS NOT NULL;
UPDATE Job SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer' AND fechaFin IS NOT NULL;
UPDATE Job SET proximaEjecucion = replace(datetime(proximaEjecucion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(proximaEjecucion) = 'integer' AND proximaEjecucion IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: SystemLog (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE SystemLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: FuenteEstado (6 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE FuenteEstado SET ultimoCheck = replace(datetime(ultimoCheck/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCheck) = 'integer' AND ultimoCheck IS NOT NULL;
UPDATE FuenteEstado SET ultimoCambio = replace(datetime(ultimoCambio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCambio) = 'integer' AND ultimoCambio IS NOT NULL;
UPDATE FuenteEstado SET ultimoCheckOk = replace(datetime(ultimoCheckOk/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoCheckOk) = 'integer' AND ultimoCheckOk IS NOT NULL;
UPDATE FuenteEstado SET ultimoHeadline = replace(datetime(ultimoHeadline/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoHeadline) = 'integer' AND ultimoHeadline IS NOT NULL;
UPDATE FuenteEstado SET ultimoTexto = replace(datetime(ultimoTexto/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoTexto) = 'integer' AND ultimoTexto IS NOT NULL;
UPDATE FuenteEstado SET ultimoMencion = replace(datetime(ultimoMencion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimoMencion) = 'integer' AND ultimoMencion IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Reporte (4 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Reporte SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer';
UPDATE Reporte SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer';
UPDATE Reporte SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Reporte SET fechaEnvio = replace(datetime(fechaEnvio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEnvio) = 'integer' AND fechaEnvio IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: ReporteSectorial (4 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE ReporteSectorial SET periodoInicio = replace(datetime(periodoInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(periodoInicio) = 'integer';
UPDATE ReporteSectorial SET periodoFin = replace(datetime(periodoFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(periodoFin) = 'integer';
UPDATE ReporteSectorial SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE ReporteSectorial SET generadoEn = replace(datetime(generadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(generadoEn) = 'integer' AND generadoEn IS NOT NULL;
UPDATE ReporteSectorial SET enviadoEn = replace(datetime(enviadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(enviadoEn) = 'integer' AND enviadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Contrato (4 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Contrato SET fechaInicio = replace(datetime(fechaInicio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaInicio) = 'integer';
UPDATE Contrato SET fechaFin = replace(datetime(fechaFin/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaFin) = 'integer' AND fechaFin IS NOT NULL;
UPDATE Contrato SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Contrato SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Entrega (3 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Entrega SET fechaProgramada = replace(datetime(fechaProgramada/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaProgramada) = 'integer' AND fechaProgramada IS NOT NULL;
UPDATE Entrega SET fechaEnvio = replace(datetime(fechaEnvio/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEnvio) = 'integer' AND fechaEnvio IS NOT NULL;
UPDATE Entrega SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: EnvioReporte (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE EnvioReporte SET enviadoEn = replace(datetime(enviadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(enviadoEn) = 'integer' AND enviadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Comentario (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Comentario SET fechaComentario = replace(datetime(fechaComentario/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaComentario) = 'integer' AND fechaComentario IS NOT NULL;
UPDATE Comentario SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Medio (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Medio SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Medio SET ultimaRevisionHumana = replace(datetime(ultimaRevisionHumana/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(ultimaRevisionHumana) = 'integer' AND ultimaRevisionHumana IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: IndicadorEvaluacion (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE IndicadorEvaluacion SET fechaEvaluacion = replace(datetime(fechaEvaluacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaEvaluacion) = 'integer';
UPDATE IndicadorEvaluacion SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: IndicadorValor (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE IndicadorValor SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';
UPDATE IndicadorValor SET fechaCaptura = replace(datetime(fechaCaptura/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCaptura) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Indicador (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Indicador SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Indicador SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Cliente (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Cliente SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Cliente SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Persona (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Persona SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';
UPDATE Persona SET fechaActualizacion = replace(datetime(fechaActualizacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: RechazoCaptura (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE RechazoCaptura SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: FuenteErrorLog (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE FuenteErrorLog SET fecha = replace(datetime(fecha/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fecha) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: UsoIA (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE UsoIA SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: AdminFeedback (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE AdminFeedback SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE AdminFeedback SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: AprendizajeSistema (3 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE AprendizajeSistema SET aplicadaEn = replace(datetime(aplicadaEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(aplicadaEn) = 'integer' AND aplicadaEn IS NOT NULL;
UPDATE AprendizajeSistema SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE AprendizajeSistema SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: SugerenciaInteligencia (3 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE SugerenciaInteligencia SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE SugerenciaInteligencia SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';
UPDATE SugerenciaInteligencia SET procesadaEn = replace(datetime(procesadaEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(procesadaEn) = 'integer' AND procesadaEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Lente (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Lente SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Lente SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Keyword (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE Keyword SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Keyword SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: MencionLente (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE MencionLente SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: NotaEje (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE NotaEje SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: eje_tematico_cliente (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE eje_tematico_cliente SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE eje_tematico_cliente SET editadoEn = replace(datetime(editadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(editadoEn) = 'integer' AND editadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: marco_conceptual (2 campos)
-- ═══════════════════════════════════════════════════════════════
UPDATE marco_conceptual SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';
UPDATE marco_conceptual SET editadoEn = replace(datetime(editadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(editadoEn) = 'integer' AND editadoEn IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: cambio_marco_conceptual (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE cambio_marco_conceptual SET creadoEn = replace(datetime(creadoEn/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(creadoEn) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: SuscriptorGratuito (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE SuscriptorGratuito SET fechaSuscripcion = replace(datetime(fechaSuscripcion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaSuscripcion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: User (1 campo)
-- ═══════════════════════════════════════════════════════════════
UPDATE User SET fechaCreacion = replace(datetime(fechaCreacion/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(fechaCreacion) = 'integer';

-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Session, Account (passthrough — low risk)
-- ═══════════════════════════════════════════════════════════════
UPDATE Session SET expires = replace(datetime(expires/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(expires) = 'integer';
UPDATE Account SET createdAt = replace(datetime(createdAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(createdAt) = 'integer';
UPDATE Account SET updatedAt = replace(datetime(updatedAt/1000, 'unixepoch'), ' ', 'T') || '.000Z' WHERE typeof(updatedAt) = 'integer';

-- ─── VERIFICACIÓN POST-MIGRACIÓN ────────────────────────────────
SELECT '';
SELECT '═══ POST-MIGRACION: Verificacion ═══' as info;
SELECT '';
SELECT 'Mencion.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM Mencion GROUP BY typeof(fechaCaptura);
SELECT 'NotaRaw.fechaCaptura' as campo, typeof(fechaCaptura) as tipo, COUNT(*) as total FROM NotaRaw GROUP BY typeof(fechaCaptura);
SELECT 'CapturaLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM CapturaLog GROUP BY typeof(fecha);
SELECT 'Job.fechaCreacion' as campo, typeof(fechaCreacion) as tipo, COUNT(*) as total FROM Job GROUP BY typeof(fechaCreacion);
SELECT 'SystemLog.fecha' as campo, typeof(fecha) as tipo, COUNT(*) as total FROM SystemLog GROUP BY typeof(fecha);
SELECT 'FuenteEstado.ultimoCheck' as campo, typeof(ultimoCheck) as tipo, COUNT(*) as total FROM FuenteEstado WHERE ultimoCheck IS NOT NULL GROUP BY typeof(ultimoCheck);
SELECT '';
SELECT 'Ejemplo Mencion.fechaCaptura:' as info;
SELECT substr(fechaCaptura, 1, 25) as fechaCaptura FROM Mencion ORDER BY rowid DESC LIMIT 5;
SELECT '';
SELECT 'Ejemplo NotaRaw.fechaCaptura:' as info;
SELECT substr(fechaCaptura, 1, 25) as fechaCaptura FROM NotaRaw ORDER BY rowid DESC LIMIT 5;
SELECT '';
SELECT 'Test: menciones hoy (formato ISO):' as info;
SELECT COUNT(*) as menciones_hoy FROM Mencion WHERE date(fechaCaptura)=date('now');
