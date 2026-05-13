// Script: Insertar ejes v2, lentes y keywords
// DECODEX Bolivia — PASO 2C-2F
import Database from 'bun:sqlite';

const db = new Database('/home/z/my-project/prisma/db/custom.db');

// ═══ PASO 2C: Marcar ejes existentes como legacy ═══
console.log('=== PASO 2C: Marcando ejes legacy ===');
db.run("UPDATE EjeTematico SET tipo = 'legacy' WHERE tipo IS NULL OR tipo = ''");
const legacyCount = db.query("SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'legacy'").get();
console.log(`Ejes legacy: ${legacyCount.c}`);

// ═══ PASO 2D: Crear 9 ejes estructurales ═══
console.log('\n=== PASO 2D: Creando 9 ejes estructurales ===');

const ejes = [
  { nombre: 'Recursos Naturales y Modelo de Desarrollo', slug: 'recursos-naturales', descripcion: 'La disputa entre extractivismo y alternativas de desarrollo. Hidrocarburos, minería, agua, tierra, deforestación, soberanía alimentaria, derechos de la naturaleza.', orden: 1 },
  { nombre: 'Gobierno, Poder e Instituciones', slug: 'gobierno-instituciones', descripcion: 'La disputa por el ejercicio del poder estatal, legitimidad institucional, distribución de competencias, relación entre poderes.', orden: 2 },
  { nombre: 'Economía, Política Económica y Empleo', slug: 'economia', descripcion: 'La disputa por el modelo económico, distribución de la riqueza, política fiscal, monetaria y cambiaria, empleo.', orden: 3 },
  { nombre: 'Justicia, Derechos Humanos e Impunidad', slug: 'justicia-derechos', descripcion: 'La disputa por el acceso a la justicia, lucha contra la impunidad, derechos humanos, violencia de género.', orden: 4 },
  { nombre: 'Salud, Educación y Servicios Públicos', slug: 'salud-educacion', descripcion: 'La disputa por el acceso universal a servicios de calidad: salud, educación, agua potable, saneamiento, vivienda.', orden: 5 },
  { nombre: 'Geopolítica, Relaciones Internacionales y Soberanía', slug: 'geopolitica', descripcion: 'La disputa por la posición de Bolivia en el contexto internacional, relaciones bilaterales, bloques regionales.', orden: 6 },
  { nombre: 'Procesos Electorales y Democracia', slug: 'procesos-electorales', descripcion: 'La disputa por la legitimidad electoral, organización de elecciones, partidos políticos, representación.', orden: 7 },
  { nombre: 'Movilización Social y Acción Colectiva', slug: 'movilizacion-social', descripcion: 'La disputa por los derechos y límites de la movilización social como herramienta legítima de acción política. SOLO cuando la movilización ES el tema central.', orden: 8 },
  { nombre: 'Territorio, Población y Derechos Colectivos', slug: 'territorio-derechos', descripcion: 'La disputa por el territorio, identidad cultural, derechos de pueblos indígenas, relación entre población y Estado.', orden: 9 },
];

const ejeIds: Record<string, string> = {};

for (const eje of ejes) {
  const id = 'ev2-' + eje.slug;
  try {
    db.run("INSERT INTO EjeTematico (id, nombre, slug, descripcion, tipo, activo, orden) VALUES (?, ?, ?, ?, 'estructural', 1, ?)",
      [id, eje.nombre, eje.slug, eje.descripcion, eje.orden]);
    ejeIds[eje.slug] = id;
    console.log(`  ✓ ${eje.nombre} (${id})`);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      console.log(`  ⚠ ${eje.nombre} ya existe, obteniendo ID...`);
      const existing = db.query("SELECT id FROM EjeTematico WHERE slug = ?").get(eje.slug) as any;
      ejeIds[eje.slug] = existing.id;
    } else {
      console.error(`  ✗ Error insertando ${eje.nombre}:`, err.message);
    }
  }
}

console.log('\nEjes estructurales creados:', Object.keys(ejeIds).length);

// ═══ PASO 2E: Crear 9 lentes transversales ═══
console.log('\n=== PASO 2E: Creando 9 lentes transversales ===');

