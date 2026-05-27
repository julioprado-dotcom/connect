/**
 * ═════════════════════════════════════════════════════════════════════════
 * SCRIPT DE RESCATE: Crear/Restaurar Administrador DECODEX
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * USO:
 *   npx tsx scripts/create-emergency-admin.ts
 * 
 * Qué hace:
 *   1. Conecta a la DB SQLite (prisma/db/custom.db)
 *   2. Genera hash bcrypt de la contraseña segura
 *   3. Crea o actualiza usuario admin@decodex.bo con rol admin
 *   4. Verifica que el usuario existe correctamente
 * 
 * IMPORTANTE: Ejecutar en el VPS o localmente con acceso a la DB.
 * ═════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Configuración del Admin ──────────────────────────────────
const ADMIN_EMAIL = 'admin@decodex.bo';
const ADMIN_PASSWORD = 'Decodex2026!Segura';
const ADMIN_NAME = 'Administrador DECODEX';
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   SCRIPT DE RESCATE — Crear Administrador DECODEX       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar conexión a la DB
    console.log('[1/5] Verificando conexión a la base de datos...');
    await prisma.$connect();
    console.log('  ✅ Conexión exitosa\n');

    // 2. Generar hash de la contraseña
    console.log('[2/5] Generando hash bcrypt de la contraseña...');
    const hashedPassword = await hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    console.log(`  ✅ Hash generado (bcrypt, ${BCRYPT_ROUNDS} rounds)`);
    console.log(`  Hash: ${hashedPassword.substring(0, 20)}...\n`);

    // 3. Buscar si ya existe el usuario
    console.log('[3/5] Buscando usuario existente...');
    const existingUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existingUser) {
      console.log(`  ⚠️  Usuario existente encontrado (ID: ${existingUser.id})`);
      console.log(`     Nombre: ${existingUser.name || '(vacío)'}`);
      console.log(`     Rol: ${existingUser.role || '(no definido)'}`);

      // Actualizar contraseña y rol
      console.log('\n  Actualizando contraseña y asegurando rol admin...');
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          name: ADMIN_NAME,
          role: 'admin',
          emailVerified: new Date(),
        },
      });
      console.log('  ✅ Usuario actualizado exitosamente\n');
    } else {
      // Crear nuevo usuario
      console.log('  No existe. Creando nuevo administrador...');
      
      const userId = `admin_${Date.now()}`;
      await prisma.user.create({
        data: {
          id: userId,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          password: hashedPassword,
          role: 'admin',
          emailVerified: new Date(),
        },
      });
      console.log(`  ✅ Administrador creado (ID: ${userId})\n`);
    }

    // 4. Verificar la creación/actualización
    console.log('[4/5] Verificando credenciales...');
    const verifyUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    });

    if (!verifyUser) {
      console.error('  ❌ ERROR: No se pudo verificar el usuario');
      process.exit(1);
    }

    console.log('  ✅ Verificación exitosa:');
    console.log(`     ID:    ${verifyUser.id}`);
    console.log(`     Email: ${verifyUser.email}`);
    console.log(`     Nombre: ${verifyUser.name}`);
    console.log(`     Rol:   ${verifyUser.role}`);
    console.log(`     Email verificado: ${verifyUser.emailVerified ? 'Sí' : 'No'}\n`);

    // 5. Listar todos los usuarios del sistema
    console.log('[5/5] Usuarios en el sistema:');
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true },
    });
    
    if (allUsers.length === 0) {
      console.log('  (Sin usuarios adicionales)');
    } else {
      for (const u of allUsers) {
        const isAdmin = u.email === ADMIN_EMAIL ? ' ★ ADMIN' : '';
        console.log(`  - ${u.email}${isAdmin} (${u.role || 'sin rol'})`);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  ✅ ADMINISTRADOR CONFIGURADO EXITOSAMENTE');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`\n  Credenciales de acceso:`);
    console.log(`  ┌─────────────────────────────────────────┐`);
    console.log(`  │ Email:    ${ADMIN_EMAIL.padEnd(29)}│`);
    console.log(`  │ Password: ${ADMIN_PASSWORD.padEnd(29)}│`);
    console.log(`  │ URL:      /login                        │`);
    console.log(`  └─────────────────────────────────────────┘`);
    console.log(`\n  ⚠️  Cambia la contraseña después del primer login.`);
    console.log(`\n`);

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
