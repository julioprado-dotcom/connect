// Script: PASO 2 completo — Ejes v2 en DB canónica
import Database from 'bun:sqlite';

const DB_PATH = '/home/z/my-project/prisma/db/custom.db';
const db = new Database(DB_PATH);
const Q = (s: string) => s; // identity for readability

// ═══ 2A: Schema changes ═══
console.log('=== 2A: Schema changes ===');
try { db.run(`ALTER TABLE EjeTematico ADD COLUMN tipo TEXT DEFAULT 'legacy'`); console.log('  + EjeTematico.tipo'); } catch(e: any) { console.log('  . tipo already exists'); }
try { db.run('ALTER TABLE Mencion ADD COLUMN ejeEstructuralId TEXT'); console.log('  + Mencion.ejeEstructuralId'); } catch(e: any) { console.log('  . ejeEstructuralId already exists'); }
db.run('CREATE INDEX IF NOT EXISTS idx_Mencion_eje_estruct ON Mencion(ejeEstructuralId)');

db.run(`CREATE TABLE IF NOT EXISTS Lente (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  descripcion TEXT DEFAULT '', activo INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`);
console.log('  + Lente');

db.run(`CREATE TABLE IF NOT EXISTS Keyword (
  id TEXT PRIMARY KEY, termino TEXT NOT NULL, lenteId TEXT, ejeId TEXT,
  activo INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
)`);
console.log('  + Keyword');

db.run(`CREATE TABLE IF NOT EXISTS MencionLente (
  id TEXT PRIMARY KEY, mencionId TEXT NOT NULL, lenteId TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')), UNIQUE(mencionId, lenteId)
)`);
console.log('  + MencionLente');

// ═══ 2C: Mark legacy ═══
db.run(`UPDATE EjeTematico SET tipo = 'legacy' WHERE tipo IS NULL OR tipo = ''`);
const legacy = (db.query(`SELECT COUNT(*) as c FROM EjeTematico WHERE tipo = 'legacy'`).get() as any).c;
console.log(`\n  Legacy ejes: ${legacy}`);

// ═══ 2D: Create 9 structural ejes ═══
console.log('\n=== 2D: 9 Structural Ejes ===');
const ejes = [
  ['Recursos Naturales y Modelo de Desarrollo','recursos-naturales',1],
  ['Gobierno, Poder e Instituciones','gobierno-instituciones',2],
  ['Economia, Politica Economica y Empleo','v2-economia',3],
  ['Justicia, Derechos Humanos e Impunidad','v2-justicia-derechos',4],
  ['Salud, Educacion y Servicios Publicos','salud-educacion',5],
  ['Geopolitica, Relaciones Internacionales y Soberania','geopolitica',6],
  ['Procesos Electorales y Democracia','v2-procesos-electorales',7],
  ['Movilizacion Social y Accion Colectiva','movilizacion-social',8],
  ['Territorio, Poblacion y Derechos Colectivos','territorio-derechos',9],
];

const ejeIds: Record<string,string> = {};
for (const [nombre, slug, orden] of ejes) {
  const id = `ev2-${slug}`;
  db.run(`INSERT OR IGNORE INTO EjeTematico (id, nombre, slug, tipo, activo, orden) VALUES ('${id}','${nombre}','${slug}','estructural',1,${orden})`);
  ejeIds[slug] = id;
  console.log(`  + ${nombre} (${id})`);
}

// ═══ 2E: Create 9 lenses ═══
console.log('\n=== 2E: 9 Lentes ===');
const lentes = [
  ['Medio Ambiente','medio-ambiente','Captura toda noticia sobre medio ambiente'],
  ['Mineria y Metales Estrategicos','mineria','Captura toda noticia sobre mineria'],
  ['Corrupcion e Impunidad','corrupcion-impunidad','Captura toda noticia sobre corrupcion'],
  ['Movilizacion Social','movilizacion-social','Forma de accion: bloqueo, marcha, paro, huelga'],
  ['Litio y Energia','litio-energia','Litio, baterias, energia renovable'],
  ['Pueblos Indigenas y Derechos Colectivos','pueblos-indigenas','Pueblos indigenas y derechos colectivos'],
  ['Genero y Diversidad','genero-diversidad','Perspectiva de genero y diversidad sexual'],
  ['Hidrocarburos','hidrocarburos','Gas, petroleo, YPFB, industria hidrocarburifera'],
  ['Cafe y Economias Regionales','cafe-economicas-regionales','Cafe de especialidad y economias regionales'],
];

