/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SEED ADMIN — DECODEX Bolivia                                    ║
 * ║  Crea el usuario administrador principal si no existe.            ║
 * ║  Uso: npx tsx scripts/seed-admin.ts                              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * SEGURIDAD:
 * - Lee la contraseña de la variable de entorno ADMIN_PASSWORD.
 * - Si no existe, genera una contraseña aleatoria segura.
 * - NUNCA almacena la contraseña en texto plano en el repo.
 * - El hash bcrypt se genera en tiempo de ejecución.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { join } from 'path';

// ─── Config ─────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@decodex.bo';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador Principal';
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin';
const BCRYPT_ROUNDS = 12;

// ─── Helpers ────────────────────────────────────────────────────────
function generateSecurePassword(length = 20): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function banner(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         DECODEX Bolivia — Seed de Usuario Admin          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

async function main(): Promise<void> {
  banner();

  // ─── Conectar a la DB ────────────────────────────────────────────
  const dbPath = join(process.cwd(), 'prisma', 'db', 'custom.db');
  console.log(`[DB] Conectando a: ${dbPath}`);

  const db = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });

  try {
    // Test connection
    await db.$connect();
    console.log('[DB] Conexión exitosa');
  } catch (error) {
    console.error('[DB] ERROR: No se pudo conectar a la base de datos');
    console.error(error);
    process.exit(1);
  }

  try {
    // ─── Verificar si ya existe un usuario admin ───────────────────
    const existingAdmin = await db.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  YA EXISTE un usuario admin en la base de datos.    ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`  Email:  ${existingAdmin.email}`);
      console.log(`  Nombre: ${existingAdmin.name}`);
      console.log(`  Rol:    ${existingAdmin.role}`);
      console.log(`  Activo: ${existingAdmin.activo ? 'Sí' : 'No'}`);
      console.log('');
      console.log('[SEED] No se creó ningún usuario nuevo.');
      console.log('[SEED] Si necesita resetear la contraseña, ejecute:');
      console.log('  npx tsx scripts/reset-admin-password.ts');
      console.log('');
      await db.$disconnect();
      return;
    }

    // ─── Contar todos los usuarios ─────────────────────────────────
    const totalUsers = await db.user.count();
    if (totalUsers > 0) {
      console.log(`[SEED] Existen ${totalUsers} usuario(s) pero ninguno con rol 'admin'.`);
      console.log('[SEED] Creando usuario admin de todas formas...');
    }

    // ─── Generar/obtener contraseña ────────────────────────────────
    const adminPassword =
      process.env.ADMIN_PASSWORD || generateSecurePassword(20);

    console.log('[SEED] Hasheando contraseña (bcrypt, rounds=%d)...', BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    // ─── Crear usuario ─────────────────────────────────────────────
    console.log('[SEED] Creando usuario admin...');
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: ADMIN_ROLE,
        activo: true,
        emailVerified: new Date(),
      },
    });

    // ─── Verificar que se creó correctamente ───────────────────────
    const verifyUser = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!verifyUser) {
      console.error('[SEED] ERROR CRÍTICO: No se pudo verificar la creación del usuario');
      process.exit(1);
    }

    // Verify bcrypt works
    const isValid = await bcrypt.compare(adminPassword, verifyUser.password || '');
    if (!isValid) {
      console.error('[SEED] ERROR CRÍTICO: Hash bcrypt no válido — el login no funcionará');
      process.exit(1);
    }

    // ─── Imprimir credenciales ─────────────────────────────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║          ✅ USUARIO ADMIN CREADO EXITOSAMENTE            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────────┐');
    console.log('  │  🔐 CREDENCIALES DE ACCESO                         │');
    console.log('  │                                                     │');
    console.log(`  │  Email:    ${ADMIN_EMAIL.padEnd(40)}│`);
    console.log(`  │  Password: ${adminPassword.padEnd(40)}│`);
    console.log(`  │  Rol:      ${ADMIN_ROLE.padEnd(40)}│`);
    console.log('  │                                                     │');
    console.log('  │  ⚠️  GUARDE ESTAS CREDENCIALES AHORA               │');
    console.log('  │  Esta es la ÚNICA vez que se muestra la contraseña  │');
    console.log('  └─────────────────────────────────────────────────────┘');
    console.log('');

    // ─── Verificación de integridad del sistema ────────────────────
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║          VERIFICACIÓN DE INTEGRIDAD                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // Check AUTH_SECRET
    const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!authSecret) {
      console.log('  🔴 AUTH_SECRET no configurada en .env — JWT NO funcionará');
      console.log('     Solución: Agregue AUTH_SECRET=... a su archivo .env');
    } else {
      console.log('  🟢 AUTH_SECRET configurada');
    }

    // Check User count
    const finalCount = await db.user.count();
    console.log(`  🟢 Total usuarios en DB: ${finalCount}`);

    // Check bcrypt verification
    console.log(`  🟢 Verificación bcrypt: OK`);

    console.log('');
    console.log('[SEED] Listo. Puede hacer login en /login con las credenciales arriba.');
    console.log('[SEED] IMPORTANTE: Cambie la contraseña después del primer login.');
    console.log('');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SEED] ERROR al crear usuario admin:');
    console.error(message);

    // Check for unique constraint violation
    if (message.includes('Unique constraint') || message.includes('UNIQUE')) {
      console.error('');
      console.error('[SEED] El email ya está registrado. Use otro email con:');
      console.error('  ADMIN_EMAIL=otro@decodex.bo npx tsx scripts/seed-admin.ts');
    }

    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// ─── Ejecutar ────────────────────────────────────────────────────────
main();
