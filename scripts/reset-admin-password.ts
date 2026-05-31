/**
 * Reset Admin Password — DECODEX Bolivia
 * Uso: npx tsx scripts/reset-admin-password.ts
 *
 * Lee la nueva contraseña de ADMIN_PASSWORD env var.
 * Si no existe, genera una aleatoria segura.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@decodex.bo';
const BCRYPT_ROUNDS = 12;

function generateSecurePassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function main(): Promise<void> {
  const db = new PrismaClient();

  const admin = await db.user.findFirst({ where: { role: 'admin' } });

  if (!admin) {
    console.error('No se encontro usuario admin. Ejecutar: npx tsx scripts/seed-admin.ts');
    await db.$disconnect();
    process.exit(1);
  }

  const newPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.user.update({
    where: { id: admin.id },
    data: { password: hashed },
  });

  // Verify
  const valid = await bcrypt.compare(newPassword, hashed);
  if (!valid) {
    console.error('ERROR: Hash bcrypt invalido');
    process.exit(1);
  }

  console.log('');
  console.log(`Password actualizada para: ${admin.email}`);
  console.log(`Nueva password: ${newPassword}`);
  console.log('');

  await db.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
