// Script: PASO 2 completo — Crear ejes v2, lentes, keywords en DB canónica
import Database from 'bun:sqlite';

const DB_PATH = '/home/z/my-project/prisma/db/custom.db';
const db = new Database(DB_PATH);

// ═══ 2A: Schema changes ═══
console.log('=== 2A: Schema changes ===');
db.run(\"ALTER TABLE EjeTematico ADD COLUMN tipo TEXT DEFAULT 'legacy'\");
console.log('  ✓ Added EjeTematico.tipo');
db.run('ALTER TABLE Mencion ADD COLUMN ejeEstructuralId TEXT');
console.log('  ✓ Added Mencion.ejeEstructuralId');
db.run('CREATE INDEX IF NOT EXISTS idx_Mencion_ejeEstructural ON Mencion(ejeEstructuralId)');
console.log('  ✓ Index on ejeEstructuralId');

db.run(`CREATE TABLE IF NOT EXISTS Lente (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descripcion TEXT DEFAULT '',
  activo INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`);
console.log('  ✓ Table Lente');

db.run(`CREATE TABLE IF NOT EXISTS Keyword (
  id TEXT PRIMARY KEY,
  termino TEXT NOT NULL,
  lenteId TEXT,
  ejeId TEXT,
  activo INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`);
console.log('  ✓ Table Keyword');

db.run(`CREATE TABLE IF NOT EXISTS MencionLente (
  id TEXT PRIMARY KEY,
  mencionId TEXT NOT NULL,
  lenteId TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(mencionId, lenteId)
)`);
console.log('  ✓ Table MencionLente');

// ═══ 2C: Mark existing ejes as legacy ═══
console.log('\n=== 2C: Mark legacy ejes ===');
db.run("UPDATE EjeTematico SET tipo = 'legacy' WHERE tipo IS NULL OR tipo = ''");
const legacy = db.query("SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'legacy'").get() as any;
console.log(`  Legacy ejes: ${legacy.c}`);

// ═══ 2D: Create 9 structural ejes ═══
console.log('\n=== 2D: Create 9 structural ejes ===');
const ejes = [
  { nombre: 'Recursos Naturales y Modelo de Desarrollo', slug: 'recursos-naturales', orden: 1 },
  { nombre: 'Gobierno, Poder e Instituciones', slug: 'gobierno-instituciones', orden: 2 },
  { nombre: 'Economía, Política Económica y Empleo', slug: 'v2-economia', orden: 3 },
  { nombre: 'Justicia, Derechos Humanos e Impunidad', slug: 'v2-justicia-derechos', orden: 4 },
  { nombre: 'Salud, Educación y Servicios Públicos', slug: 'salud-educacion', orden: 5 },
  { nombre: 'Geopolítica, Relaciones Internacionales y Soberanía', slug: 'geopolitica', orden: 6 },
  { nombre: 'Procesos Electorales y Democracia', slug: 'v2-procesos-electorales', orden: 7 },
  { nombre: 'Movilización Social y Acción Colectiva', slug: 'movilizacion-social', orden: 8 },
  { nombre: 'Territorio, Población y Derechos Colectivos', slug: 'territorio-derechos', orden: 9 },
];

const ejeIds: Record<string, string> = {};
for (const e of ejes) {
  const id = `ev2-${e.slug}`;
  db.run("INSERT OR IGNORE INTO EjeTematico (id, nombre, slug, tipo, activo, orden) VALUES (?, ?, ?, 'estructural', 1, ?)",
    [id, e.nombre, e.slug, e.orden]);
  ejeIds[e.slug] = id;
  console.log(`  ✓ ${e.nombre} → ${id}`);
}

// ═══ 2E: Create 9 lenses ═══
console.log('\n=== 2E: Create 9 lenses ===');
const lentes = [
  { nombre: 'Medio Ambiente', slug: 'medio-ambiente', desc: 'Captura toda noticia sobre medio ambiente' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', desc: 'Captura toda noticia sobre minería' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', desc: 'Captura toda noticia sobre corrupción' },
  { nombre: 'Movilización Social', slug: 'movilizacion-social', desc: 'Forma de acción: bloqueo, marcha, paro, huelga' },
  { nombre: 'Litio y Energía', slug: 'litio-energia', desc: 'Litio, baterías, energía renovable' },
  { nombre: 'Pueblos Indígenas y Derechos Colectivos', slug: 'pueblos-indigenas', desc: 'Pueblos indígenas y derechos colectivos' },
  { nombre: 'Género y Diversidad', slug: 'genero-diversidad', desc: 'Perspectiva de género y diversidad sexual' },
  { nombre: 'Hidrocarburos', slug: 'hidrocarburos', desc: 'Gas, petróleo, YPFB, industria hidrocarburífera' },
  { nombre: 'Café y Economías Regionales', slug: 'cafe-economicas-regionales', desc: 'Café de especialidad y economías regionales' },
];

const lenteIds: Record<string, string> = {};
for (const l of lentes) {
  const id = `lv2-${l.slug}`;
  db.run("INSERT OR IGNORE INTO Lente (id, nombre, slug, descripcion, activo) VALUES (?, ?, ?, ?, 1)",
    [id, l.nombre, l.slug, l.desc]);
  lenteIds[l.slug] = id;
  console.log(`  ✓ ${l.nombre} → ${id}`);
}

// ═══ 2F: Insert keywords ═══
console.log('\n=== 2F: Insert keywords ===');

const kwEjes: Record<string, string[]> = {
  'recursos-naturales': ['hidrocarburos','gas natural','petróleo','YPFB','oleoducto','gasoducto','minería','minero','COMIBOL','cooperativa minera','concesión minera','regalías','agua','deforestación','incendio forestal','tierra','territorio','TCO','reforma agraria','soberanía alimentaria','Vivir Bien','derechos de la naturaleza','extractivismo','transición energética','litio','recursos naturales','medio ambiente','amazonía','reserva forestal','parque nacional','área protegida','contaminación'],
  'gobierno-instituciones': ['gobierno','presidente','vicepresidente','ministerio','viceministerio','asamblea legislativa','diputado','senador','ley','decreto','resolución','poder judicial','tribunal supremo','tribunal constitucional','fiscalía','contraloría','defensoría','TSE','órgano electoral','gobernación','alcalde','concejo municipal','autonomía','institución','reforma institucional'],
  'v2-economia': ['economía','PIB','inflación','dólar','tipo de cambio','presupuesto','impuesto','gasto público','empleo','desempleo','informalidad','salario','pensión','bono','exportación','importación','inversión','banco','crédito','FMI','Banco Mundial','crecimiento económico','política económica','dolarización','reserva internacional'],
  'v2-justicia-derechos': ['corrupción','corrupto','soborno','coima','delito','denuncia','investigación','sentencia','condena','prisión','detención','derechos humanos','tortura','feminicidio','violencia de género','justicia indígena','preso político','persecución','impunidad','fiscal','juez','policía','debido proceso','libertad de expresión','libertad de prensa'],
  'salud-educacion': ['salud','hospital','médico','enfermera','medicamento','seguro de salud','educación','escuela','colegio','universidad','maestro','profesor','estudiante','magisterio','agua potable','saneamiento','vivienda','infraestructura','huelga de médicos','huelga de maestros','pandemia','vacuna','déficit','insumo','autonomía universitaria'],
  'geopolitica': ['relaciones internacionales','geopolítica','frontera','mar','soberanía','diplomacia','embajada','tratado','acuerdo comercial','UNASUR','CELAC','Mercosur','OEA','ONU','CIDH','EEUU','China','Rusia','Unión Europea','migración','migrante','refugiado','bloque regional','política exterior','diplomático'],
  'v2-procesos-electorales': ['elecciones','elección','voto','elector','candidato','presidencial','legislativa','municipal','departamental','tribunal electoral','partido político','coalición','campaña electoral','urna','resultado electoral','conteo','denuncia electoral','fraude','referéndum','consulta popular','revocatoria','democracia','registro electoral'],
  'movilizacion-social': ['derecho a protestar','represión','fuerza policial','gas pimienta','antidisturbios','detención de dirigentes','criminalización de la protesta','tipificación penal de protesta','libertad de reunión','derecho de reunión','movilización social','persecución a líderes sociales'],
  'territorio-derechos': ['pueblo indígena','originario','campesino','guaraní','aymara','quechua','mojeño','chimán','tupí guaraní','derechos colectivos','autonomía indígena','consulta previa','territorio comunitario','tierras comunitarias','interculturalidad','identidad cultural','patrimonio cultural','racismo','discriminación','censo','población','demografía','migración interna','urbanización','nación indígena'],
};

const kwLentes: Record<string, string[]> = {
  'medio-ambiente': ['deforestación','incendios','cambio climático','COP','Pachamama','biodiversidad','contaminación ambiental','contaminación del agua','contaminación del aire','medio ambiente','amazonía','reserva forestal','parque nacional','área protegida','desertificación','sequía','inundación','agenda climática','carbono','emisiones','efecto invernadero','basura','residuos','reciclaje'],
  'mineria': ['minería','minero','COMIBOL','cooperativa minera','Huanuni','Colquiri','San Cristóbal','San Bartolomé','estaño','zinc','plata','plomo','oro','antimonio','wolframio','relaves','pasivo ambiental','regalías mineras','concesión minera','SENARECOM','accidente minero','derrumbe','minería mediana','transnacional minera','metales críticos','geopolítica minera','contratos mineros','Sumitomo','cadmio'],
  'corrupcion-impunidad': ['corrupción','corrupto','soborno','coima','desvío de fondos','enriquecimiento ilícito','narcotráfico','lavado de dinero','tráfico de influencias','colusión','red de corrupción','caso de corrupción','denuncia por corrupción','investigación por corrupción'],
  'movilizacion-social': ['bloqueo','bloqueo de carretera','bloqueo de ruta','marcha','paro','huelga','paro cívico','protesta','manifestación','movilización','pickete','vigilia','toma de institución','cerco','conflicto social','amotinamiento','paro de transporte','paro de actividades','cierre de frontera','cierre de camino'],
  'litio-energia': ['litio','baterías','batería de ion litio','salar de Uyuni','salar de Coipasa','planta de litio','YLB','energía solar','energía eólica','energía renovable','hidrógeno verde','electromovilidad','transición energética','matriz energética','recurso estratégico','minerales críticos','tierras raras'],
  'pueblos-indigenas': ['pueblo indígena','pueblo originario','nación indígena','guaraní','aymara','quechua','mojeño','chimán','tupí guaraní','tierra baja','tierras altas','comunidad indígena','organización indígena','CIDOB','CONAMAQ','CSUTCB','FSUTCB','CONALCAM','cabildo indígena','marcha indígena','territorio indígena','consulta previa','libre determinación','autonomía indígena'],
  'genero-diversidad': ['feminicidio','violencia de género','violencia contra la mujer','machismo','patriarcado','mujeres','brecha de género','igualdad de género','participación política de mujeres','diversidad sexual','LGBT','LGBTQ+','comunidad diversidad','trans','no binario','identidad de género'],
  'hidrocarburos': ['hidrocarburos','gas natural','gas licuado','petróleo','YPFB','oleoducto','gasoducto','planta de separación','planta de tratamiento','gasolinera','gasolina','diésel','GLP','subsidio a combustibles','gasolina basura','precio de combustibles','exportación de gas','importación de diésel','reservas de gas','campos gasíferos','Vaca Diez','Margarita','Itaú','San Alberto','Carrasco'],
  'cafe-economicas-regionales': ['café de especialidad','café boliviano','grano verde','torrefacción','cata','fermentación','C-market','CENAPROC','COAINE','cooperativa cafetera','productor de café','cafetería','café de altura','café orgánico','certificación fitosanitaria','exportación de café','Yungas café','Caranavi café','economía regional','cadena productiva','feria café','Cup of Excellence'],
};

const insertKw = db.prepare('INSERT OR IGNORE INTO Keyword (id, termino, ejeId, lenteId) VALUES (?, ?, ?, ?)');
let kwE = 0, kwL = 0;

for (const [slug, kws] of Object.entries(kwEjes)) {
  const eid = ejeIds[slug]; if (!eid) continue;
  for (const kw of kws) {
    const safe = kw.replace(/\s+/g, '-').substring(0, 40).toLowerCase();
    insertKw.run(`kwe-${slug}-${safe}`, kw, eid, null);
    kwE++;
  }
}

for (const [slug, kws] of Object.entries(kwLentes)) {
  const lid = lenteIds[slug]; if (!lid) continue;
  for (const kw of kws) {
    const safe = kw.replace(/\s+/g, '-').substring(0, 40).toLowerCase();
    insertKw.run(`kwl-${slug}-${safe}`, kw, null, lid);
    kwL++;
  }
}

console.log(`  Keywords ejes: ${kwE}`);
console.log(`  Keywords lentes: ${kwL}`);

// ═══ VERIFY ═══
console.log('\n=== VERIFICATION ===');
for (const [slug, id] of Object.entries(ejeIds)) {
  const c = db.query('SELECT COUNT(*) as c FROM Keyword WHERE ejeId = ?', [id]).get() as any;
  console.log(`  Eje ${slug}: ${c.c} kw`);
}
for (const [slug, id] of Object.entries(lenteIds)) {
  const c = db.query('SELECT COUNT(*) as c FROM Keyword WHERE lenteId = ?', [id]).get() as any;
  console.log(`  Lente ${slug}: ${c.c} kw`);
}

const totalKw = db.query('SELECT COUNT(*) as c FROM Keyword').get() as any;
const totalEjes = db.query("SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'estructural'").get() as any;
const totalLentes = db.query('SELECT COUNT(*) as c FROM Lente').get() as any;

console.log(`\n  TOTAL: ${totalEjes.c} ejes | ${totalLentes.c} lentes | ${totalKw.c} keywords`);

db.close();
console.log('\n✅ PASO 2 COMPLETADO en DB canónica');
