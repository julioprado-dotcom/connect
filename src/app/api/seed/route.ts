import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedIndicadores } from '@/lib/indicadores/capturer-tier1';

// 12 Ejes Temáticos aprobados — CONTEXTO.md v0.5.0
const EJES_TEMATICOS = [
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const existing = await db.persona.count();

    if (existing > 0 && !force) {
      return NextResponse.json({
        message: 'Base de datos ya contiene datos. Usa { "force": true } para re-seed.',
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

    // 1. Seed ejes temáticos
    console.log('Seeding ejes temáticos...');
    const ejesResult = [];
    for (const eje of EJES_TEMATICOS) {
      const created = await db.ejeTematico.create({ data: eje });
      ejesResult.push(created);
    }

    // 2. Seed medios from medios.json
    console.log('Seeding medios...');
    const mediosPath = path.join(process.cwd(), 'data', 'medios.json');
    const mediosRaw = fs.readFileSync(mediosPath, 'utf-8');
    const medios: Array<Record<string, string>> = JSON.parse(mediosRaw);

    const mediosResult = [];
    for (const medio of medios) {
      const created = await db.medio.create({
        data: {
          nombre: medio.nombre,
          url: medio.url || '',
          tipo: medio.tipo,
          nivel: String(medio.nivel || '1'),
          departamento: medio.departamento || null,
          plataformas: medio.plataformas || '',
          notas: medio.notas || '',
        },
      });
      mediosResult.push(created);
    }

    // 3. Seed senadores from senadores_completo.json (datos ricos)
    console.log('Seeding senadores...');
    const senadoresPath = path.join(process.cwd(), 'data', 'senadores_completo.json');
    const senadoresRaw = fs.readFileSync(senadoresPath, 'utf-8');
    const senadores: Array<Record<string, unknown>> = JSON.parse(senadoresRaw);

    let senadoresCount = 0;
    for (const sen of senadores) {
      const nombre = String(sen.nombre || '').replace(/\s+/g, ' ').trim();
      if (!nombre) continue;

      const partido = normalizarPartido(String(sen.partido_sigla || ''), String(sen.partido || ''));

      await db.persona.create({
        data: {
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
        },
      });
      senadoresCount++;
    }

    // 4. Seed diputados from diputados_2025_2030_completo.json (datos ricos)
    console.log('Seeding diputados...');
    const diputadosPath = path.join(process.cwd(), 'data', 'diputados_2025_2030_completo.json');
    const diputadosRaw = fs.readFileSync(diputadosPath, 'utf-8');
    const diputadosData = JSON.parse(diputadosRaw);
    const diputados: Array<Record<string, unknown>> = diputadosData.diputados;

    let diputadosCount = 0;
    for (const dip of diputados) {
      const nombre = String(dip.nombre || '').replace(/\s+/g, ' ').trim();
      if (!nombre) continue;

      const partido = normalizarPartido(String(dip.partido_sigla || ''), String(dip.partido || ''));

      await db.persona.create({
        data: {
          nombre,
          camara: 'Diputados',
          departamento: normalizarDepartamento(String(dip.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: 'Titular',
          email: null,
          fotoUrl: String(dip.foto_url || ''),
          periodo: '2025-2030',
        },
      });
      diputadosCount++;
    }

    const totalPersonas = senadoresCount + diputadosCount;

    // 5. Seed indicadores macroeconómicos (Tier 1)
    console.log('Seeding indicadores Tier 1...');
    await seedIndicadores();

    return NextResponse.json({
      message: `Seed ejecutado correctamente (v0.5.0) — ${force ? 'FORCE RESET' : 'nuevo'}`,
      ejesInsertados: ejesResult.length,
      mediosInsertados: mediosResult.length,
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
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Seed error:', message);
    return NextResponse.json(
      { error: 'Error al ejecutar seed', details: message },
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
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
