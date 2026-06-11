-- =============================================================
-- MIGRACIÓN DE CLASIFICACIÓN DE MEDIOS - DECODEX
-- Ejecutar en /root/decodex-app/prisma/db/custom.db
-- =============================================================

-- 1. DEPRECACIÓN DE MEDIOS CERRADOS/INEXISTENTES
-- ================================================
UPDATE Medio SET activo = 0 WHERE nombre IN (
  'Página Siete',
  'La Palabra de Bolivia',
  'Extra'
);

UPDATE FuenteEstado SET estado = 'deprecada', activo = 0
  WHERE medioId IN (SELECT id FROM Medio WHERE nombre IN ('Página Siete', 'La Palabra de Bolivia', 'Extra'));

-- Ahora El Pueblo: posiblemente cerrado, verificar primero
-- Si confirma que no existe, descomentar:
-- UPDATE Medio SET activo = 0 WHERE nombre = 'Ahora El Pueblo';
-- UPDATE FuenteEstado SET estado = 'deprecada', activo = 0 WHERE medioId = (SELECT id FROM Medio WHERE nombre = 'Ahora El Pueblo');


-- 2. ACTUALIZACIÓN DE CLASIFICACIÓN POR MEDIO
-- =============================================

-- PRENSA GENERAL NACIONAL (Corporativa)
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='Los Tiempos';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='El Deber';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='La Razón';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='El Diario';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='Opinión';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='eju.tv';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='El Mundo';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='Visión 360';

-- PRENSA REGIONAL
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='El Potosí';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='La Patria';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre IN ('La Estrella del Oriente', 'La Estrella del Oriente (Leo.bo)');
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='El Periódico';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre IN ('El País (Tarija)', 'El País');
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='La Voz de Tarija';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='El Día';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='Sol de Pando';
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='REGIONAL', categoria='PRENSA_REGIONAL', enfoque='GENERALISTA'
  WHERE nombre='Correo del Sur';

-- TELEVISIÓN
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='NACIONAL', categoria='TELEVISION', enfoque='GENERALISTA'
  WHERE nombre IN ('Unitel', 'Red Uno', 'ATB', 'PAT', 'Bolivisión', 'Gigavision', 'Red UNO');
UPDATE Medio SET naturaleza='ESTATAL', ambito='NACIONAL', categoria='TELEVISION', enfoque='GENERALISTA'
  WHERE nombre='Bolivia TV';

-- AGENCIAS E INSTITUCIONES ESTATALES
UPDATE Medio SET naturaleza='ESTATAL', ambito='NACIONAL', categoria='AGENCIA_ESTATAL', enfoque='GENERALISTA'
  WHERE nombre='ABI';
UPDATE Medio SET naturaleza='ESTATAL', ambito='NACIONAL', categoria='DATOS_INDICADORES', enfoque='DATOS_ESTADISTICOS'
  WHERE nombre='SENASAG';
UPDATE Medio SET naturaleza='ESTATAL', ambito='NACIONAL', categoria='DATOS_INDICADORES', enfoque='DATOS_ESTADISTICOS'
  WHERE nombre='BCB';
UPDATE Medio SET naturaleza='ESTATAL', ambito='NACIONAL', categoria='PRENSA_GENERAL', enfoque='GENERALISTA'
  WHERE nombre='Ahora El Pueblo';

-- INSTITUCIONAL LEGISLATIVO (nuevos - crear si no existen)
INSERT OR IGNORE INTO Medio (id, nombre, url, tipo, categoria, nivel, naturaleza, ambito, enfoque, activo, fechaCreacion, pais)
VALUES ('senado-bo', 'Senado de Bolivia', 'https://senado.bo', 'Institución legislativa', 'INSTITUCIONAL_LEGISLATIVO', '1', 'ESTATAL', 'NACIONAL', 'LEGISLATIVO', 1, datetime('now'), 'Bolivia');

INSERT OR IGNORE INTO Medio (id, nombre, url, tipo, categoria, nivel, naturaleza, ambito, enfoque, activo, fechaCreacion, pais)
VALUES ('camara-diputados-bo', 'Cámara de Diputados', 'https://camara.bo', 'Institución legislativa', 'INSTITUCIONAL_LEGISLATIVO', '1', 'ESTATAL', 'NACIONAL', 'LEGISLATIVO', 1, datetime('now'), 'Bolivia');

