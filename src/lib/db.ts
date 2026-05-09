import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient();

  // ─── Health check: verificar que la DB tiene datos al iniciar ───
  if (process.env.NODE_ENV !== 'production') {
    (async () => {
      try {
        const [personas, medios] = await Promise.all([
          client.persona.count(),
          client.medio.count(),
        ]);
        const dbUrl = process.env.DATABASE_URL || 'NO DEFINIDA';
        // Mostrar ruta real (sin el prefijo "file:")
        const dbPath = dbUrl.replace(/^file:/, '');
        if (personas === 0 && medios === 0) {
          console.error(
            `[DB] ⚠️  ALERTA: DB vacía en "${dbPath}" — 0 personas, 0 medios.`,
            `Si hay datos en otra ubicación, verificar DATABASE_URL en .env`
          );
        } else {
          console.log(
            `[DB] ✅ Conectado a "${dbPath}" — ${personas} personas, ${medios} medios`
          );
        }
      } catch (err) {
        console.error('[DB] Error en health check:', err);
      }
    })();
  }

  return client;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export default db;