const lentes = [
  { nombre: 'Medio Ambiente', slug: 'medio-ambiente', descripcion: 'Captura toda noticia sobre medio ambiente, sin importar en qué eje se clasifique.' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', descripcion: 'Captura toda noticia sobre minería, sin importar si es estatal, cooperativa, mediana o transnacional.' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', descripcion: 'Captura toda noticia sobre corrupción, independientemente del sector o institución involucrada.' },
  { nombre: 'Movilización Social', slug: 'movilizacion-social', descripcion: 'Captura toda noticia donde la movilización, protesta, bloqueo, marcha o huelga sea la FORMA de acción (el CÓMO). No clasifica por QUÉ se movilizan, sino que marca que hay movilización.' },
  { nombre: 'Litio y Energía', slug: 'litio-energia', descripcion: 'Captura toda noticia sobre litio, baterías, energía renovable y geopolítica de recursos energéticos.' },
  { nombre: 'Pueblos Indígenas y Derechos Colectivos', slug: 'pueblos-indigenas', descripcion: 'Captura toda noticia donde pueblos indígenas, originarios o campesinos sean actores centrales o donde se debatan sus derechos.' },
  { nombre: 'Género y Diversidad', slug: 'genero-diversidad', descripcion: 'Captura toda noticia con perspectiva de género, violencia de género, derechos de la diversidad sexual.' },
  { nombre: 'Hidrocarburos', slug: 'hidrocarburos', descripcion: 'Captura toda noticia sobre gas, petróleo, YPFB, oleoductos y la industria hidrocarburífera.' },
  { nombre: 'Café y Economías Regionales', slug: 'cafe-economicas-regionales', descripcion: 'Captura toda noticia sobre café de especialidad, economías regionales, producción campesina y cadenas productivas.' },
];

const lenteIds: Record<string, string> = {};

for (const lente of lentes) {
  const id = 'lv2-' + lente.slug;
  try {
    db.run("INSERT INTO Lente (id, nombre, slug, descripcion, activo, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))",
      [id, lente.nombre, lente.slug, lente.descripcion]);
    lenteIds[lente.slug] = id;
    console.log(`  ✓ ${lente.nombre} (${id})`);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      console.log(`  ⚠ ${lente.nombre} ya existe, obteniendo ID...`);
      const existing = db.query("SELECT id FROM Lente WHERE slug = ?").get(lente.slug) as any;
      lenteIds[lente.slug] = existing.id;
    } else {
      console.error(`  ✗ Error insertando ${lente.nombre}:`, err.message);
    }
  }
}

console.log('\nLentes creados:', Object.keys(lenteIds).length);

// ═══ PASO 2F: Insertar Keywords ═══
console.log('\n=== PASO 2F: Insertando keywords ===');

// Keywords por EJE
const keywordsEjes: Record<string, string[]> = {
  'recursos-naturales': [
    'hidrocarburos', 'gas natural', 'petróleo', 'YPFB', 'oleoducto', 'gasoducto',
    'minería', 'minero', 'COMIBOL', 'cooperativa minera', 'concesión minera', 'regalías',
    'agua', 'deforestación', 'incendio forestal', 'tierra', 'territorio', 'TCO',
    'reforma agraria', 'soberanía alimentaria', 'Vivir Bien', 'derechos de la naturaleza',
    'extractivismo', 'transición energética', 'litio', 'recursos naturales', 'medio ambiente',
    'amazonía', 'reserva forestal', 'parque nacional', 'área protegida', 'contaminación'
  ],
  'gobierno-instituciones': [
    'gobierno', 'presidente', 'vicepresidente', 'ministerio', 'viceministerio',
    'asamblea legislativa', 'diputado', 'senador', 'ley', 'decreto', 'resolución',
    'poder judicial', 'tribunal supremo', 'tribunal constitucional', 'fiscalía',
    'contraloría', 'defensoría', 'TSE', 'órgano electoral', 'gobernación', 'alcalde',
    'concejo municipal', 'autonomía', 'institución', 'reforma institucional'
  ],
  'economia': [
    'economía', 'PIB', 'inflación', 'dólar', 'tipo de cambio', 'presupuesto', 'impuesto',
    'gasto público', 'empleo', 'desempleo', 'informalidad', 'salario', 'pensión', 'bono',
    'exportación', 'importación', 'inversión', 'banco', 'crédito', 'FMI', 'Banco Mundial',
    'crecimiento económico', 'política económica', 'dolarización', 'reserva internacional'
  ],
  'justicia-derechos': [
    'corrupción', 'corrupto', 'soborno', 'coima', 'delito', 'denuncia', 'investigación',
    'sentencia', 'condena', 'prisión', 'detención', 'derechos humanos', 'tortura',
    'feminicidio', 'violencia de género', 'justicia indígena', 'preso político',
    'persecución', 'impunidad', 'fiscal', 'juez', 'policía', 'debido proceso',
    'libertad de expresión', 'libertad de prensa'
  ],
  'salud-educacion': [
    'salud', 'hospital', 'médico', 'enfermera', 'medicamento', 'seguro de salud',
    'educación', 'escuela', 'colegio', 'universidad', 'maestro', 'profesor', 'estudiante',
    'magisterio', 'agua potable', 'saneamiento', 'vivienda', 'infraestructura',
    'huelga de médicos', 'huelga de maestros', 'pandemia', 'vacuna', 'déficit', 'insumo',
    'presupuesto universidad', 'autonomía universitaria'
  ],
  'geopolitica': [
    'relaciones internacionales', 'geopolítica', 'frontera', 'mar', 'soberanía',
    'diplomacia', 'embajada', 'tratado', 'acuerdo comercial', 'UNASUR', 'CELAC',
    'Mercosur', 'OEA', 'ONU', 'CIDH', 'EEUU', 'China', 'Rusia', 'Unión Europea',
    'migración', 'migrante', 'refugiado', 'bloque regional', 'política exterior', 'diplomático'
  ],
  'procesos-electorales': [
    'elecciones', 'elección', 'voto', 'elector', 'candidato', 'presidencial',
    'legislativa', 'municipal', 'departamental', 'TSE', 'tribunal electoral',
    'partido político', 'coalición', 'campaña electoral', 'urna', 'resultado electoral',
    'conteo', 'denuncia electoral', 'fraude', 'referéndum', 'consulta popular',
    'revocatoria', 'democracia', 'registro electoral'
  ],
  'movilizacion-social': [
    'derecho a protestar', 'represión', 'fuerza policial', 'gas pimienta', 'antidisturbios',
    'detención de dirigentes', 'criminalización de la protesta', 'bloqueo de carreteras',
    'paro cívico', 'huelga general', 'tipificación penal de protesta', 'libertad de reunión',
    'derecho de reunión', 'movilización social', 'persecución a líderes sociales'
  ],
  'territorio-derechos': [
    'pueblo indígena', 'originario', 'campesino', 'guaraní', 'aymara', 'quechua',
    'mojeño', 'chimán', 'tupí guaraní', 'derechos colectivos', 'autonomía indígena',
    'consulta previa', 'territorio comunitario', 'TCO', 'tierras comunitarias',
    'interculturalidad', 'identidad cultural', 'patrimonio cultural', 'racismo',
    'discriminación', 'censo', 'población', 'demografía', 'migración interna',
    'urbanización', 'nación indígena'
  ],
};

