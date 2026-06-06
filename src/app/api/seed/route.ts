import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIndicadores } from '@/lib/indicadores/capturer-tier1';
import { guardedParse, RATE, guardError } from '@/lib/rate-guard';
import { seedSchema } from '@/lib/validations';

// ─── Guard: API Key para operaciones destructivas ─────────────────
// En producción, definir SEED_API_KEY en .env
// GET (lectura) siempre es público; POST con force=true requiere API key
const SEED_KEY = process.env.SEED_API_KEY;

function isSeedProtected(): boolean {
  // Siempre protegido: sin key = bloqueado (seguridad por defecto)
  // Usar SEED_API_KEY=dev para modo desarrollo sin protección
  return SEED_KEY !== 'dev';
}

function validateSeedKey(request: Request): boolean {
  if (!SEED_KEY || SEED_KEY === 'dev') return true; // modo dev explícito
  const authHeader = request.headers.get('authorization');
  const queryKey = new URL(request.url).searchParams.get('key');
  return authHeader === `Bearer ${SEED_KEY}` || queryKey === SEED_KEY;
}

// 12 Dominios Estructurales — DECODEX ONION200 v2
// Cada dominio = eje raíz con tipo:'estructural'. Hijos (subtemas) se crean por separado.
// Regla: separar sujetos de acciones, nunca criminalizar la acción colectiva.

