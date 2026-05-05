const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const db = new PrismaClient();

async function main() {
  const existing = await db.persona.count();
  console.log(`Existing personas: ${existing}`);
  
  if (existing > 0) {
    console.log('DB already has personas, skipping seed');
    const medios = await db.medio.count();
    const ejes = await db.ejeTematico.count();
    console.log(`Medios: ${medios}, Ejes: ${ejes}`);
    return;
  }

  // Seed medios
  const mediosPath = path.join('/home/z/my-project/connect/data', 'medios.json');
  const medios = JSON.parse(fs.readFileSync(mediosPath, 'utf-8'));
  let mediosCount = 0;
  for (const m of medios) {
    await db.medio.create({ data: { nombre: m.nombre, url: m.url||'', tipo: m.tipo, nivel: String(m.nivel||'1'), departamento: m.departamento||null, plataformas: m.plataformas||'', notas: m.notas||'' }});
    mediosCount++;
  }
  console.log(`Medios created: ${mediosCount}`);

  // Seed senadores
  const senPath = path.join('/home/z/my-project/connect/data', 'senadores_completo.json');
  const senadores = JSON.parse(fs.readFileSync(senPath, 'utf-8'));
  let senCount = 0;
  for (const s of senadores) {
    const nombre = String(s.nombre||'').replace(/\s+/g,' ').trim();
    if (!nombre) continue;
    await db.persona.create({ data: { nombre, camara:'Senadores', departamento: String(s.departamento||''), partido: String(s.partido||''), partidoSigla: String(s.partido_sigla||''), tipo:'Titular', periodo:'2025-2030' }});
    senCount++;
  }
  console.log(`Senadores created: ${senCount}`);

  // Seed diputados
  const dipPath = path.join('/home/z/my-project/connect/data', 'diputados_2025_2030_completo.json');
  const dipData = JSON.parse(fs.readFileSync(dipPath, 'utf-8'));
  const diputados = dipData.diputados;
  let dipCount = 0;
  for (const d of diputados) {
    const nombre = String(d.nombre||'').replace(/\s+/g,' ').trim();
    if (!nombre) continue;
    await db.persona.create({ data: { nombre, camara:'Diputados', departamento: String(d.departamento||''), partido: String(d.partido||''), partidoSigla: String(d.partido_sigla||''), tipo:'Titular', periodo:'2025-2030' }});
    dipCount++;
  }
  console.log(`Diputados created: ${dipCount}`);
  console.log(`TOTAL: ${senCount + dipCount} personas`);
}

main().then(() => db.$disconnect()).catch(e => { console.error(e); process.exit(1); });
