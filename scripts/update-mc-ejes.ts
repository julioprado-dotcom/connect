import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const ejesInstitucionales = {
    descripcion: "Los 12 Ejes Temáticos Institucionales son universales, neutrales y aplican a TODOS los productos del sistema (gratuitos y pagos). Definidos por relevancia legislativa/general. Los ejes PERSONALIZADOS por cliente van en EjeTematicoCliente (tabla separada).",
    ejes: [
      { orden: 1, slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible', keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos' },
      { orden: 2, slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad', keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio' },
      { orden: 3, slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones', keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro' },
      { orden: 4, slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad', keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,YPFB' },
      { orden: 5, slug: 'economia', nombre: 'Economía y Política Económica', keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo' },
      { orden: 6, slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos', keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,delito,policía' },
      { orden: 7, slug: 'procesos-electorales', nombre: 'Procesos Electorales', keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio' },
      { orden: 8, slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura', keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio' },
      { orden: 9, slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos', keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enferneros,sistema de salud' },
      { orden: 10, slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos', keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión,litio,Pachamama' },
      { orden: 11, slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales', keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea' },
      { orden: 12, slug: 'mineria', nombre: 'Minería y Metales Estratégicos', keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estano,zinc,plata,plomo,oro,YLB,litio,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM' },
    ],
    subclasificaciones: 35,
    dimensiones: ['produccion', 'precio', 'conflicto', 'regulacion', 'infraestructura'],
  };

  const result = await db.marcoConceptual.updateMany({
    where: { activa: true },
    data: { ejesInstitucionales: ejesInstitucionales as any },
  });

  console.log(`Updated ${result.count} MC records with ejesInstitucionales`);
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