-- INSTITUCIONALES RELIGIOSOS (Iglesia Católica)
UPDATE Medio SET naturaleza='RELIGIOSO', ambito='NACIONAL', categoria='AGENCIA_NOTICIAS', enfoque='GENERALISTA'
  WHERE nombre IN ('ANF (Agencia Fides)', 'ANF', 'Agencia Fides');
UPDATE Medio SET naturaleza='RELIGIOSO', ambito='NACIONAL', categoria='COMUNITARIO', enfoque='SOCIAL_COMUNITARIO'
  WHERE nombre='ERBOL';

-- BOLIVIA VERIFICA (ONG verificadora)
UPDATE Medio SET naturaleza='ONG', ambito='NACIONAL', categoria='VERIFICACION_HECHOS', enfoque='VERIFICACION'
  WHERE nombre='Bolivia Verifica';

-- ALTERNATIVOS E INDEPENDIENTES
UPDATE Medio SET naturaleza='PRIVADO_INDEPENDIENTE', ambito='NACIONAL', categoria='ALTERNATIVO', enfoque='POLITICO'
  WHERE nombre IN ('Bolpress', 'Radio Kawsachun Coca', 'Kawsachun Coca');
UPDATE Medio SET naturaleza='PRIVADO_INDEPENDIENTE', ambito='NACIONAL', categoria='COMUNITARIO', enfoque='SOCIAL_COMUNITARIO'
  WHERE nombre='Abya Yala TV';
UPDATE Medio SET naturaleza='PRIVADO_INDEPENDIENTE', ambito='NACIONAL', categoria='ALTERNATIVO', enfoque='SOCIAL_COMUNITARIO'
  WHERE nombre='CEDIB';
UPDATE Medio SET naturaleza='PRIVADO_INDEPENDIENTE', ambito='INTERNACIONAL', categoria='ALTERNATIVO', enfoque='POLITICO'
  WHERE nombre='Resumen Latinoamericano';

-- FUENTES DE DATOS E INDICADORES
UPDATE Medio SET naturaleza='CAMARAL', ambito='NACIONAL', categoria='DATOS_INDICADORES', enfoque='ECONOMICO'
  WHERE nombre='IBCE';
UPDATE Medio SET naturaleza='CAMARAL', ambito='REGIONAL', categoria='DATOS_INDICADORES', enfoque='ECONOMICO'
  WHERE nombre='CAO';

-- MERCADOS Y FINANZAS (Internacionales)
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='INTERNACIONAL', categoria='MERCADOS', enfoque='ECONOMICO'
  WHERE nombre IN ('Reuters Commodities', 'Reuters', 'Investing.com', 'TradingView');

-- SECTOR CAFÉ (Internacionales)
UPDATE Medio SET naturaleza='PRIVADO_CORPORATIVO', ambito='INTERNACIONAL', categoria='CAFETERO', enfoque='CAFETERO'
  WHERE nombre='Perfect Daily Grind';
UPDATE Medio SET naturaleza='PRIVADO_INDEPENDIENTE', ambito='INTERNACIONAL', categoria='CAFETERO', enfoque='CAFETERO'
  WHERE nombre IN ('Sprudge', 'Coffee Review');
UPDATE Medio SET naturaleza='ACADEMICO', ambito='INTERNACIONAL', categoria='CAFETERO', enfoque='CAFETERO'
  WHERE nombre='World Coffee Research';
UPDATE Medio SET naturaleza='ONG', ambito='INTERNACIONAL', categoria='CAFETERO', enfoque='CAFETERO'
  WHERE nombre='SCA';
UPDATE Medio SET naturaleza='CAMARAL', ambito='INTERNACIONAL', categoria='CAFETERO', enfoque='CAFETERO'
  WHERE nombre='OIC Café';


-- 3. VERIFICACIÓN
-- =================
-- SELECT nombre, naturaleza, ambito, categoria, enfoque, activo FROM Medio ORDER BY naturaleza, ambito, categoria;