const lenteIds: Record<string,string> = {};
for (const [nombre, slug, desc] of lentes) {
  const id = `lv2-${slug}`;
  db.run(`INSERT OR IGNORE INTO Lente (id, nombre, slug, descripcion, activo) VALUES ('${id}','${nombre}','${slug}','${desc}',1)`);
  lenteIds[slug] = id;
  console.log(`  + ${nombre} (${id})`);
}

// ═══ 2F: Keywords ═══
console.log('\n=== 2F: Keywords ===');
const kwE: Record<string,string[]> = {
'recursos-naturales':['hidrocarburos','gas natural','petroleo','YPFB','oleoducto','gasoducto','mineria','minero','COMIBOL','cooperativa minera','concesion minera','regalias','agua','deforestacion','incendio forestal','tierra','territorio','TCO','reforma agraria','soberania alimentaria','Vivir Bien','derechos de la naturaleza','extractivismo','transicion energetica','litio','recursos naturales','medio ambiente','amazonia','reserva forestal','parque nacional','area protegida','contaminacion'],
'gobierno-instituciones':['gobierno','presidente','vicepresidente','ministerio','viceministerio','asamblea legislativa','diputado','senador','ley','decreto','resolucion','poder judicial','tribunal supremo','tribunal constitucional','fiscalia','contraloria','defensoria','TSE','organo electoral','gobernacion','alcalde','concejo municipal','autonomia','institucion','reforma institucional'],
'v2-economia':['economia','PIB','inflacion','dolar','tipo de cambio','presupuesto','impuesto','gasto publico','empleo','desempleo','informalidad','salario','pension','bono','exportacion','importacion','inversion','banco','credito','FMI','Banco Mundial','crecimiento economico','politica economica','dolarizacion','reserva internacional'],
'v2-justicia-derechos':['corrupcion','corrupto','soborno','coima','delito','denuncia','investigacion','sentencia','condena','prision','detencion','derechos humanos','tortura','feminicidio','violencia de genero','justicia indigena','preso politico','persecucion','impunidad','fiscal','juez','policia','debido proceso','libertad de expresion','libertad de prensa'],
'salud-educacion':['salud','hospital','medico','enfermera','medicamento','seguro de salud','educacion','escuela','colegio','universidad','maestro','profesor','estudiante','magisterio','agua potable','saneamiento','vivienda','infraestructura','huelga de medicos','huelga de maestros','pandemia','vacuna','deficit','insumo','autonomia universitaria'],
'geopolitica':['relaciones internacionales','geopolitica','frontera','mar','soberania','diplomacia','embajada','tratado','acuerdo comercial','UNASUR','CELAC','Mercosur','OEA','ONU','CIDH','EEUU','China','Rusia','Union Europea','migracion','migrante','refugiado','bloque regional','politica exterior','diplomatico'],
'v2-procesos-electorales':['elecciones','eleccion','voto','elector','candidato','presidencial','legislativa','municipal','departamental','tribunal electoral','partido politico','coalicion','campana electoral','urna','resultado electoral','conteo','denuncia electoral','fraude','referendum','consulta popular','revocatoria','democracia','registro electoral'],
'movilizacion-social':['derecho a protestar','represion','fuerza policial','gas pimienta','antidisturbios','detencion de dirigentes','criminalizacion de la protesta','tipificacion penal de protesta','libertad de reunion','derecho de reunion','movilizacion social','persecucion a lideres sociales'],
'territorio-derechos':['pueblo indigena','originario','campesino','guarani','aymara','quechua','mojeno','chiman','tupi guarani','derechos colectivos','autonomia indigena','consulta previa','territorio comunitario','tierras comunitarias','interculturalidad','identidad cultural','patrimonio cultural','racismo','discriminacion','censo','poblacion','demografia','migracion interna','urbanizacion','nacion indigena'],
};