// Keywords por LENTE
const keywordsLentes: Record<string, string[]> = {
  'medio-ambiente': [
    'deforestación', 'incendios', 'cambio climático', 'COP', 'Pachamama', 'biodiversidad',
    'contaminación', 'contaminación ambiental', 'contaminación del agua', 'contaminación del aire',
    'medio ambiente', 'amazonía', 'reserva forestal', 'parque nacional', 'área protegida',
    'desertificación', 'sequía', 'inundación', 'agenda climática', 'acuerdos de Paris',
    'carbono', 'emisiones', 'efecto invernadero', 'basura', 'residuos', 'reciclaje'
  ],
  'mineria': [
    'minería', 'minero', 'COMIBOL', 'cooperativa minera', 'Huanuni', 'Colquiri',
    'San Cristóbal', 'San Bartolomé', 'estaño', 'zinc', 'plata', 'plomo', 'oro',
    'antimonio', 'wolframio', 'relaves', 'pasivo ambiental', 'regalías mineras',
    'concesión minera', 'SENARECOM', 'accidente minero', 'derrumbe', 'minería mediana',
    'transnacional minera', 'metales críticos', 'geopolítica minera', 'contratos mineros',
    'Summit', 'Sumitomo', 'indio', 'cadmio'
  ],
  'corrupcion-impunidad': [
    'corrupción', 'corrupto', 'soborno', 'coima', 'desvío de fondos',
    'enriquecimiento ilícito', 'narcotráfico', 'lavado de dinero', 'tráfico de influencias',
    'colusión', 'soborno transnacional', 'red de corrupción', 'caso de corrupción',
    'denuncia por corrupción', 'investigación por corrupción'
  ],
  'movilizacion-social': [
    'bloqueo', 'bloqueo de carretera', 'bloqueo de ruta', 'marcha', 'paro', 'huelga',
    'paro cívico', 'protesta', 'manifestación', 'movilización', 'pickete', 'vigilia',
    'toma de institución', 'cerco', 'conflicto social', 'medición', 'amotinamiento',
    'paro de transporte', 'paro de actividades', 'cierre de frontera', 'cierre de camino'
  ],
  'litio-energia': [
    'litio', 'baterías', 'batería de ion litio', 'salar de Uyuni', 'salar de Coipasa',
    'planta de litio', 'YLB', 'energía solar', 'energía eólica', 'energía renovable',
    'hidrógeno verde', 'electromovilidad', 'transición energética', 'matriz energética',
    'recurso estratégico', 'minerales críticos', 'tierras raras'
  ],
  'pueblos-indigenas': [
    'pueblo indígena', 'pueblo originario', 'nación indígena', 'guaraní', 'aymara',
    'quechua', 'mojeño', 'chimán', 'tupí guaraní', 'tierra baja', 'tierras altas',
    'comunidad indígena', 'organización indígena', 'CIDOB', 'CONAMAQ', 'CSUTCB',
    'FSUTCB', 'CONALCAM', 'cabildo indígena', 'marcha indígena', 'territorio indígena',
    'consulta previa', 'libre determinación', 'autonomía indígena'
  ],
  'genero-diversidad': [
    'feminicidio', 'violencia de género', 'violencia contra la mujer', 'machismo',
    'patriarcado', 'mujeres', 'brecha de género', 'igualdad de género',
    'participación política de mujeres', 'diversidad sexual', 'LGBT', 'LGBTQ+',
    'comunidad diversidad', 'trans', 'no binario', 'identidad de género'
  ],
  'hidrocarburos': [
    'hidrocarburos', 'gas natural', 'gas licuado', 'petróleo', 'YPFB', 'oleoducto',
    'gasoducto', 'planta de separación', 'planta de tratamiento', 'gasolinera', 'gasolina',
    'diésel', 'GLP', 'subsidio a combustibles', 'gasolina basura', 'precio de combustibles',
    'exportación de gas', 'importación de diésel', 'reservas de gas', 'campos gasíferos',
    'Vaca Diez', 'Margarita', 'Itaú', 'San Alberto', 'Carrasco'
  ],
  'cafe-economicas-regionales': [
    'café de especialidad', 'café boliviano', 'grano verde', 'torrefacción', 'cata',
    'fermentación', 'C-market', 'CENAPROC', 'COAINE', 'cooperativa cafetera',
    'productor de café', 'cafetería', 'café de altura', 'café orgánico',
    'certificación fitosanitaria', 'exportación de café', 'SENASAG café', 'IBCE café',
    'Yungas café', 'Caranavi café', 'economía regional', 'cadena productiva',
    'feria café', 'Cup of Excellence'
  ],
};