// 9 Lentes Transversales — DECODEX ONION200 v2
// Cada lente es una perspectiva analítica que cruza dominios.
// Se almacenan en tabla Lente con Keywords vinculadas via Keyword.lenteId.
const LENTES_TRANSVERSALES = [
  { nombre: 'Movilización Social', slug: 'movilizacion-social', descripcion: 'Bloqueos, marchas, huelgas, paros, cabildos, tomas, picketes y toda forma de acción colectiva de presión social. REGLA: determinar el MOTIVO de la movilización para asignar eje temático correcto.', keywords: ['bloqueo', 'marcha', 'huelga', 'paro', 'cabildo', 'toma', 'pickete', 'movilización', 'movilizacion', 'protesta', 'paro nacional', 'paro departamental', 'paro municipal', 'paro de transporte', 'medidas de presión', 'medida de presión', 'conflicto social', 'choque', 'enfrentamiento', 'vía', 'carrera', 'carretera', 'trancas', 'puntos de bloqueo', 'punto de bloqueo', 'corte de ruta', 'almohadazo', 'piquete', 'vigilia', 'huelga de hambre', 'manifestación', 'manifestacion', 'concentración', 'concentracion', 'multitudinaria', 'derechos humanos', 'represión', 'represion', 'desalojo', 'gases lacrimógenos', 'antimotín', 'gendarmería', 'policía', 'policia', 'detención', 'detencion', 'libertad', 'reivindicación', 'reivindicacion'] },
  { nombre: 'Hidrocarburos', slug: 'hidrocarburos', descripcion: 'Perspectiva transversal de la cadena hidrocarburífera: producción, refinación, importación, comercialización, precios, subsidios, YPFB, contratos internacionales.', keywords: ['hidrocarburos', 'hidrocarburo', 'petróleo', 'petroleo', 'gasolina', 'diésel', 'diesel', 'glp', 'gas natural', 'combustible', 'combustibles', 'ypfb', 'yacimientos', 'refinería', 'refineria', 'gualberto villarroel', 'palmasola', 'subsidio', 'subsidio a combustibles', 'desabastecimiento', 'abastecimiento', 'escasez', 'colas', 'fila', 'precio paralelo', 'sobreprecio', 'contrabando de combustibles', 'electropaz', 'elfec', 'cre', 'enda', 'generación eléctrica', 'generacion electrica', 'apagón', 'racionamiento', 'tarifa eléctrica', 'importación de combustibles', 'importacion de combustibles', 'anh', 'anm'] },
  { nombre: 'Medio Ambiente', slug: 'medio-ambiente', descripcion: 'Perspectiva ambiental que cruza todos los dominios: deforestación, contaminación, cambio climático, biodiversidad, áreas protegidas, sistemas de vida.', keywords: ['medio ambiente', 'deforestación', 'deforestacion', 'incendios forestales', 'biodiversidad', 'parque nacional', 'madidi', 'contaminación', 'contaminacion', 'cambio climático', 'cambio climatico', 'sequía', 'sequia', 'pilcomayo', 'residuos', 'sostenibilidad', 'desarrollo sostenible', 'pachamama', 'glaciar', 'deshielo', 'agua', 'rio', 'río', 'lago titicaca', 'lago poopó', 'emisiones', 'huella de carbono', 'efecto invernadero', 'chiquitanía', 'amazonía', 'amazonia', 'conservación', 'conservacion'] },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', descripcion: 'Perspectiva transversal de corrupción: casos, lavado de dinero, nepotismo, soborno, coima, tráfico de influencias, impunidad, extinción de dominio.', keywords: ['corrupción', 'corrupcion', 'peculado', 'soborno', 'coima', 'cohecho', 'enriquecimiento ilícito', 'enriquecimiento ilicito', 'nepotismo', 'tráfico de influencias', 'trafico de influencias', 'impunidad', 'lavado de dinero', 'extinción de dominio', 'extincion de dominio', 'incautación', 'incautacion', 'desvío de fondos', 'desvio de fondos', 'desvío de recursos', 'fraude', 'estafa', 'malversación', 'malversacion', 'sobreprecio', 'irregularidad', 'denuncia de corrupción', 'anticorrupción', 'asfi', 'felcc', 'caso', 'investigación', 'investigacion'] },
  { nombre: 'Género y Diversidad', slug: 'genero-diversidad', descripcion: 'Perspectiva de género y diversidad que cruza todos los dominios: feminicidio, violencia de género, brecha salarial, LGBTIQ+, participación política de mujeres.', keywords: ['género', 'genero', 'feminicidio', 'violencia de género', 'violencia contra la mujer', 'acoso sexual', 'machismo', 'misoginia', 'brecha salarial', 'techo de cristal', 'ley 348', 'lgbtiq+', 'diversidad sexual', 'igualdad de género', 'igualdad de genero', 'mujer', 'mujeres', 'participación femenina', 'participacion femenina', 'cuota de género', 'aborto', 'derechos reproductivos', 'violencia intrafamiliar', 'violencia digital', 'ciberacoso', 'discriminación', 'discriminacion'] },
  { nombre: 'Pueblos Indígenas', slug: 'pueblos-indigenas', descripcion: 'Perspectiva de pueblos indígenas y originarios: derechos colectivos, tierras comunitarias, autonomías indígenas, consulta previa, naciones originarias.', keywords: ['indígena', 'indigena', 'originario', 'tco', 'tierra comunitaria', 'autonomía indígena', 'autonomia indigena', 'consulta previa', 'consentimiento libre', 'charagua iyambae', 'pueblo originario', 'nación originaria', 'nacion originaria', 'qulla', 'aymara', 'guaraní', 'guarani', 'chiquitano', 'mojeño', 'trinitario', 'usos y costumbres', 'democracia comunitaria', 'justicia indígena', 'territorio indígena', 'derechos colectivos', 'cosmovisión', 'cosmovision', 'pachamama', 'buen vivir', 'vivir bien', 'suma qamaña'] },
  { nombre: 'Café y Economías Regionales', slug: 'cafe-economias-regionales', descripcion: 'Perspectiva de economías regionales y productos específicos: café, coca, quinua, soya, ganadería, producción agroindustrial, comercio regional, cadenas productivas.', keywords: ['café', 'cafe', 'cacao', 'coca', 'quinua', 'quinoa', 'soya', 'ganadería', 'ganaderia', 'agroindustria', 'economía regional', 'economia regional', 'cadena productiva', 'comercio regional', 'exportación agropecuaria', 'exportacion agropecuaria', 'producción agrícola', 'produccion agricola', 'comercio justo', 'feria agropecuaria', 'yungas', 'caranavi', 'chapare', 'beniano', 'productor', 'agricultor', 'cooperativa agrícola', 'cooperativa agricola', 'certificación', 'certificacion', 'comercialización'] },
  { nombre: 'Litio y Energía', slug: 'litio-energia', descripcion: 'Perspectiva transversal de litio y energías alternativas: YLB, salares, DLE, baterías, vehículos eléctricos, energía solar, eólica, hidrógeno verde, transición energética.', keywords: ['litio', 'ylb', 'salar de uyuni', 'salar de coipasa', 'dle', 'extracción directa de litio', 'evaporación', 'evaporacion', 'carbonato de litio', 'hidróxido de litio', 'batería', 'bateria', 'vehículo eléctrico', 'vehiculo electrico', 'energía solar', 'energia solar', 'parque solar', 'energía eólica', 'energia eolica', 'hidrógeno verde', 'hidrogeno verde', 'transición energética', 'transicion energetica', 'energía renovable', 'energia renovable', 'tierras raras', 'neodimio', 'allkem', 'livent', 'bcm', 'berkeley', 'pilas de combustible'] },
  { nombre: 'Salud Pública', slug: 'salud-publica', descripcion: 'Perspectiva de salud pública que cruza dominios: servicios de salud, pandemias, vacunación, medicamentos, sistema de salud, MINSAL, cobertura, determinantes sociales de salud.', keywords: ['salud', 'hospital', 'medicamentos', 'mins', 'mins al', 'médicos', 'medicos', 'enfermeros', 'enfermeras', 'sistema de salud', 'vacunación', 'vacunacion', 'pandemia', 'covid', 'ebola', 'dengue', 'malaria', 'tuberculosis', 'cobertura de salud', 'seguro de salud', 'mi salud', 'salud pública', 'salud publica', 'emergencia sanitaria', 'colapso hospitalario', 'deficit de médicos', 'falta de medicinas', 'centro de salud', 'posta sanitaria', 'desnutrición', 'desnutricion', 'salud mental', 'epidemia'] },
];
const EJES_TEMATICOS = [
  // ─── Dominio 1: Hidrocarburos y Energía ───────────────────
  { nombre: 'Hidrocarburos y Energía', slug: 'hidrocarburos-energia', icono: '⛽', color: '#f59e0b', orden: 1, tipo: 'estructural', keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos,GNL,GLP,Gualberto Villarroel,Guaracachi,ENDE,megavatios,abastecimiento,desabastecimiento,colas,racionamiento,importación,combustible,adulterada,tarifa,geotermia,solar,eólica,hidroeléctrica,consumo eléctrico,apagón,generación térmica,generación hidroeléctrica,electropaz,elfec,cre,enda,energía renovable,energias alternativas,parque solar,parque eólico', descripcion: 'Gas domiciliario (GNL/GLP), gasolina adulterada, diesel y combustibles líquidos, abastecimiento y desabastecimiento, importación y comercio exterior, demanda y consumo, exportación de gas natural, energías alternativas' },
  // ─── Dominio 2: Economía, Modelo de Desarrollo y Empleo ────
  { nombre: 'Economía, Modelo de Desarrollo y Empleo', slug: 'economia-modelo-desarrollo', icono: '💰', color: '#10b981', orden: 2, tipo: 'estructural', keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo,BCB,déficit fiscal,TGN,IPC,desempleo,informalidad,salario,inversión,industrialización,extractivismo,economía plural,comercio exterior,balanza comercial,IDH,impuestos,tributación,recaudación,fiscal,monetaria,cambiaria,canasta familiar', descripcion: 'Política macroeconómica, ingresos fiscales y recaudación, comercio exterior, inversión y desarrollo productivo, empleo y mercado laboral, modelo económico' },
  // ─── Dominio 3: Salud y Determinantes Sociales ─────────────
  { nombre: 'Salud y Determinantes Sociales', slug: 'salud-determinantes-sociales', icono: '🏥', color: '#ec4899', orden: 3, tipo: 'estructural', keywords: 'salud,hospital,medicamentos,MINSAL,Mi Salud,COVID,médicos,enfermeros,sistema de salud,agua potable,alcantarillado,saneamiento,desnutrición,alimentación,desayuno escolar,vivienda,inundación,condiciones de vida,Seguro de salud,cobertura universal,Bono Juancito Pinto,Bono Juana Azurduy,Renta Dignidad,Bono Universal,servicios sociales,pensión', descripcion: 'Servicios de salud, agua y saneamiento, alimentación y nutrición, condiciones de vida, acceso y cobertura' },
  // ─── Dominio 4: Minería y Metales Estratégicos ─────────────
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria-metales-estrategicos', icono: '⛏️', color: '#a16207', orden: 4, tipo: 'estructural', keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estaño,zinc,plata,plomo,oro,YLB,salar,carbonato de litio,DLE,metales críticos,antimonio,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM,LME,derrumbe,seguridad minera,FENCOMIN,cooperativista,tierras raras,neodimio,baterías,vehículo eléctrico', descripcion: 'Minería estatal (COMIBOL), minería cooperativista, litio y tierras raras, estaño/zinc/plata/oro, condiciones laborales mineras' },
  // ─── Dominio 5: Medio Ambiente y Territorio ───────────────
  { nombre: 'Medio Ambiente y Territorio', slug: 'medio-ambiente-territorio', icono: '🌍', color: '#22c55e', orden: 5, tipo: 'estructural', keywords: 'medio ambiente,deforestación,incendios forestales,biodiversidad,parque nacional,Madidi,contaminación,aire,agua,suelo,residuos,cambio climático,sequía,Pilcomayo,plomo,INTI,saneamiento de tierras,gestión territorial,ordenamiento territorial,tenencia de tierra,Chiquitanía,Amazonía,Pachamama,glaciar,deshielo', descripcion: 'Deforestación e incendios, biodiversidad y áreas protegidas, contaminación, cambio climático, gestión territorial' },
  // ─── Dominio 6: Participación y Acción Colectiva ────────────
  { nombre: 'Participación y Acción Colectiva', slug: 'participacion-accion-colectiva', icono: '✊', color: '#ef4444', orden: 6, tipo: 'estructural', keywords: 'bloqueo,marcha,huelga,paro,cabildo,toma,pickete,movilización,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,sindicato,CAO,CAInco,cámara sectorial,FENCOMIN,cooperativista minero,comité cívico,junta vecinal,mesa de diálogo,acuerdo,reivindicación,derechos sociales,demanda social,transportistas', descripcion: 'Movilización y medidas de presión, derechos y demandas sociales, organizaciones sociales, organizaciones empresariales, comités cívicos y juntas vecinales, diálogo y negociación. REGLA: separar sujetos de acciones, nunca criminalizar la acción colectiva.' },
  // ─── Dominio 7: Gestión Pública e Institucional ─────────────
  { nombre: 'Gestión Pública e Institucional', slug: 'gestion-publica-institucional', icono: '🏛️', color: '#3b82f6', orden: 7, tipo: 'estructural', keywords: 'presidente,ministro,decreto,resolución,gabinete,Asamblea,diputado,senador,ley,proyecto de ley,comisión,votación,gobernador,Asamblea Departamental,alcalde,Concejo Municipal,Contraloría,Fiscalía,Tribunal Supremo,carretera,aeropuerto,infraestructura,servicios públicos,gestión ejecutiva,gestión legislativa,gestión departamental,gestión municipal', descripcion: 'Gestión del Ejecutivo, gestión legislativa, gestión departamental, gestión municipal, instituciones de control, servicios públicos e infraestructura' },
  // ─── Dominio 8: Organización Política y Procesos Electorales
  { nombre: 'Organización Política y Procesos Electorales', slug: 'organizacion-politica-electoral', icono: '🗳️', color: '#8b5cf6', orden: 8, tipo: 'estructural', keywords: 'elección,TSE,OEP,partido,agrupación ciudadana,alianza,primaria,campaña,resultado,escrutinio,biometría,padrón,usos y costumbres,democracia comunitaria,control social,veeduría,auditoría social,referendo,financiamiento de campañas,organización política,Tribunal Supremo Electoral,electoral,candidato', descripcion: 'Partidos y agrupaciones ciudadanas, procesos electorales, democracia comunitaria, participación y control social, sistema de partidos' },
  // ─── Dominio 9: Justicia, Derechos Humanos e Impunidad ─────
  { nombre: 'Justicia, Derechos Humanos e Impunidad', slug: 'justicia-derechos-humanos-impunidad', icono: '⚖️', color: '#6366f1', orden: 9, tipo: 'estructural', keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,Tribunal Supremo,TCP,defensor del pueblo,debido proceso,prisión preventiva,corrupción,lavado de dinero,enriquecimiento ilícito,soborno,coima,desvío,delito,seguridad ciudadana,policía,FELCC,narcotráfico,cárcel,Palmasola,hacinamiento,penitenciario,CIDH,violación de derechos,denuncia,feminicidio', descripcion: 'Acceso a justicia, derechos humanos, corrupción e impunidad, seguridad ciudadana, sistema penitenciario' },
  // ─── Dominio 10: Educación, Cultura e Identidad ────────────
  { nombre: 'Educación, Cultura e Identidad', slug: 'educacion-cultura-identidad', icono: '📚', color: '#06b6d4', orden: 10, tipo: 'estructural', keywords: 'educación,universidad,magisterio,UPE,CEB,presupuesto educativo,escuela,colegio,instituto técnico,formación profesional,patrimonio cultural,Carnaval de Oruro,intangible,idioma,lengua originaria,diversidad lingüística,deporte,recreación,autonomía universitaria,Consejo Universitario,reforma educativa,cultura,identidad', descripcion: 'Educación formal, educación técnica y tecnología, magisterio y autonomía universitaria, cultura y patrimonio, idiomas y diversidad lingüística, deporte y recreación' },
  // ─── Dominio 11: Geopolítica, Relaciones Internacionales ─────
  { nombre: 'Geopolítica, Relaciones Internacionales y Soberanía', slug: 'geopolitica-relaciones-internacionales', icono: '🌎', color: '#0ea5e9', orden: 11, tipo: 'estructural', keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea,mar territorial,CIJ,OEA,caso La Paz,UNASUR,MERCOSUR,CAN,ALBA,soberanía,demanda marítima,mediterraneidad,política exterior,ONU,canciller,posicionamiento internacional', descripcion: 'Relaciones bilaterales, integración regional, soberanía y demanda marítima, política exterior, migración y fronteras' },
  // ─── Dominio 12: Territorio, Población y Derechos Colectivos
  { nombre: 'Territorio, Población y Derechos Colectivos', slug: 'territorio-poblacion-derechos-colectivos', icono: '🏔️', color: '#84cc16', orden: 12, tipo: 'estructural', keywords: 'indígena,originario,TCO,tierra comunitaria,autonomía indígena,consulta previa,consentimiento libre,Charagua Iyambae,censo,población,demografía,INE,Qullas,Aymara,Guaraníe,nación originaria,Chiquitanía,género,LGBTIQ+,feminicidio,violencia de género,derechos colectivos,pueblos originarios', descripcion: 'Pueblos indígenas y originarios, derechos colectivos, población y demografía, género y diversidad, pueblos y naciones originarias' },
];

// Sub-clasificaciones (subtemas) — hijos con parentId, NO tipo:'estructural'
const SUBCLASIFICACIONES = [
  // ─── Dominio 1: Hidrocarburos y Energía (8 subtemas) ───────
  { parentId: 'hidrocarburos-energia', nombre: 'Gas domiciliario (GNL/GLP)', slug: 'hc-gas-domiciliario', icono: '🔥', color: '#f59e0b', orden: 1, descripcion: 'Gas domiciliario (GNL/GLP)', keywords: 'gas natural,GNL,GLP,bombonas,tarifa,subsidio cruzado,distribución' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gasolina adulterada', slug: 'hc-gasolina-adulterada', icono: '⛽', color: '#f59e0b', orden: 2, descripcion: 'Gasolina adulterada', keywords: 'gasolina adulterada,mezcla,controles calidad,decomisan,adulteración' },
  { parentId: 'hidrocarburos-energia', nombre: 'Diesel y combustibles líquidos', slug: 'hc-diesel-combustibles', icono: '🛢️', color: '#f59e0b', orden: 3, descripcion: 'Diesel y combustibles líquidos', keywords: 'diésel,diesel,combustibles líquidos,importación,precios internos,distribución' },
  { parentId: 'hidrocarburos-energia', nombre: 'Abastecimiento y desabastecimiento', slug: 'hc-abastecimiento', icono: '📦', color: '#f59e0b', orden: 4, descripcion: 'Abastecimiento y desabastecimiento', keywords: 'abastecimiento,desabastecimiento,colas,racionamiento,logística' },
  { parentId: 'hidrocarburos-energia', nombre: 'Importación y comercio exterior', slug: 'hc-importacion-comercio', icono: '🚢', color: '#f59e0b', orden: 5, descripcion: 'Importación y comercio exterior', keywords: 'importación,precios internacionales,contratos compra,exportación' },
  { parentId: 'hidrocarburos-energia', nombre: 'Demanda y consumo', slug: 'hc-demanda-consumo', icono: '📊', color: '#f59e0b', orden: 6, descripcion: 'Demanda y consumo', keywords: 'demanda,consumo,estacionalidad,parque automotor,eficiencia,vehículos' },
  { parentId: 'hidrocarburos-energia', nombre: 'Exportación de gas natural', slug: 'hc-exportacion-gas', icono: '🌍', color: '#f59e0b', orden: 7, descripcion: 'Exportación de gas natural', keywords: 'exportación,gas natural,Brasil,Argentina,Petrobras,contratos' },
  { parentId: 'hidrocarburos-energia', nombre: 'Energías alternativas', slug: 'hc-energias-alternativas', icono: '⚡', color: '#10b981', orden: 8, descripcion: 'Energías alternativas', keywords: 'geotermia,solar,eólica,hidroeléctrica,planta,renovable,megavatios' },

  // ─── Dominio 2: Economía (6 subtemas) ──────────────────────
  { parentId: 'economia-modelo-desarrollo', nombre: 'Política macroeconómica', slug: 'eco-politica-macro', icono: '📉', color: '#10b981', orden: 1, descripcion: 'Política macroeconómica', keywords: 'política fiscal,política monetaria,política cambiaria,BCB,ajuste' },
  { parentId: 'economia-modelo-desarrollo', nombre: 'Ingresos fiscales y recaudación', slug: 'eco-ingresos-fiscales', icono: '💵', color: '#10b981', orden: 2, descripcion: 'Ingresos fiscales y recaudación', keywords: 'IDH,impuestos,tributación,recaudación,Aduana,IVA,IT,IEHD' },
  { parentId: 'economia-modelo-desarrollo', nombre: 'Comercio exterior', slug: 'eco-comercio-exterior', icono: '🚢', color: '#10b981', orden: 3, descripcion: 'Comercio exterior', keywords: 'exportaciones,importaciones,balanza comercial,FOB,China,Brasil,Argentina' },
  { parentId: 'economia-modelo-desarrollo', nombre: 'Inversión y desarrollo productivo', slug: 'eco-inversion-productivo', icono: '🏗️', color: '#10b981', orden: 4, descripcion: 'Inversión y desarrollo productivo', keywords: 'inversión pública,inversión privada,industrialización,desarrollo productivo' },
  { parentId: 'economia-modelo-desarrollo', nombre: 'Empleo y mercado laboral', slug: 'eco-empleo-laboral', icono: '👷', color: '#10b981', orden: 5, descripcion: 'Empleo y mercado laboral', keywords: 'desempleo,informalidad,salarios,empleo,mercado laboral,contratación' },
  { parentId: 'economia-modelo-desarrollo', nombre: 'Modelo económico', slug: 'eco-modelo-economico', icono: '📈', color: '#10b981', orden: 6, descripcion: 'Modelo económico', keywords: 'extractivismo,economía plural,transición,modelo de desarrollo,postgasista' },

  // ─── Dominio 3: Salud (5 subtemas) ────────────────────────
  { parentId: 'salud-determinantes-sociales', nombre: 'Servicios de salud', slug: 'sal-servicios-salud', icono: '🏥', color: '#ec4899', orden: 1, descripcion: 'Servicios de salud', keywords: 'hospital,centro de salud,personal médico,MINSAL,Mi Salud,colapso' },
  { parentId: 'salud-determinantes-sociales', nombre: 'Agua y saneamiento', slug: 'sal-agua-saneamiento', icono: '💧', color: '#ec4899', orden: 2, descripcion: 'Agua y saneamiento', keywords: 'agua potable,alcantarillado,tratamiento,saneamiento básico' },
  { parentId: 'salud-determinantes-sociales', nombre: 'Alimentación y nutrición', slug: 'sal-alimentacion-nutricion', icono: '🍎', color: '#ec4899', orden: 3, descripcion: 'Alimentación y nutrición', keywords: 'desnutrición,seguridad alimentaria,desayuno escolar,programa alimentario' },
  { parentId: 'salud-determinantes-sociales', nombre: 'Condiciones de vida', slug: 'sal-condiciones-vida', icono: '🏠', color: '#ec4899', orden: 4, descripcion: 'Condiciones de vida', keywords: 'vivienda,ambiente,condiciones habitacionales,inundación,familias afectadas' },
  { parentId: 'salud-determinantes-sociales', nombre: 'Acceso y cobertura', slug: 'sal-acceso-cobertura', icono: '📋', color: '#ec4899', orden: 5, descripcion: 'Acceso y cobertura', keywords: 'Seguro de salud,cobertura universal,afiliaciones,bonos sociales,pensión' },

  // ─── Dominio 4: Minería (5 subtemas) ───────────────────────
  { parentId: 'mineria-metales-estrategicos', nombre: 'Minería estatal (COMIBOL)', slug: 'min-estatal-comibol', icono: '🏭', color: '#a16207', orden: 1, descripcion: 'Minería estatal (COMIBOL)', keywords: 'COMIBOL,Huanuni,Colquiri,Vinto,Karachipampa,producción,gestión estatal' },
  { parentId: 'mineria-metales-estrategicos', nombre: 'Minería cooperativista', slug: 'min-cooperativista', icono: '⛏️', color: '#a16207', orden: 2, descripcion: 'Minería cooperativista', keywords: 'cooperativa,cooperativista,FENCOMIN,concesiones,condiciones laborales,áreas explotación' },
  { parentId: 'mineria-metales-estrategicos', nombre: 'Litio y tierras raras', slug: 'min-litio-tierras-raras', icono: '🔋', color: '#10b981', orden: 3, descripcion: 'Litio y tierras raras', keywords: 'litio,YLB,salar,DLE,evaporación,baterías,tierras raras,neodimio,Pastos Grandes' },
  { parentId: 'mineria-metales-estrategicos', nombre: 'Estaño, zinc, plata, oro', slug: 'min-estano-zinc-plata-oro', icono: '📊', color: '#a16207', orden: 4, descripcion: 'Estaño, zinc, plata, oro', keywords: 'estaño,zinc,plata,oro,producción,exportación,LME,precios internacionales' },
  { parentId: 'mineria-metales-estrategicos', nombre: 'Condiciones laborales mineras', slug: 'min-condiciones-laborales', icono: '⛑️', color: '#ef4444', orden: 5, descripcion: 'Condiciones laborales mineras', keywords: 'seguridad,salud ocupacional,medio ambiente,derrumbe,accidente minero,heridos' },

  // ─── Dominio 5: Medio Ambiente (5 subtemas) ───────────────
  { parentId: 'medio-ambiente-territorio', nombre: 'Deforestación e incendios', slug: 'ma-deforestacion-incendios', icono: '🔥', color: '#ef4444', orden: 1, descripcion: 'Deforestación e incendios', keywords: 'deforestación,tasa,incendios forestales,hectáreas,quemas,punto de calor,Chapa' },
  { parentId: 'medio-ambiente-territorio', nombre: 'Biodiversidad y áreas protegidas', slug: 'ma-biodiversidad-protegidas', icono: '🌿', color: '#22c55e', orden: 2, descripcion: 'Biodiversidad y áreas protegidas', keywords: 'parque nacional,Madidi,especies amenazadas,macheteo,controversia' },
  { parentId: 'medio-ambiente-territorio', nombre: 'Contaminación', slug: 'ma-contaminacion', icono: '☠️', color: '#ef4444', orden: 3, descripcion: 'Contaminación', keywords: 'aire,agua,suelo,residuos sólidos,Pilcomayo,plomo,niveles tóxicos' },
  { parentId: 'medio-ambiente-territorio', nombre: 'Cambio climático', slug: 'ma-cambio-climatico', icono: '🌡️', color: '#22c55e', orden: 4, descripcion: 'Cambio climático', keywords: 'eventos climáticos extremos,sequía,altiplano,cosechas,cambio climático' },
  { parentId: 'medio-ambiente-territorio', nombre: 'Gestión territorial', slug: 'ma-gestion-territorial', icono: '🗺️', color: '#22c55e', orden: 5, descripcion: 'Gestión territorial', keywords: 'ordenamiento territorial,tenencia de tierra,INTI,saneamiento tierras' },

  // ─── Dominio 6: Participación y Acción Colectiva (7 subtemas)
  { parentId: 'participacion-accion-colectiva', nombre: 'Movilización y medidas de presión', slug: 'pac-movilizacion-presion', icono: '✊', color: '#ef4444', orden: 1, descripcion: 'Movilización y medidas de presión', keywords: 'bloqueo,marcha,huelga,paro,cabildo,toma,pickete,transportistas,carretera,tarifas' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Derechos y demandas sociales', slug: 'pac-derechos-demandas', icono: '📢', color: '#ef4444', orden: 2, descripcion: 'Derechos y demandas sociales', keywords: 'peticiones,reivindicaciones,comunidades,demandas sociales,exigencias' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Organizaciones sociales (sujetos)', slug: 'pac-org-sociales', icono: '🤝', color: '#ef4444', orden: 3, descripcion: 'Organizaciones sociales (sujetos)', keywords: 'COB,CSUTCB,CSCB,CONAMAQ,FNMCB,sindicato,federación,marcha,salario mínimo' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Organizaciones empresariales (sujetos)', slug: 'pac-org-empresariales', icono: '💼', color: '#ef4444', orden: 4, descripcion: 'Organizaciones empresariales (sujetos)', keywords: 'CAO,CAInco,cámaras sectoriales,paro empresarial,bloqueos' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Cooperativistas mineros (sujetos)', slug: 'pac-cooperativistas-mineros', icono: '⛏️', color: '#ef4444', orden: 5, descripcion: 'Cooperativistas mineros (sujetos)', keywords: 'FENCOMIN,federaciones cooperativistas,cooperativistas mineros,carreteras' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Comités cívicos y juntas vecinales (sujetos)', slug: 'pac-comites-civicos', icono: '🏘️', color: '#ef4444', orden: 6, descripcion: 'Comités cívicos y juntas vecinales (sujetos)', keywords: 'comités departamentales,juntas de barrio,comité cívico,cabildo' },
  { parentId: 'participacion-accion-colectiva', nombre: 'Diálogo y negociación', slug: 'pac-dialogo-negociacion', icono: '🤝', color: '#ef4444', orden: 7, descripcion: 'Diálogo y negociación', keywords: 'mesa de diálogo,acuerdos,resoluciones,gobierno-COB,negociación' },

  // ─── Dominio 7: Gestión Pública e Institucional (6 subtemas)
  { parentId: 'gestion-publica-institucional', nombre: 'Gestión del Ejecutivo', slug: 'gpi-ejecutivo', icono: '🏛️', color: '#3b82f6', orden: 1, descripcion: 'Gestión del Ejecutivo', keywords: 'presidente,ministros,decretos,reorganización ministerial,gabinete' },
  { parentId: 'gestion-publica-institucional', nombre: 'Gestión legislativa', slug: 'gpi-legislativa', icono: '📜', color: '#3b82f6', orden: 2, descripcion: 'Gestión legislativa', keywords: 'proyectos de ley,sesiones,comisiones,votaciones,Cámara,Diputados' },
  { parentId: 'gestion-publica-institucional', nombre: 'Gestión departamental', slug: 'gpi-departamental', icono: '🏢', color: '#3b82f6', orden: 3, descripcion: 'Gestión departamental', keywords: 'gobernadores,Asambleas Departamentales,plan de desarrollo' },
  { parentId: 'gestion-publica-institucional', nombre: 'Gestión municipal', slug: 'gpi-municipal', icono: '🏘️', color: '#3b82f6', orden: 4, descripcion: 'Gestión municipal', keywords: 'alcaldías,Concejos Municipales,plan de movilidad urbana,servicios municipales' },
  { parentId: 'gestion-publica-institucional', nombre: 'Instituciones de control', slug: 'gpi-control-instituciones', icono: '⚖️', color: '#3b82f6', orden: 5, descripcion: 'Instituciones de control', keywords: 'Contraloría,Fiscalía,Tribunal Supremo,acusación,corrupción,caso' },
  { parentId: 'gestion-publica-institucional', nombre: 'Servicios públicos e infraestructura', slug: 'gpi-servicios-infraestructura', icono: '🛣️', color: '#3b82f6', orden: 6, descripcion: 'Servicios públicos e infraestructura', keywords: 'carreteras,aeropuertos,agua,electricidad,obra pública' },

  // ─── Dominio 8: Organización Política (5 subtemas) ─────────
  { parentId: 'organizacion-politica-electoral', nombre: 'Partidos y agrupaciones ciudadanas', slug: 'ope-partidos-agrupaciones', icono: '🗳️', color: '#8b5cf6', orden: 1, descripcion: 'Partidos y agrupaciones ciudadanas', keywords: 'partidos políticos,agrupaciones ciudadanas,alianzas,inscripción,TSE' },
  { parentId: 'organizacion-politica-electoral', nombre: 'Procesos electorales', slug: 'ope-procesos-electorales', icono: '🗳️', color: '#8b5cf6', orden: 2, descripcion: 'Procesos electorales', keywords: 'elecciones,primarias,campañas,resultados,escrutinio,urnas' },
  { parentId: 'organizacion-politica-electoral', nombre: 'Democracia comunitaria', slug: 'ope-democracia-comunitaria', icono: '🤲', color: '#8b5cf6', orden: 3, descripcion: 'Democracia comunitaria', keywords: 'usos y costumbres,formas preexistentes,decisión colectiva,autoridades' },
  { parentId: 'organizacion-politica-electoral', nombre: 'Participación y control social', slug: 'ope-participacion-control-social', icono: '👁️', color: '#8b5cf6', orden: 4, descripcion: 'Participación y control social', keywords: 'veedurías,auditorías sociales,referendos,comité vigilancia,fiscalización' },
  { parentId: 'organizacion-politica-electoral', nombre: 'Sistema de partidos', slug: 'ope-sistema-partidos', icono: '📋', color: '#8b5cf6', orden: 5, descripcion: 'Sistema de partidos', keywords: 'leyes partidarias,financiamiento,organización,TSE,reglamentación' },

  // ─── Dominio 9: Justicia (5 subtemas) ─────────────────────
  { parentId: 'justicia-derechos-humanos-impunidad', nombre: 'Acceso a justicia', slug: 'jdi-acceso-justicia', icono: '⚖️', color: '#6366f1', orden: 1, descripcion: 'Acceso a justicia', keywords: 'funcionamiento judicial,defensoría pública,casos,violación derechos' },
  { parentId: 'justicia-derechos-humanos-impunidad', nombre: 'Derechos humanos', slug: 'jdi-derechos-humanos', icono: '🕊️', color: '#6366f1', orden: 2, descripcion: 'Derechos humanos', keywords: 'persecución,CIDH,denuncia,dirigentes sociales,protección' },
  { parentId: 'justicia-derechos-humanos-impunidad', nombre: 'Corrupción e impunidad', slug: 'jdi-corrupcion-impunidad', icono: '🔍', color: '#6366f1', orden: 3, descripcion: 'Corrupción e impunidad', keywords: 'corrupción,casos,lavado dinero,ministro destituido,contratos,presunta' },
  { parentId: 'justicia-derechos-humanos-impunidad', nombre: 'Seguridad ciudadana', slug: 'jdi-seguridad-ciudadana', icono: '🛡️', color: '#6366f1', orden: 4, descripcion: 'Seguridad ciudadana', keywords: 'delincuencia,violencia,fuerzas de orden,plan de seguridad,policía' },
  { parentId: 'justicia-derechos-humanos-impunidad', nombre: 'Sistema penitenciario', slug: 'jdi-sistema-penitenciario', icono: '🏢', color: '#6366f1', orden: 5, descripcion: 'Sistema penitenciario', keywords: 'cárceles,hacinamiento,derechos reclusos,Palmasola,informe' },

  // ─── Dominio 10: Educación (6 subtemas) ────────────────────
  { parentId: 'educacion-cultura-identidad', nombre: 'Educación formal', slug: 'edu-formal', icono: '📚', color: '#06b6d4', orden: 1, descripcion: 'Educación formal', keywords: 'escuelas,universidades,reformas educativas,Consejo Universitario,rechazo' },
  { parentId: 'educacion-cultura-identidad', nombre: 'Educación técnica y tecnología', slug: 'edu-tecnologia', icono: '💻', color: '#06b6d4', orden: 2, descripcion: 'Educación técnica y tecnología', keywords: 'institutos técnicos,formación profesional,inauguración,eje troncal' },
  { parentId: 'educacion-cultura-identidad', nombre: 'Magisterio, autonomía universitaria y presupuesto', slug: 'edu-magisterio-presupuesto', icono: '🎓', color: '#06b6d4', orden: 3, descripcion: 'Magisterio, autonomía universitaria y presupuesto', keywords: 'magisterio,autonomía universitaria,presupuesto,UPE,CEB,paro magisterial' },
  { parentId: 'educacion-cultura-identidad', nombre: 'Cultura y patrimonio', slug: 'edu-cultura-patrimonio', icono: '🎭', color: '#06b6d4', orden: 4, descripcion: 'Cultura y patrimonio', keywords: 'patrimonio cultural,Carnaval de Oruro,intangible,artes,festividades' },
  { parentId: 'educacion-cultura-identidad', nombre: 'Idiomas y diversidad lingüística', slug: 'edu-idiomas-diversidad', icono: '🗣️', color: '#06b6d4', orden: 5, descripcion: 'Idiomas y diversidad lingüística', keywords: 'lenguas originarias,política lingüística,enseñanza,Ministerio Educación' },
  { parentId: 'educacion-cultura-identidad', nombre: 'Deporte y recreación', slug: 'edu-deporte-recreacion', icono: '⚽', color: '#06b6d4', orden: 6, descripcion: 'Deporte y recreación', keywords: 'infraestructura deportiva,eventos,fútbol,mundial,clasificación' },

  // ─── Dominio 11: Geopolítica (5 subtemas) ──────────────────
  { parentId: 'geopolitica-relaciones-internacionales', nombre: 'Relaciones bilaterales', slug: 'gri-relaciones-bilaterales', icono: '🤝', color: '#0ea5e9', orden: 1, descripcion: 'Relaciones bilaterales', keywords: 'acuerdos,conflictos diplomáticos,visitas oficiales,canciller,homólogo,Chile' },
  { parentId: 'geopolitica-relaciones-internacionales', nombre: 'Integración regional', slug: 'gri-integracion-regional', icono: '🌐', color: '#0ea5e9', orden: 2, descripcion: 'Integración regional', keywords: 'UNASUR,MERCOSUR,CAN,ALBA,presidencia pro tempore' },
  { parentId: 'geopolitica-relaciones-internacionales', nombre: 'Soberanía y demanda marítima', slug: 'gri-soberania-demanda-maritima', icono: '⚓', color: '#0ea5e9', orden: 3, descripcion: 'Soberanía y demanda marítima', keywords: 'mediterraneidad,demanda,CIJ,audiencia,mar territorial,agenda marítima' },
  { parentId: 'geopolitica-relaciones-internacionales', nombre: 'Política exterior', slug: 'gri-politica-exterior', icono: '🏛️', color: '#0ea5e9', orden: 4, descripcion: 'Política exterior', keywords: 'posicionamiento internacional,organismos multilaterales,ONU,resolución,voto' },
  { parentId: 'geopolitica-relaciones-internacionales', nombre: 'Migración y fronteras', slug: 'gri-migracion-fronteras', icono: '🛂', color: '#0ea5e9', orden: 5, descripcion: 'Migración y fronteras', keywords: 'migrantes bolivianos,fronteras,Chile,Argentina,tráfico,aumento migración' },

  // ─── Dominio 12: Territorio y Población (5 subtemas) ──────
  { parentId: 'territorio-poblacion-derechos-colectivos', nombre: 'Pueblos indígenas y originarios', slug: 'tpc-pueblos-indigenas', icono: '🏔️', color: '#84cc16', orden: 1, descripcion: 'Pueblos indígenas y originarios', keywords: 'derechos colectivos,tierras comunitarias,autonomías indígenas,TCO' },
  { parentId: 'territorio-poblacion-derechos-colectivos', nombre: 'Derechos colectivos', slug: 'tpc-derechos-colectivos', icono: '📜', color: '#84cc16', orden: 2, descripcion: 'Derechos colectivos', keywords: 'consulta previa,consentimiento libre,autonomías,proyecto minero,comunidad exige' },
  { parentId: 'territorio-poblacion-derechos-colectivos', nombre: 'Población y demografía', slug: 'tpc-poblacion-demografia', icono: '📊', color: '#84cc16', orden: 3, descripcion: 'Población y demografía', keywords: 'censos,crecimiento,distribución poblacional,INE,resultados,censo 2024' },
  { parentId: 'territorio-poblacion-derechos-colectivos', nombre: 'Género y diversidad', slug: 'tpc-genero-diversidad', icono: '💜', color: '#84cc16', orden: 4, descripcion: 'Género y diversidad', keywords: 'violencia de género,feminicidio,LGBTIQ+,participación,registro,casos' },
  { parentId: 'territorio-poblacion-derechos-colectivos', nombre: 'Pueblos y naciones originarias', slug: 'tpc-naciones-originarias', icono: '🌳', color: '#84cc16', orden: 5, descripcion: 'Pueblos y naciones originarias', keywords: 'Qullas,Aymaras,Guaraníes,naciones,territorio,Chiquitanía,reclama' },
];

// Mapeo de siglas de partido — normalización
function normalizarPartido(sigla: string, nombre: string): { sigla: string; nombre: string } {
  const mapa: Record<string, string> = {
    'PDC': 'Partido Demócrata Cristiano',
    'LIBRE': 'Libre',
    'UNIDAD': 'Unidad',
    'APB SÚMATE': 'APB Súmate',
    'APB-SÚMATE': 'APB Súmate',
    'AP': 'Acción Panamericana',
    'MAS IPSP': 'Movimiento al Socialismo - IPSP',
    'BIA YUQUI': 'Bia Yuqui',
    'CC': 'Comunidad Ciudadana',
    'MNR': 'Movimiento Nacionalista Revolucionario',
    'MTS': 'Movimiento Tercer Sistema',
    'PAN-BOL': 'Poder Andino Amazónico',
    'JUNTOS': 'Juntos',
    'FRI': 'Frente Revolucionario de Izquierda',
    'VERDE': 'Partido Verde',
    'PODEMOS': 'Poder Democrático Social',
    'MIR': 'Movimiento de Izquierda Revolucionaria',
    'ADN': 'Acción Democrática Nacionalista',
    'NFR': 'Nueva Fuerza Republicana',
    'UCS': 'Unidad Cívica Solidaridad',
  };

  let siglaLimpia = sigla?.toUpperCase().trim() || '';
  // Normalizar variantes de APB SÚMATE (con/sin guión, con/sin accent)
  const sNormalizada = siglaLimpia.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (sNormalizada.includes('APB') && sNormalizada.includes('SUMATE')) {
    siglaLimpia = 'APB SÚMATE';
  }

  const nombreEncontrado = mapa[siglaLimpia];

  return {
    sigla: siglaLimpia,
    nombre: nombreEncontrado || nombre || siglaLimpia,
  };
}

function normalizarDepartamento(dep: string): string {
  if (!dep) return '';
  const d = dep.charAt(0).toUpperCase() + dep.slice(1).toLowerCase();
  // Correcciones específicas
  const mapa: Record<string, string> = {
    'Chuquisaca': 'Chuquisaca',
    'La paz': 'La Paz',
    'Cochabamba': 'Cochabamba',
    'Oruro': 'Oruro',
    'Potosí': 'Potosí',
    'Potosi': 'Potosí',
    'Tarija': 'Tarija',
    'Santa cruz': 'Santa Cruz',
    'Beni': 'Beni',
    'Pando': 'Pando',
  };
  return mapa[d] || d;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, seedSchema, RATE.DESTRUCTIVE);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed.body;
    const force = body.force;

    // Protección: operaciones con force requieren API key (siempre excepto SEED_API_KEY=dev)
    if (force && !validateSeedKey(request)) {
      return NextResponse.json(
        { error: 'Operación no autorizada. Se requiere SEED_API_KEY.' },
        { status: 403 }
      );
    }

    const existing = await db.persona.count();

    const seedOnly = body.seed_only === 'subs';

    // Mode: seed only sub-clasificaciones (no wipe needed)
    if (seedOnly) {
      // Batch: pre-fetch all ejes and existing slugs, then createMany (3 queries vs ~60)
      const allEjes = await db.ejeTematico.findMany({
        where: { activo: true },
        select: { id: true, slug: true },
      });
      const ejesBySlug = new Map(allEjes.map(e => [e.slug, e.id]));

      const existingSlugs = new Set(
        (await db.ejeTematico.findMany({
          where: { slug: { in: SUBCLASIFICACIONES.map(s => s.slug) } },
          select: { slug: true },
        })).map(e => e.slug)
      );

      const subsToCreate: Array<Record<string, unknown>> = [];
      let subsSkipped = 0;
      for (const sub of SUBCLASIFICACIONES) {
        const parentId = ejesBySlug.get(sub.parentId);
        if (!parentId) { subsSkipped++; continue; }
        if (existingSlugs.has(sub.slug)) { subsSkipped++; continue; }
        const { parentId: _parentId, ...data } = sub;
        subsToCreate.push({ ...data, parentId });
      }

      let subsCreated = 0;
      if (subsToCreate.length > 0) {
        const result = await db.ejeTematico.createMany({ data: subsToCreate, skipDuplicates: true });
        subsCreated = result.count;
      }
      return NextResponse.json({
        message: `Sub-clasificaciones: ${subsCreated} creadas, ${subsSkipped} ya existían`,
        subsCreated,
        subsSkipped,
      });
    }

    // Mode: seed only lentes transversales (no wipe needed)
    if (body.seed_only === 'lentes') {
      const existingLentes = new Set(
        (await db.lente.findMany({
          where: { slug: { in: LENTES_TRANSVERSALES.map(l => l.slug) } },
          select: { slug: true },
        })).map(l => l.slug)
      );

      const lentesToCreate = LENTES_TRANSVERSALES.filter(l => !existingLentes.has(l.slug)).map(l => ({
        id: crypto.randomUUID(),
        nombre: l.nombre,
        slug: l.slug,
        descripcion: l.descripcion,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      let lentesCreated = 0;
      if (lentesToCreate.length > 0) {
        const result = await db.lente.createMany({ data: lentesToCreate, skipDuplicates: true });
        lentesCreated = result.count;
      }

      // Create keywords for new lentes
      const allLentesNow = await db.lente.findMany({ where: { activo: true }, select: { id: true, slug: true } });
      const lenteBySlugNow = new Map(allLentesNow.map(l => [l.slug, l.id]));
      const kwData: Array<{ id: string; termino: string; lenteId: string; activo: boolean; createdAt: Date; updatedAt: Date }> = [];
      for (const lenteDef of LENTES_TRANSVERSALES) {
        const lenteId = lenteBySlugNow.get(lenteDef.slug);
        if (!lenteId) continue;
        for (const kw of lenteDef.keywords) {
          if (kw.trim().length >= 2) {
            kwData.push({ id: crypto.randomUUID(), termino: kw.toLowerCase(), lenteId, activo: true, createdAt: new Date(), updatedAt: new Date() });
          }
        }
      }
      if (kwData.length > 0) {
        await db.keyword.createMany({ data: kwData, skipDuplicates: true });
      }

      return NextResponse.json({
        message: `Lentes: ${lentesCreated} creados, ${existingLentes.size} ya existían, ${kwData.length} keywords procesados`,
        lentesCreated,
        lentesExisting: existingLentes.size,
        keywordsProcessed: kwData.length,
      });
    }

    if (existing > 0 && !force) {
      return NextResponse.json({
        message: 'Base de datos ya contiene datos. Usa { "force": true } para re-seed o { "seed_only": "subs" } para solo sub-clasificaciones.',
        personas: existing,
        medios: await db.medio.count(),
        ejes: await db.ejeTematico.count(),
      });
    }

    const fs = await import('fs');
    const path = await import('path');

    // Si force, limpiar tablas
    if (force && existing > 0) {
      console.log('Limpiando base de datos...');
      await db.comentario.deleteMany();
      await db.mencionTema.deleteMany();
      await db.mencion.deleteMany();
      await db.reporte.deleteMany();
      await db.capturaLog.deleteMany();
      await db.persona.deleteMany();
      await db.medio.deleteMany();
      await db.keyword.deleteMany(); // Clean keywords (depend on ejes/lentes)
      await db.lente.deleteMany();      // Clean lentes
      await db.ejeTematico.deleteMany();
    }

    // 1. Seed ejes temáticos (batch createMany)
    console.log('Seeding ejes temáticos...');
    const ejesResult = await db.ejeTematico.createMany({
      data: EJES_TEMATICOS,
      skipDuplicates: true,
    });

    // Create Keyword records from keywords string for clasificador-v2.ts
    const allEjesForKw = await db.ejeTematico.findMany({
      where: { activo: true },
      select: { id: true, keywords: true },
    });
    const keywordData: Array<{ id: string; termino: string; ejeId: string; activo: boolean; createdAt: Date; updatedAt: Date }> = [];
    for (const eje of allEjesForKw) {
      if (!eje.keywords) continue;
      const terms = eje.keywords.split(',').map(t => t.trim()).filter(t => t.length >= 2);
      for (const term of terms) {
        keywordData.push({ id: crypto.randomUUID(), termino: term.toLowerCase(), ejeId: eje.id, activo: true, createdAt: new Date(), updatedAt: new Date() });
      }
    }
    if (keywordData.length > 0) {
      await db.keyword.createMany({ data: keywordData, skipDuplicates: true });
      console.log(`Created ${keywordData.length} keyword records for dominios`);
    }

    // 1b. Seed sub-clasificaciones (batch: pre-fetch parents once, then createMany)
    console.log('Seeding sub-clasificaciones...');
    const allEjes = await db.ejeTematico.findMany({ select: { id: true, slug: true } });
    const ejesBySlug = new Map(allEjes.map(e => [e.slug, e.id]));

    const subsToCreate: Array<Record<string, unknown>> = [];
    for (const sub of SUBCLASIFICACIONES) {
      const parentId = ejesBySlug.get(sub.parentId);
      if (parentId) {
        const { parentId: _parentId, ...data } = sub;
        subsToCreate.push({ ...data, parentId });
      }
    }
    let subsCreated = 0;
    if (subsToCreate.length > 0) {
      const subsResult = await db.ejeTematico.createMany({ data: subsToCreate, skipDuplicates: true });
      subsCreated = subsResult.count;
    }
    console.log(`Created ${subsCreated} sub-clasificaciones`);

    // Create Keyword records for sub-clasificaciones
    const allSubsForKw = await db.ejeTematico.findMany({
      where: { activo: true, parentId: { not: null } },
      select: { id: true, keywords: true },
    });
    const subKeywordData: Array<{ id: string; termino: string; ejeId: string; activo: boolean; createdAt: Date; updatedAt: Date }> = [];
    for (const sub of allSubsForKw) {
      if (!sub.keywords) continue;
      const terms = sub.keywords.split(',').map(t => t.trim()).filter(t => t.length >= 2);
      for (const term of terms) {
        subKeywordData.push({ id: crypto.randomUUID(), termino: term.toLowerCase(), ejeId: sub.id, activo: true, createdAt: new Date(), updatedAt: new Date() });
      }
    }
    if (subKeywordData.length > 0) {
      await db.keyword.createMany({ data: subKeywordData, skipDuplicates: true });
      console.log(`Created ${subKeywordData.length} keyword records for sub-clasificaciones`);
    }

    // 1c. Seed 9 lentes transversales (DECODEX ONION200 v2)
    console.log('Seeding lentes transversales...');
    const lentesData = LENTES_TRANSVERSALES.map(l => ({
      id: crypto.randomUUID(),
      nombre: l.nombre,
      slug: l.slug,
      descripcion: l.descripcion,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const lentesResult = await db.lente.createMany({ data: lentesData, skipDuplicates: true });
    console.log(`Created ${lentesResult.count} lentes transversales`);

    // Create Keyword records for lentes
    const allLentes = await db.lente.findMany({ where: { activo: true }, select: { id: true, slug: true } });
    const lenteBySlug = new Map(allLentes.map(l => [l.slug, l.id]));
    const lenteKeywordData: Array<{ id: string; termino: string; lenteId: string; activo: boolean; createdAt: Date; updatedAt: Date }> = [];
    for (const lenteDef of LENTES_TRANSVERSALES) {
      const lenteId = lenteBySlug.get(lenteDef.slug);
      if (!lenteId) continue;
      for (const kw of lenteDef.keywords) {
        if (kw.trim().length >= 2) {
          lenteKeywordData.push({ id: crypto.randomUUID(), termino: kw.toLowerCase(), lenteId, activo: true, createdAt: new Date(), updatedAt: new Date() });
        }
      }
    }
    if (lenteKeywordData.length > 0) {
      await db.keyword.createMany({ data: lenteKeywordData, skipDuplicates: true });
      console.log(`Created ${lenteKeywordData.length} keyword records for lentes`);
    }

    // 2. Seed medios from medios.json (batch createMany)
    console.log('Seeding medios...');
    const mediosPath = path.join(process.cwd(), 'data', 'medios.json');
    const mediosRaw = fs.readFileSync(mediosPath, 'utf-8');
    const medios: Array<Record<string, string>> = JSON.parse(mediosRaw);

    const mediosResult = await db.medio.createMany({
      data: medios.map(medio => ({
        nombre: medio.nombre,
        url: medio.url || '',
        tipo: medio.tipo,
        nivel: String(medio.nivel || '1'),
        departamento: medio.departamento || null,
        plataformas: medio.plataformas || '',
        notas: medio.notas || '',
      })),
      skipDuplicates: true,
    });

    // 3. Seed senadores from senadores_completo.json (batch createMany)
    console.log('Seeding senadores...');
    const senadoresPath = path.join(process.cwd(), 'data', 'senadores_completo.json');
    const senadoresRaw = fs.readFileSync(senadoresPath, 'utf-8');
    const senadores: Array<Record<string, unknown>> = JSON.parse(senadoresRaw);

    const senadoresData = senadores
      .map(sen => {
        const nombre = String(sen.nombre || '').replace(/\s+/g, ' ').trim();
        if (!nombre) return null;
        const partido = normalizarPartido(String(sen.partido_sigla || ''), String(sen.partido || ''));
        return {
          nombre,
          camara: 'Senadores',
          departamento: normalizarDepartamento(String(sen.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: 'Titular',
          cargoDirectiva: sen.cargo_directiva ? String(sen.cargo_directiva) : null,
          email: sen.email ? String(sen.email) : null,
          fotoUrl: sen.foto_url ? String(sen.foto_url) : '',
          periodo: '2025-2030',
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const senadoresResult = senadoresData.length > 0
      ? await db.persona.createMany({ data: senadoresData, skipDuplicates: true })
      : { count: 0 };
    const senadoresCount = senadoresResult.count;

    // 4. Seed diputados from diputados_2025_2030_completo.json (batch createMany)
    console.log('Seeding diputados...');
    const diputadosPath = path.join(process.cwd(), 'data', 'diputados_2025_2030_completo.json');
    const diputadosRaw = fs.readFileSync(diputadosPath, 'utf-8');
    const diputadosDataRaw = JSON.parse(diputadosRaw);
    const diputados: Array<Record<string, unknown>> = diputadosDataRaw.diputados;

    const diputadosData = diputados
      .map(dip => {
        const nombre = String(dip.nombre || '').replace(/\s+/g, ' ').trim();
        if (!nombre) return null;
        const partido = normalizarPartido(String(dip.partido_sigla || ''), String(dip.partido || ''));
        return {
          nombre,
          camara: 'Diputados',
          departamento: normalizarDepartamento(String(dip.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: 'Titular',
          email: null,
          fotoUrl: String(dip.foto_url || ''),
          periodo: '2025-2030',
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const diputadosResult = diputadosData.length > 0
      ? await db.persona.createMany({ data: diputadosData, skipDuplicates: true })
      : { count: 0 };
    const diputadosCount = diputadosResult.count;

    const totalPersonas = senadoresCount + diputadosCount;

    // 5. Seed indicadores macroeconómicos (Tier 1)
    console.log('Seeding indicadores Tier 1...');
    await seedIndicadores();

    return NextResponse.json({
      message: `Seed ejecutado correctamente (v2.0) — ${force ? 'FORCE RESET' : 'nuevo'}`,
      ejesInsertados: ejesResult.count,
      subsInsertados: subsCreated,
      keywordsCreados: keywordData.length + subKeywordData.length,
      mediosInsertados: mediosResult.count,
      totalPersonas,
      desglose: {
        senadores: senadoresCount,
        diputados: diputadosCount,
      },
      partidos: [...new Set([
        ...senadores.map((s: Record<string, unknown>) => String(s.partido_sigla)),
        ...diputados.map((d: Record<string, unknown>) => String(d.partido_sigla)),
      ])].sort(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: guardError(error, 'seed') },
      { status: 500 }
    );
  }
}

// GET para ver estado actual del seed
export async function GET() {
  try {
    const [personas, medios, ejes, menciones, lentes, keywords] = await Promise.all([
      db.persona.count(),
      db.medio.count(),
      db.ejeTematico.count(),
      db.mencion.count(),
      db.lente.count(),
      db.keyword.count(),
    ]);

    const diputados = await db.persona.count({ where: { camara: 'Diputados' } });
    const senadores = await db.persona.count({ where: { camara: 'Senadores' } });

    // Ejes estructurales vs legacy
    const ejesEstructurales = await db.ejeTematico.count({ where: { tipo: 'estructural' } });
    const ejesSub = await db.ejeTematico.count({ where: { parentId: { not: null } } });

    // Distribución por partido
    const personasPorPartido = await db.persona.groupBy({
      by: ['partidoSigla'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Distribución por departamento
    const personasPorDepto = await db.persona.groupBy({
      by: ['departamento'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return NextResponse.json({
      estado: personas > 0 ? 'seeded' : 'empty',
      personas,
      diputados,
      senadores,
      medios,
      ejes,
      ejesEstructurales,
      ejesSub,
      lentes,
      keywords,
      menciones,
      porPartido: personasPorPartido.map(p => ({ partido: p.partidoSigla, count: p._count.id })),
      porDepartamento: personasPorDepto.map(d => ({ departamento: d.departamento, count: d._count.id })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'seed') }, { status: 500 });
  }
}