const kwL: Record<string,string[]> = {
'medio-ambiente':['deforestacion','incendios','cambio climatico','COP','Pachamama','biodiversidad','contaminacion ambiental','contaminacion del agua','contaminacion del aire','medio ambiente','amazonia','reserva forestal','parque nacional','area protegida','desertificacion','sequia','inundacion','agenda climatica','carbono','emisiones','efecto invernadero','basura','residuos','reciclaje'],
'mineria':['mineria','minero','COMIBOL','cooperativa minera','Huanuni','Colquiri','San Cristobal','San Bartolome','estano','zinc','plata','plomo','oro','antimonio','wolframio','relaves','pasivo ambiental','regalias mineras','concesion minera','SENARECOM','accidente minero','derrumbe','mineria mediana','transnacional minera','metales criticos','geopolitica minera','contratos mineros','Sumitomo','cadmio'],
'corrupcion-impunidad':['corrupcion','corrupto','soborno','coima','desvio de fondos','enriquecimiento ilicito','narcotrafico','lavado de dinero','trafico de influencias','colusion','red de corrupcion','caso de corrupcion','denuncia por corrupcion','investigacion por corrupcion'],
'movilizacion-social':['bloqueo','bloqueo de carretera','bloqueo de ruta','marcha','paro','huelga','paro civico','protesta','manifestacion','movilizacion','pickete','vigilia','toma de institucion','cerco','conflicto social','amotinamiento','paro de transporte','paro de actividades','cierre de frontera','cierre de camino'],
'litio-energia':['litio','baterias','bateria de ion litio','salar de Uyuni','salar de Coipasa','planta de litio','YLB','energia solar','energia eolica','energia renovable','hidrogeno verde','electromovilidad','transicion energetica','matriz energetica','recurso estrategico','minerales criticos','tierras raras'],
'pueblos-indigenas':['pueblo indigena','pueblo originario','nacion indigena','guarani','aymara','quechua','mojeno','chiman','tupi guarani','tierra baja','tierras altas','comunidad indigena','organizacion indigena','CIDOB','CONAMAQ','CSUTCB','FSUTCB','CONALCAM','cabildo indigena','marcha indigena','territorio indigena','consulta previa','libre determinacion','autonomia indigena'],
'genero-diversidad':['feminicidio','violencia de genero','violencia contra la mujer','machismo','patriarcado','mujeres','brecha de genero','igualdad de genero','participacion politica de mujeres','diversidad sexual','LGBT','LGBTQ','comunidad diversidad','trans','no binario','identidad de genero'],
'hidrocarburos':['hidrocarburos','gas natural','gas licuado','petroleo','YPFB','oleoducto','gasoducto','planta de separacion','planta de tratamiento','gasolinera','gasolina','diesel','GLP','subsidio a combustibles','gasolina basura','precio de combustibles','exportacion de gas','importacion de diesel','reservas de gas','campos gasiferos','Vaca Diez','Margarita','Itau','San Alberto','Carrasco'],
'cafe-economicas-regionales':['cafe de especialidad','cafe boliviano','grano verde','torrefaccion','cata','fermentacion','C-market','CENAPROC','COAINE','cooperativa cafetera','productor de cafe','cafeteria','cafe de altura','cafe organico','certificacion fitosanitaria','exportacion de cafe','Yungas cafe','Caranavi cafe','economia regional','cadena productiva','feria cafe','Cup of Excellence'],
};

const insKw = db.prepare('INSERT OR IGNORE INTO Keyword (id, termino, ejeId, lenteId) VALUES (?,?,?,?)');
let cE=0, cL=0;

for (const [slug, kws] of Object.entries(kwE)) {
  const eid = ejeIds[slug]; if (!eid) continue;
  for (const kw of kws) {
    const s = kw.replace(/\s+/g,'-').substring(0,35).toLowerCase();
    insKw.run(`kwe-${slug}-${s}`, kw, eid, null);
    cE++;
  }
}
for (const [slug, kws] of Object.entries(kwL)) {
  const lid = lenteIds[slug]; if (!lid) continue;
  for (const kw of kws) {
    const s = kw.replace(/\s+/g,'-').substring(0,35).toLowerCase();
    insKw.run(`kwl-${slug}-${s}`, kw, null, lid);
    cL++;
  }
}
console.log(`  Ejes: ${cE} kw | Lentes: ${cL} kw`);

// ═══ VERIFY ═══
console.log('\n=== VERIFY ===');
for (const [slug, id] of Object.entries(ejeIds)) {
  const c = (db.query('SELECT COUNT(*) as c FROM Keyword WHERE ejeId = ?',[id]).get() as any).c;
  console.log(`  Eje ${slug}: ${c} kw`);
}
for (const [slug, id] of Object.entries(lenteIds)) {
  const c = (db.query('SELECT COUNT(*) as c FROM Keyword WHERE lenteId = ?',[id]).get() as any).c;
  console.log(`  Lente ${slug}: ${c} kw`);
}

const tKw = (db.query('SELECT COUNT(*) as c FROM Keyword').get() as any).c;
const tE = (db.query(`SELECT COUNT(*) as c FROM EjeTematico WHERE tipo='estructural'`).get() as any).c;
const tL = (db.query('SELECT COUNT(*) as c FROM Lente').get() as any).c;
console.log(`\n  TOTAL: ${tE} ejes | ${tL} lentes | ${tKw} keywords`);

db.close();
console.log('\n PASO 2 COMPLETADO');