let totalKeywords = 0;
let kwEjeCount = 0;
let kwLenteCount = 0;
let kwDuplicateCount = 0;
const kwInsert = db.prepare("INSERT INTO Keyword (id, termino, ejeId, lenteId, activo, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))");

// Insertar keywords de EJES
for (const [slug, keywords] of Object.entries(keywordsEjes)) {
  const ejeId = ejeIds[slug];
  if (!ejeId) { console.error(`  ✗ No ejeId para ${slug}`); continue; }
  for (const kw of keywords) {
    const id = `kw-e-${slug}-${kw.replace(/\s+/g, '-').substring(0, 30)}`;
    try {
      kwInsert.run(id, kw, ejeId, null);
      kwEjeCount++;
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) kwDuplicateCount++;
    }
    totalKeywords++;
  }
}

// Insertar keywords de LENTES
for (const [slug, keywords] of Object.entries(keywordsLentes)) {
  const lenteId = lenteIds[slug];
  if (!lenteId) { console.error(`  ✗ No lenteId para ${slug}`); continue; }
  for (const kw of keywords) {
    const id = `kw-l-${slug}-${kw.replace(/\s+/g, '-').substring(0, 30)}`;
    try {
      kwInsert.run(id, kw, null, lenteId);
      kwLenteCount++;
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) kwDuplicateCount++;
    }
    totalKeywords++;
  }
}

console.log(`\nKeywords insertadas:`);
console.log(`  Ejes: ${kwEjeCount}`);
console.log(`  Lentes: ${kwLenteCount}`);
console.log(`  Duplicados saltados: ${kwDuplicateCount}`);
console.log(`  Total procesadas: ${totalKeywords}`);

// ═══ VERIFICACIÓN ═══
console.log('\n=== VERIFICACIÓN FINAL ===');
const ejesStruct = db.query("SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'estructural'").get() as any;
const ejesLegacy = db.query("SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'legacy'").get() as any;
const lentesCount = db.query("SELECT COUNT(*) as c FROM Lente").get() as any;
const kwCount = db.query("SELECT COUNT(*) as c FROM Keyword").get() as any;

console.log(`Ejes estructurales: ${ejesStruct.c}`);
console.log(`Ejes legacy: ${ejesLegacy.c}`);
console.log(`Lentes: ${lentesCount.c}`);
console.log(`Keywords totales: ${kwCount.c}`);

// Show distribution of keywords by entity
console.log('\n--- Keywords por Eje ---');
for (const [slug, id] of Object.entries(ejeIds)) {
  const count = db.query("SELECT COUNT(*) as c FROM Keyword WHERE ejeId = ?", [id]).get() as any;
  console.log(`  ${slug}: ${count.c} keywords`);
}

console.log('\n--- Keywords por Lente ---');
for (const [slug, id] of Object.entries(lenteIds)) {
  const count = db.query("SELECT COUNT(*) as c FROM Keyword WHERE lenteId = ?", [id]).get() as any;
  console.log(`  ${slug}: ${count.c} keywords`);
}

db.close();
console.log('\n✅ PASO 2 completado.');
