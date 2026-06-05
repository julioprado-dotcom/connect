/**
 * Direct seed script — bypasses API auth and rate limits.
 * Seeds: Ejes, Medios, Personas, Marco Conceptual, Cliente, Contratos
 */
import { PrismaClient } from '../prisma/generated-client/index.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const db = new PrismaClient();
const uid = () => crypto.randomUUID();

// ─── 12 Ejes Temáticos ─────────────────────────────────────────
const EJES = [
  { nombre: 'Hidrocarburos, Energía y Combustible', slug: 'hidrocarburos-energia', icono: '⛽', color: '#f59e0b', orden: 1, keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos', descripcion: 'Noticias sobre hidrocarburos, energía, combustibles, YPFB, litio, electricidad, subsidios energéticos' },
  { nombre: 'Movimientos Sociales y Conflictividad', slug: 'movimientos-sociales', icono: '✊', color: '#ef4444', orden: 2, keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio', descripcion: 'Bloqueos, marchas, paros, conflictos sociales, organizaciones sindicales y campesinas' },
  { nombre: 'Gobierno, Oposición e Instituciones', slug: 'gobierno-oposicion', icono: '🏛️', color: '#3b82f6', orden: 3, keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro', descripcion: 'Actividad legislativa, declaraciones de bancadas, procesos en la Asamblea, gestión gubernamental' },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', icono: '🔥', color: '#dc2626', orden: 4, keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,YPFB', descripcion: 'Denuncias de corrupción, auditorías, comisiones de investigación, irregularidades financieras' },
  { nombre: 'Economía y Política Económica', slug: 'economia', icono: '💰', color: '#10b981', orden: 5, keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo', descripcion: 'Indicadores económicos, política fiscal, tipo de cambio, reservas, presupuesto general' },
  { nombre: 'Justicia y Derechos Humanos', slug: 'justicia-derechos', icono: '⚖️', color: '#6366f1', orden: 6, keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,delito,policía', descripcion: 'Sistema judicial, derechos humanos, denuncias penales, sentencias, comisiones de verdad' },
  { nombre: 'Procesos Electorales', slug: 'procesos-electorales', icono: '🗳️', color: '#8b5cf6', orden: 7, keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio', descripcion: 'Elecciones, procesos del TSE/OEP, candidatos, resultados electorales, observación' },
  { nombre: 'Educación, Universidades y Cultura', slug: 'educacion-cultura', icono: '📚', color: '#06b6d4', orden: 8, keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio', descripcion: 'Presupuesto educativo, magisterio, universidades, cultura, patrimonio, strikes estudiantiles' },
  { nombre: 'Salud y Servicios Públicos', slug: 'salud-servicios', icono: '🏥', color: '#ec4899', orden: 9, keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros,sistema de salud', descripcion: 'Sistema de salud, hospitales, medicamentos, seguros médicos, servicios públicos básicos' },
  { nombre: 'Medio Ambiente, Territorio y Recursos', slug: 'medio-ambiente', icono: '🌍', color: '#22c55e', orden: 10, keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión,litio,Pachamama', descripcion: 'Medio ambiente, recursos naturales, minería, agua, incendios forestales, autonomías territoriales' },
  { nombre: 'Relaciones Internacionales', slug: 'relaciones-internacionales', icono: '🌎', color: '#0ea5e9', orden: 11, keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea', descripcion: 'Relaciones diplomáticas, fronteras, migración, cooperación internacional, tratados' },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', icono: '⛏️', color: '#a16207', orden: 12, keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estano,zinc,plata,plomo,oro,YLB,litio,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM', descripcion: 'Sector minero boliviano: producción, precios internacionales (LME), litio y metales estratégicos, conflictividad cooperativas, pasivos ambientales, regalías y normativa minera' },
];

async function main() {
  console.log('[SEED] Iniciando seed directo...');

  // Check existing state
  const existingPersonas = await db.persona.count();
  const existingMedios = await db.medio.count();
  const existingEjes = await db.ejeTematico.count();

  if (existingPersonas > 0 || existingMedios > 0 || existingEjes > 0) {
    console.log(`[SEED] DB ya tiene datos: ${existingEjes} ejes, ${existingMedios} medios, ${existingPersonas} personas`);
    console.log('[SEED] Limpiando...');
    await db.comentario.deleteMany();
    await db.mencionTema.deleteMany();
    await db.mencion.deleteMany();
    await db.reporte.deleteMany();
    await db.capturaLog.deleteMany();
    await db.persona.deleteMany();
    await db.medio.deleteMany();
    await db.ejeTematico.deleteMany();
    console.log('[SEED] Limpieza completada');
  }

  // 1. Ejes Temáticos
  console.log('[SEED] Creando 12 ejes temáticos...');
  const ejesResult = await db.ejeTematico.createMany({ data: EJES.map(e => ({ ...e, id: uid() })) });
  console.log(`[SEED] ${ejesResult.count} ejes creados`);

  // 2. Medios
  console.log('[SEED] Creando medios...');
  const mediosRaw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'medios.json'), 'utf-8'));
  const mediosResult = await db.medio.createMany({
    data: mediosRaw.map(m => ({
      nombre: m.nombre,
      url: m.url || '',
      tipo: m.tipo,
      nivel: String(m.nivel || '1'),
      departamento: m.departamento || null,
      plataformas: m.plataformas || '',
      notas: m.notas || '',
      id: uid(),
    })),
  });
  console.log(`[SEED] ${mediosResult.count} medios creados`);

  // 3. Personas (legisladores)
  console.log('[SEED] Creando personas (legisladores)...');
  const legisladores = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'legisladores_2025_2030.json'), 'utf-8'));

  const personasData = legisladores.map(l => ({
    id: uid(),
    nombre: l.nombre.replace(/\s+/g, ' ').trim(),
    camara: l.camara,
    departamento: l.departamento,
    partido: l.partido,
    partidoSigla: l.partidoSigla,
    tipo: l.tipo === 'TITULAR' ? 'Titular' : 'Suplente',
    cargoDirectiva: l.cargoDirectiva || null,
    email: l.email || null,
    fotoUrl: l.fotoUrl || '',
    periodo: '2025-2030',
    fechaActualizacion: new Date(),
  })).filter(p => p.nombre);

  const personasResult = await db.persona.createMany({ data: personasData });
  console.log(`[SEED] ${personasResult.count} personas creadas`);

  // 4. Seed Marco Conceptual
  console.log('[SEED] Creando marco conceptual...');
  try {
    const { seedMarcoConceptual } = await import('../prisma/seed-marco-conceptual.ts');
    await seedMarcoConceptual(db);
    console.log('[SEED] Marco conceptual creado');
  } catch (e) {
    console.log('[SEED] Marco conceptual: usando datos por defecto (skipping import - es .ts)');
    // Create a minimal marco conceptual
    const existing = await db.marco_conceptual.count();
    if (existing === 0) {
      await db.marco_conceptual.create({
        data: {
          version: 1,
          activa: true,
          principios: [],
          contextoInstitucional: {},
          lineasEditoriales: [],
          ejesInstitucionales: [],
          escalaTratamiento: {},
          reglasDesambiguacion: {},
          criteriosRelevancia: { condiciones: ['mencion_persona', 'keywords_ejes', 'datos_cuantitativos', 'opinion_editorial', 'reaccion_politica'] },
          exclusionesEtica: [],
          terminologiaPermitida: [],
          terminologiaProhibida: [],
          preguntasFundamentales: [],
          parametros: { modelo: 'glm-4.7-flash', temperatura: 0.1, maxTokens: 4000 },
        },
      });
      console.log('[SEED] Marco conceptual minimal creado');
    }
  }

  // 5. Create Admin User if not exists
  console.log('[SEED] Verificando admin user...');
  const adminExists = await db.user.count();
  if (adminExists === 0) {
    // Use a simple password hash - user should change it
    // This is a placeholder - in production, use proper auth setup
    console.log('[SEED] No admin user found - create via /login UI');
  }

  // Summary
  const finalEjes = await db.ejeTematico.count();
  const finalMedios = await db.medio.count();
  const finalPersonas = await db.persona.count();
  const finalSenadores = await db.persona.count({ where: { camara: 'Senadores' } });
  const finalDiputados = await db.persona.count({ where: { camara: 'Diputados' } });

  console.log(`\n[SEED] ═══ COMPLETADO ═══`);
  console.log(`[SEED] Ejes: ${finalEjes}`);
  console.log(`[SEED] Medios: ${finalMedios}`);
  console.log(`[SEED] Personas: ${finalPersonas} (${finalSenadores} senadores, ${finalDiputados} diputados)`);
}

main()
  .catch(e => { console.error('[SEED] FATAL:', e.message, e.stack); process.exit(1); })
  .finally(() => db.$disconnect());
