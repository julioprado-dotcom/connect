import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');

const tables = ['Mencion', 'Medio', 'Persona', 'Lente', 'Keyword', 'EjeTematico', 'MencionLente', 'MencionTema'];

for (const table of tables) {
  const cols = db.query(`PRAGMA table_info("${table}")`).all() as any[];
  for (const col of cols) {
    const types = db.query(`SELECT typeof("${col.name}") as t, COUNT(*) as c FROM "${table}" GROUP BY typeof("${col.name}")`).all() as any[];
    const expectedType = col.type;
    let problematic = false;
    let details = '';

    if (expectedType === 'TEXT') {
      const nonText = types.filter(t => t.t !== 'text' && t.t !== 'null');
      if (nonText.length > 0) { problematic = true; details = nonText.map(t => `${t.t}:${t.c}`).join(', '); }
    } else if (expectedType === 'DATETIME') {
      const nonText = types.filter(t => t.t !== 'text' && t.t !== 'null');
      if (nonText.length > 0) { problematic = true; details = nonText.map(t => `${t.t}:${t.c}`).join(', '); }
    } else if (expectedType === 'BOOLEAN') {
      const nonInt = types.filter(t => t.t !== 'integer' && t.t !== 'null');
      if (nonInt.length > 0) { problematic = true; details = nonInt.map(t => `${t.t}:${t.c}`).join(', '); }
    }

    if (problematic) {
      console.log(`${table}.${col.name} (${expectedType}): ${details}`);
    }
  }
}
db.close();
