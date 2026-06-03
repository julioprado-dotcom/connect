import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.mencion.count();
  console.log(`Total menciones: ${total}`);
  
  if (total === 0) {
    // Check tables
    const result: any = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
    console.log('\nTables:', result.map((r: any) => r.name).join(', '));
    
    // Direct SQL check
    const mencCount: any = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM Mencion`;
    console.log('Direct SQL Mencion count:', mencCount[0]?.cnt);
    
    const nrCount: any = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM NotaRaw`;
    console.log('Direct SQL NotaRaw count:', nrCount[0]?.cnt);
    
    const repCount: any = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM Reporte`;
    console.log('Direct SQL Reporte count:', repCount[0]?.cnt);
  }
  
  // Sample
  const sample: any = await prisma.$queryRaw`SELECT * FROM Mencion LIMIT 2`;
  if (sample.length > 0) {
    console.log('\nSample Mencion keys:', Object.keys(sample[0]).join(', '));
    console.log('Sample 1:', JSON.stringify(sample[0], null, 2).substring(0, 500));
  } else {
    console.log('No menciones found in table');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
