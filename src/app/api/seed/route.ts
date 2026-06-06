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

// 12 Ejes Temáticos aprobados — DECODEX ONION200 v0.6.0
// Regla: nunca conflatar sujetos/acciones/evaluaciones
// Seguridad ciudadana: eje propio, NUNCA prioritario automáticamente
const EJES_TEMATICOS = [
  { nombre: 'Hidrocarburos, Energía y Combustible', slug: 'hidrocarburos-energia', icono: '⛽', color: '#f59e0b', orden: 1, keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos,GNL,Gualberto Villarroel,Guaracachi,ENDE,megavatios', descripcion: 'Noticias sobre hidrocarburos, energía, combustibles, YPFB, litio, electricidad, subsidios energéticos, generación eléctrica' },
  { nombre: 'Gobierno, Oposición e Instituciones', slug: 'gobierno-oposicion', icono: '🏛️', color: '#3b82f6', orden: 2, keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro,decreto,resolución,gabinete,Ejecutivo,Legislativo', descripcion: 'Actividad legislativa, declaraciones de bancadas, procesos en la Asamblea, gestión gubernamental, dinámica institucional' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', icono: '🔥', color: '#dc2626', orden: 3, keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,cohecho, trafficante de influencias,Contraloría,ilícitos económicos', descripcion: 'Denuncias de corrupción, auditorías, comisiones de investigación, irregularidades financieras, ilícitos económicos' },
  { nombre: 'Economía y Política Económica', slug: 'economia', icono: '💰', color: '#10b981', orden: 4, keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo,BCB,déficit fiscal,TGN,canasta familiar,IPC', descripcion: 'Indicadores económicos, política fiscal, tipo de cambio, reservas, presupuesto general, mercado laboral' },
  { nombre: 'Justicia, Derechos Humanos y Debido Proceso', slug: 'justicia-derechos', icono: '⚖️', color: '#6366f1', orden: 5, keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,Tribunal Supremo,TCP,defensor del pueblo,debido proceso,prisión preventiva', descripcion: 'Sistema judicial, derechos humanos, debido proceso, denuncias penales, sentencias, comisiones de verdad, justicia indígena' },
  { nombre: 'Procesos Electorales', slug: 'procesos-electorales', icono: '🗳️', color: '#8b5cf6', orden: 6, keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio,tribunal electoral,biometría,padrón,locutor', descripcion: 'Elecciones, procesos del TSE/OEP, candidatos, resultados electorales, observación, padrón electoral' },
  { nombre: 'Educación, Universidades y Ciencia', slug: 'educacion-cultura', icono: '📚', color: '#06b6d4', orden: 7, keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio,investigación,ciencia,tecnología,UPE,CEB,educación alternativa', descripcion: 'Presupuesto educativo, sistema educativo, universidades, investigación científica, patrimonio cultural' },
  { nombre: 'Salud y Servicios Sociales', slug: 'salud-servicios', icono: '🏥', color: '#ec4899', orden: 8, keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros,sistema de salud,MINSAL,Bono Juancito Pinto,Bono Juana Azurduy,pensión,Renta Dignidad,servicios sociales,Bono Universal', descripcion: 'Sistema de salud, hospitales, medicamentos, seguros médicos, bonos sociales, pensiones, servicios sociales del Estado' },
  { nombre: 'Seguridad Ciudadana', slug: 'seguridad-ciudadana', icono: '🛡️', color: '#b91c1c', orden: 9, keywords: 'delito,asalto,homicidio,seguridad,policía,FELCC,secuestro,extorsión,narcotráfico,cárcel,penal,rehén,cadena nacional,estado de excepción,forcejeo', descripcion: 'Delitos, seguridad ciudadana, fuerza policial, sistema penitenciario. REGLA: nunca debe ser prioritario automáticamente — ponderar contexto y proporcionalidad según CPE y convenciones internacionales' },
  { nombre: 'Medio Ambiente, Territorio y Recursos Naturales', slug: 'medio-ambiente', icono: '🌍', color: '#22c55e', orden: 10, keywords: 'medio ambiente,agua,incendios,autonomías,deforestación,territorio,concesión,Pachamama,sequía,glaciar,deshielo,Amazonía,Chiquitanía,contaminación hídrica', descripcion: 'Medio ambiente, recursos naturales, agua, incendios forestales, autonomías territoriales, cambio climático' },
  { nombre: 'Relaciones Internacionales y Geopolítica', slug: 'relaciones-internacionales', icono: '🌎', color: '#0ea5e9', orden: 11, keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea,mar territorial,CIJ,OEA,caso La Paz,agenda 2063', descripcion: 'Relaciones diplomáticas, fronteras, litigios internacionales, migración, cooperación, tratados bilaterales' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', icono: '⛏️', color: '#a16207', orden: 12, keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estaño,zinc,plata,plomo,oro,YLB,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM,LME', descripcion: 'Sector minero boliviano: producción, precios internacionales (LME), litio y metales estratégicos, conflictividad cooperativas, pasivos ambientales, regalías y normativa minera' },
];

// Sub-clasificadores con dimensiones
const SUBCLASIFICACIONES = [
  // ─── Hidrocarburos y Energía ──────────────────────────────
  { parentId: 'hidrocarburos-energia', nombre: 'Producción y Refinación', slug: 'hc-produccion-refinacion', icono: '🛢️', color: '#f59e0b', orden: 1, dimension: 'produccion', descripcion: 'Volumen de producción de hidrocarburos, actividad de refinerías (Gualberto Villarroel, Guaracachi)', keywords: 'producción,refinería,GNP,barriles,extracción,Gualberto Villarroel,Guaracachi,Petroandina' },
  { parentId: 'hidrocarburos-energia', nombre: 'Importación y Comercialización', slug: 'hc-importacion-comercializacion', icono: '🚢', color: '#f59e0b', orden: 2, dimension: 'produccion', descripcion: 'Importación de combustibles, comercialización de hidrocarburos, cadena de distribución', keywords: 'importación,comercialización,distribución,terminal,almacenamiento' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gasolina y Diésel (Precios)', slug: 'hc-gasolina-diesel', icono: '⛽', color: '#f59e0b', orden: 3, dimension: 'precio', descripcion: 'Precios de gasolina especial, diésel, precio paralelo, subsidios energéticos', keywords: 'gasolina,diésel,precio,subsidio,galón,paralelo,especial' },
  { parentId: 'hidrocarburos-energia', nombre: 'Gas Natural', slug: 'hc-gas-natural', icono: '🔥', color: '#f59e0b', orden: 4, dimension: 'produccion', descripcion: 'Producción y reservas de gas natural, contratos de exportación, distribución interna', keywords: 'gas natural,reservas,exportación,Brasil,Argentina,GNL,distribución,YPFB Transporte' },
  { parentId: 'hidrocarburos-energia', nombre: 'Generación Eléctrica', slug: 'hc-generacion-electrica', icono: '⚡', color: '#f59e0b', orden: 5, dimension: 'infraestructura', descripcion: 'Generación eléctrica, térmica e hidroeléctrica, proyectos de expansión', keywords: 'generación,eléctrica,térmica,hidroeléctrica,ENDE,megavatios,central' },
  { parentId: 'hidrocarburos-energia', nombre: 'Consumo Eléctrico', slug: 'hc-consumo-electrico', icono: '💡', color: '#f59e0b', orden: 6, dimension: 'produccion', descripcion: 'Consumo de energía eléctrica por sector, demandas regionales, racionamiento', keywords: 'consumo,eléctrico,demanda,racionamiento,apagón,deficit' },
  { parentId: 'hidrocarburos-energia', nombre: 'Conflictividad Hidrocarburífera', slug: 'hc-conflictividad', icono: '🚨', color: '#ef4444', orden: 7, dimension: 'conflicto', descripcion: 'Escasez de gasolina, bloqueos por distribución, protestas regionales, conflictos por subsidios', keywords: 'escasez,bloqueo,protesta,colas,gasolina,regional,subsidio,conflicto,demanda' },

  // ─── Minería y Metales Estratégicos ──────────────────────
  { parentId: 'mineria', nombre: 'Producción Minera (TMF)', slug: 'min-produccion', icono: '⚙️', color: '#a16207', orden: 1, dimension: 'produccion', descripcion: 'Volumen de producción en toneladas métricas finas por mineral y operador', keywords: 'producción,TMF,toneladas,Huanuni,Colquiri,San Cristóbal,COMIBOL,cooperativa' },
  { parentId: 'mineria', nombre: 'Precios Internacionales (LME)', slug: 'min-precios-lme', icono: '📊', color: '#a16207', orden: 2, dimension: 'precio', descripcion: 'Cotización LME de zinc, estaño, plata, plomo y otros metales bolivianos', keywords: 'LME,zinc,estaño,plata,plomo,precio,cotización,dólar,tonelada' },
  { parentId: 'mineria', nombre: 'Exportaciones Mineras FOB', slug: 'min-exportaciones', icono: '🚢', color: '#a16207', orden: 3, dimension: 'produccion', descripcion: 'Valor FOB de exportaciones mineras por mineral y país destino', keywords: 'exportación,FOB,China,India,Corea,valor,aduanas' },
  { parentId: 'mineria', nombre: 'Costos Operativos', slug: 'min-costos', icono: '💵', color: '#a16207', orden: 4, dimension: 'precio', descripcion: 'Costos por tonelada movida, insumos (ácido, cianuro, cal), mano de obra', keywords: 'costo,tonelada,insumo,ácido,cianuro,cal,mano de obra' },
  { parentId: 'mineria', nombre: 'Litio y Minerales Críticos', slug: 'min-litio', icono: '🔋', color: '#10b981', orden: 5, dimension: 'produccion', descripcion: 'Proyecto YLB EV Metals, DLE vs evaporación, asociaciones BYD/CATL/CAC', keywords: 'litio,YLB,DLE,salar,carbonato,Uyuni,Coipasa,BYD,CATL,evaporación,baterías' },
  { parentId: 'mineria', nombre: 'Conflictividad Cooperativas', slug: 'min-conflictividad', icono: '🚨', color: '#ef4444', orden: 6, dimension: 'conflicto', descripcion: 'Paros y bloqueos mineros, conflictos cooperativas-privada, minería ilegal, rutas bloqueadas', keywords: 'paro,bloqueo,cooperativa,conflicto,ilegal,reserva fiscal,secuestro,ruta' },
  { parentId: 'mineria', nombre: 'Regalías y Tributos', slug: 'min-regalias', icono: '📋', color: '#3b82f6', orden: 7, dimension: 'regulacion', descripcion: 'Recaudación de regalías mineras, debates legislativos, Ley Minera 535', keywords: 'regalía,tributo,ley,535,parlamento,patrimonio,fiscal' },
  { parentId: 'mineria', nombre: 'Pasivos Ambientales Mineros', slug: 'min-pasivos-ambientales', icono: '☠️', color: '#ef4444', orden: 8, dimension: 'conflicto', descripcion: 'Presas de relaves activas/abandonadas, riesgo de falla, contaminación hídrica', keywords: 'relave,presa,contaminación,agua,pasivo,ambiental,Potosí,riesgo' },

  // ─── Economía ──────────────────────────────────────────────
  { parentId: 'economia', nombre: 'Tipo de Cambio', slug: 'eco-tipo-cambio', icono: '💲', color: '#10b981', orden: 1, dimension: 'precio', descripcion: 'Tipo de cambio oficial BCB y paralelo, brecha cambiaria', keywords: 'tipo de cambio,dólar,oficial,paralelo,brecha,BCB,devaluación' },
  { parentId: 'economia', nombre: 'Reservas Internacionales', slug: 'eco-reservas', icono: '🏦', color: '#10b981', orden: 2, dimension: 'produccion', descripcion: 'Evolución de RIN, nivel de reservas, cobertura de importaciones', keywords: 'reservas,RIN,divisas,BCB,cobertura,importaciones' },
  { parentId: 'economia', nombre: 'Inflación', slug: 'eco-inflacion', icono: '📈', color: '#10b981', orden: 3, dimension: 'precio', descripcion: 'IPC, inflación mensual y acumulada, canasta familiar', keywords: 'inflación,IPC,canasta,familiar,precio,alimentos' },
  { parentId: 'economia', nombre: 'Presupuesto Fiscal', slug: 'eco-presupuesto', icono: '📋', color: '#3b82f6', orden: 4, dimension: 'regulacion', descripcion: 'Ejecución presupuestaria, déficit fiscal, financiamiento del TGN', keywords: 'presupuesto,déficit,TGN,financiamiento,gasto,fiscal' },

  // ─── Organizaciones Sociales y Movilización (interna) ─────────
  // NOTA: Este sub-eje NO se expone como eje principal. Las organizaciones sociales
  // se clasifican dentro de Gobierno/Oposición (dinámica política) o como actores
  // contextuales dentro del eje temático correspondiente al conflicto.
  // Se mantiene como sub-clasificador interno para queries administrativas.
  { parentId: 'gobierno-oposicion', nombre: 'Organizaciones Sociales y Movilización', slug: 'go-organizaciones-sociales', icono: '🤝', color: '#f59e0b', orden: 4, dimension: 'regulacion', descripcion: 'COB, CSUTCB, CSCB, CONAMAQ, FNMCB, organizaciones indígenas y campesinas, comités cívicos, movilizaciones sectoriales', keywords: 'COB,CSUTCB,CSCB,CONAMAQ,FNMCB,sindicato,campesino,indígena,comité cívico,central obrera,movilización' },

  // ─── Gobierno, Oposición e Instituciones ───────────────────
  { parentId: 'gobierno-oposicion', nombre: 'Actividad Legislativa', slug: 'go-actividad-legislativa', icono: '📜', color: '#3b82f6', orden: 1, dimension: 'regulacion', descripcion: 'Proyectos de ley, votaciones, sesiones de la Asamblea, comisiones', keywords: 'ley,proyecto,Asamblea,votación,sesión,comisión,diputado,senador' },
  { parentId: 'gobierno-oposicion', nombre: 'Gestión Ejecutiva', slug: 'go-gestion-ejecutiva', icono: '🏛️', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Decretos, resoluciones, acciones del Poder Ejecutivo, gabinete ministerial', keywords: 'decreto,resolución,ministro,gabinete,Ejecutivo,presidente' },
  { parentId: 'gobierno-oposicion', nombre: 'Bancadas y Partidos', slug: 'go-bancadas', icono: '🗳️', color: '#3b82f6', orden: 3, dimension: 'regulacion', descripcion: 'Dinámica de bancadas, alianzas, posiciones de partidos políticos', keywords: 'bancada,partido,alianza,oposición,MAS,CC,frente' },

  // ─── Corrupción e Impunidad ────────────────────────────────
  { parentId: 'corrupcion-impunidad', nombre: 'Denuncias y Casos', slug: 'ci-denuncias', icono: '🔍', color: '#dc2626', orden: 1, dimension: 'conflicto', descripcion: 'Denuncias de corrupción, casos judiciales, nombres involucrados', keywords: 'denuncia,corrupción,caso,Fiscalía,auditoría,irregularidad' },
  { parentId: 'corrupcion-impunidad', nombre: 'Instituciones de Control', slug: 'ci-instituciones-control', icono: '⚖️', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Fiscalía, Contraloría, Ministerio Público, comisiones de investigación', keywords: 'Fiscalía,Contraloría,Ministerio Público,comisión,investigación,control' },

  // ─── Justicia y Derechos Humanos ───────────────────────────
  { parentId: 'justicia-derechos', nombre: 'Sistema Judicial', slug: 'jd-sistema-judicial', icono: '⚖️', color: '#6366f1', orden: 1, dimension: 'regulacion', descripcion: 'Sentencias, procesos judiciales, Tribunal Supremo, Tribunales Departamentales', keywords: 'sentencia,proceso,judicial,Tribunal,fallo,juez' },
  { parentId: 'justicia-derechos', nombre: 'Derechos Humanos', slug: 'jd-derechos-humanos', icono: '🕊️', color: '#6366f1', orden: 2, dimension: 'conflicto', descripcion: 'Violaciones de derechos humanos, justicia indígena, DDHH', keywords: 'derechos humanos,violación,indígena,justicia,DDHH,TCP' },

  // ─── Medio Ambiente ────────────────────────────────────────
  { parentId: 'medio-ambiente', nombre: 'Incendios Forestales', slug: 'ma-incendios', icono: '🔥', color: '#ef4444', orden: 1, dimension: 'conflicto', descripcion: 'Quemas, incendios forestales, deforestación, puntos de calor', keywords: 'incendio,quema,deforestación,punto de calor,chapa,Amazonía,Chiquitanía' },
  { parentId: 'medio-ambiente', nombre: 'Recursos Hídricos', slug: 'ma-recursos-hidricos', icono: '💧', color: '#0ea5e9', orden: 2, dimension: 'produccion', descripcion: 'Disponibilidad de agua, sequías, contaminación de ríos, glaciers', keywords: 'agua,sequía,contaminación,río,glaciar,acuífero,deshielo' },
  { parentId: 'medio-ambiente', nombre: 'Minería y Contaminación', slug: 'ma-mineria-contaminacion', icono: '☠️', color: '#ef4444', orden: 3, dimension: 'conflicto', descripcion: 'Impacto ambiental de la minería, relaves, mercurio, pasivos ambientales', keywords: 'relave,mercurio,contaminación,minería,pasivo,ambiental,río' },

  // ─── Seguridad Ciudadana ──────────────────────────────────
  { parentId: 'seguridad-ciudadana', nombre: 'Delitos y Denuncias', slug: 'sc-delitos', icono: '🔍', color: '#b91c1c', orden: 1, dimension: 'conflicto', descripcion: 'Delitos comunes, denuncias policiales, estadísticas delictivas. REGLA: siempre enmarcar en contexto institucional, nunca criminalizar organizaciones sociales', keywords: 'delito,asalto,robo,homicidio,denuncia,FELCC,investigación,estadística delictiva' },
  { parentId: 'seguridad-ciudadana', nombre: 'Fuerza Policial y Operativos', slug: 'sc-policia', icono: '👮', color: '#b91c1c', orden: 2, dimension: 'regulacion', descripcion: 'Operativos policiales, despliegue de fuerza, reformas al sistema policial', keywords: 'policía,operativo,despliegue,comando,FELCC,antinarcóticos,uniformado' },
  { parentId: 'seguridad-ciudadana', nombre: 'Sistema Penitenciario', slug: 'sc-penitenciario', icono: '🏢', color: '#b91c1c', orden: 3, dimension: 'infraestructura', descripcion: 'Sistema carcelario, condiciones penitenciarias, amotinamientos, reforma penitenciaria', keywords: 'cárcel,penal,Palmasola,San Pedro,amotinamiento,hacinamiento,reforma penitenciaria' },
  { parentId: 'seguridad-ciudadana', nombre: 'Narcotráfico y Crimen Organizado', slug: 'sc-narcotrafico', icono: '🚨', color: '#7f1d1d', orden: 4, dimension: 'conflicto', descripcion: 'Narcotráfico, rutas ilícitas, crimen organizado, incautaciones. REGLA: distinguir entre narcomenudeo (social) y narcotráfico transnacional (seguridad nacional)', keywords: 'narcotráfico,coca,cocaína,incautación,ruta ilícita,cártel,droga,FELCN,antinarcóticos' },
  { parentId: 'seguridad-ciudadana', nombre: 'Violencia de Género y Derechos Vulnerables', slug: 'sc-violencia-genero', icono: '💜', color: '#9333ea', orden: 5, dimension: 'conflicto', descripcion: 'Feminicidios, violencia intrafamiliar, derechos de grupos vulnerables', keywords: 'feminicidio,violencia de género,intrafamiliar,niñez,adolescente,vulnerable' },

  // ─── Relaciones Internacionales ────────────────────────────
  { parentId: 'relaciones-internacionales', nombre: 'Comercio Exterior', slug: 'ri-comercio-exterior', icono: '🚢', color: '#0ea5e9', orden: 1, dimension: 'produccion', descripcion: 'Exportaciones e importaciones, socios comerciales, balanza comercial', keywords: 'exportación,importación,China,Brasil,Argentina,UE,balanza,FOB' },
  { parentId: 'relaciones-internacionales', nombre: 'Geopolítica y Tratados', slug: 'ri-geopolitica', icono: '🌐', color: '#3b82f6', orden: 2, dimension: 'regulacion', descripcion: 'Relaciones bilaterales, tratados, cooperación internacional, litigios fronterizos', keywords: 'tratado,cooperación,bilateral,frontera,Chile,mar,CIJ,OEA' },
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
      await db.ejeTematico.deleteMany();
    }

    // 1. Seed ejes temáticos (batch createMany)
    console.log('Seeding ejes temáticos...');
    const ejesResult = await db.ejeTematico.createMany({
      data: EJES_TEMATICOS,
      skipDuplicates: true,
    });

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
      message: `Seed ejecutado correctamente (v0.9.0) — ${force ? 'FORCE RESET' : 'nuevo'}`,
      ejesInsertados: ejesResult.count,
      subsInsertados: subsCreated,
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
    const [personas, medios, ejes, menciones] = await Promise.all([
      db.persona.count(),
      db.medio.count(),
      db.ejeTematico.count(),
      db.mencion.count(),
    ]);

    const diputados = await db.persona.count({ where: { camara: 'Diputados' } });
    const senadores = await db.persona.count({ where: { camara: 'Senadores' } });

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
      menciones,
      porPartido: personasPorPartido.map(p => ({ partido: p.partidoSigla, count: p._count.id })),
      porDepartamento: personasPorDepto.map(d => ({ departamento: d.departamento, count: d._count.id })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'seed') }, { status: 500 });
  }
}
