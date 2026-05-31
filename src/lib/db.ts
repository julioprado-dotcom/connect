import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ─── Persistencia: DB trackeada en git ────────────────────────────
// Forzar la ruta canónica de la DB (prisma/db/custom.db) que viaja
// con el repo. Sin esto, el sandbox inyecta DATABASE_URL apuntando
// a /db/ que se pierde al destruir el sandbox.
const PROJECT_ROOT = process.cwd();
const CANONICAL_DB_PATH = PROJECT_ROOT + '/prisma/db/custom.db';
// Sobrescribir process.env para que PrismaClient use la ruta correcta
process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

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

// CRÍTICO: Siempre cachear en globalThis, incluso en producción.
// Next.js Turbopack crea múltiples contextos de módulo. Sin esto,
// cada contexto crea su propia PrismaClient → múltiples conexiones
// a SQLite → memory leak y lock contention.
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;

export default db;
