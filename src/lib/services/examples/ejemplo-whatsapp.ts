/**
 * @module ejemplo-whatsapp
 * @description Ejemplo completo de uso del servicio WhatsApp del Módulo A1.
 * Demuestra: envío simple, envío con fragmentación, envío con template,
 * manejo de errores, modo mock y verificación de estado.
 *
 * Para ejecutar (en modo mock, sin credenciales):
 *   npx ts-node ejemplo-whatsapp.ts
 *
 * @project DECODEX Bolivia - Equipo A
 * @module_id A1
 */

import {
  sendWhatsApp,
  validatePhone,
  fragmentMessage,
  getServiceStatus,
} from './whatsapp';

import type {
  WhatsAppDeliveryResult,
  PhoneValidationResult,
  WhatsAppServiceStatus,
} from './whatsapp.types';

// ─── Utilidades de presentación ──────────────────────────────────────────────

/** Imprime un encabezado de sección en consola */
function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

/** Imprime un resultado con formato */
function printResult(label: string, result: WhatsAppDeliveryResult): void {
  console.log(`\n  📤 ${label}`);
  console.log(`     Estado: ${result.success ? '✅ Éxito' : '❌ Fallo'}`);
  if (result.success) {
    console.log(`     MessageID: ${result.messageId}`);
    console.log(`     Timestamp: ${result.timestamp}`);
    if (result.fragments && result.fragments > 1) {
      console.log(`     Fragmentos: ${result.fragments}`);
    }
  } else {
    console.log(`     Error: ${result.errorCode}`);
    console.log(`     Detalle: ${result.errorMessage}`);
  }
  console.log(`     Teléfono: ${result.telefono}`);
}

// ─── Ejemplos ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 DECODEX Bolivia - Módulo A1 - WhatsApp Business API');
  console.log('   Ejemplos de uso del servicio');

  // ── 1. Verificar estado del servicio ───────────────────────────────────
  section('1. Estado del servicio');
  const status: WhatsAppServiceStatus = getServiceStatus();
  console.log(`  Configurado: ${status.configured ? 'Sí' : 'No'}`);
  console.log(`  Proveedor: ${status.provider}`);
  console.log(`  Sandbox: ${status.sandbox ? 'Sí' : 'No'}`);

  if (status.provider === 'mock') {
    console.log('\n  ⚠️  Operando en modo MOCK (sin credenciales Twilio).');
    console.log('     Los mensajes no se enviarán realmente.');
    console.log('     Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y');
    console.log('     TWILIO_PHONE_NUMBER para producción.');
  }

  // ── 2. Validación de teléfonos ────────────────────────────────────────
  section('2. Validación de teléfonos');

  const testPhones: string[] = [
    '+59170000000',  // Válido: formato completo
    '70000000',      // Válido: sin prefijo
    '60000000',      // Válido: operador 6 (Claro)
    '+591-7000-0000', // Válido: con guiones
    '+59150000000',  // Inválido: empieza con 5 (fijo)
    '12345',         // Inválido: muy corto
    '',              // Inválido: vacío
  ];

  for (const phone of testPhones) {
    const validation: PhoneValidationResult = validatePhone(phone);
    const icon = validation.valid ? '✅' : '❌';
    const normalized = validation.valid ? ` → ${validation.normalized}` : '';
    const error = validation.error ? ` (${validation.error})` : '';
    console.log(`  ${icon} "${phone}"${normalized}${error}`);
  }

  // ── 3. Envío simple ────────────────────────────────────────────────────
  section('3. Envío simple de mensaje');

  const simpleResult: WhatsAppDeliveryResult = await sendWhatsApp(
    '+59170000000',
    '🔔 Notificación DECODEX\n\nSe detectaron 5 nuevas menciones en medios.',
  );
  printResult('Notificación simple', simpleResult);

  // ── 4. Envío con template y parámetros ─────────────────────────────────
  section('4. Envío con template y parámetros');

  const templateResult: WhatsAppDeliveryResult = await sendWhatsApp(
    '+59170000000',
    '',
    {
      templateId: 'hw_boletin_diario',
      parametros: [
        'Juan Pérez',
        '15/01/2025',
        '12 menciones',
        '3 alertas de tendencia',
      ],
    },
  );
  printResult('Template boletín', templateResult);

  // ── 5. Envío de mensaje largo (fragmentación) ──────────────────────────
  section('5. Envío de mensaje largo (fragmentación automática)');

  // Generar un boletín largo que exceda los 4096 caracteres
  const mentions = [
    'El Presidente anunció nuevas políticas energéticas...',
    'Ministerio de Minería reporta incremento en exportaciones...',
    'Yacimientos de Litio en el Salar de Uyuni generan interés internacional...',
    'Banco Central publica reporte de inflación mensual...',
    'Conflictos mineros en Potosí continúan...',
    'Sector hidrocarburo registra inversión récord...',
  ];

  const boletin = [
    '📰 BOLETÍN DIARIO DECODEX - 15/01/2025',
    '═'.repeat(50),
    '',
    'RESUMEN EJECUTIVO',
    '-'.repeat(30),
    'Total de menciones: 47',
    'Menciones positivas: 28 (59.6%)',
    'Menciones negativas: 12 (25.5%)',
    'Menciones neutras: 7 (14.9%)',
    '',
    'PRINCIPALES NOTICIAS',
    '-'.repeat(30),
    ...mentions.map((m, i) => `${i + 1}. ${m}`),
    '',
    'ANÁLISIS DE SENTIMIENTO',
    '-'.repeat(30),
    'Tendencia general: Positivo',
    'Temas dominantes: Economía, Minería, Energía',
    '',
    'METODOLOGÍA',
    '-'.repeat(30),
    'Fuentes monitoreadas: 15 periódicos, 8 portales web, 12 redes sociales',
    'Período: 14/01/2025 06:00 - 15/01/2025 06:00 (BOL)',
    '',
    '─'.repeat(50),
    'Generado automáticamente por DECODEX Bolivia v1.0',
    'Equipo A - Módulo de Distribución',
    'Para dejar de recibir: enviar STOP al 59170000000',
  ].join('\n');

  // Rellenar para exceder 4096 caracteres si es necesario
  const paddedBoletin =
    boletin.length > 4096
      ? boletin
      : boletin + '\n\n' + 'Datos complementarios del reporte: '.repeat(200);

  console.log(`  Tamaño del boletín: ${paddedBoletin.length} caracteres`);

  const fragments = fragmentMessage(paddedBoletin);
  console.log(`  Fragmentos generados: ${fragments.length}`);

  const longResult: WhatsAppDeliveryResult = await sendWhatsApp(
    '+59170000000',
    paddedBoletin,
  );
  printResult('Boletín fragmentado', longResult);

  // ── 6. Manejo de errores ───────────────────────────────────────────────
  section('6. Manejo de errores');

  // Teléfono inválido
  const invalidResult: WhatsAppDeliveryResult = await sendWhatsApp(
    '+999999999999',
    'Mensaje a teléfono inválido',
  );
  printResult('Teléfono inválido', invalidResult);

  // ── 7. Envío a múltiples destinatarios ─────────────────────────────────
  section('7. Envío a múltiples destinatarios');

  const destinatarios: string[] = [
    '+59170000000',
    '+59160000000',
    '+59171112222',
  ];

  const resultados: Array<{ telefono: string; resultado: WhatsAppDeliveryResult }> = [];

  for (const destino of destinatarios) {
    const resultado = await sendWhatsApp(
      destino,
      '📢 Alerta DECODEX: Nueva tendencia detectada en medios sociales.',
    );
    resultados.push({ telefono: destino, resultado: resultado });
  }

  for (const r of resultados) {
    const icon = r.resultado.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.telefono} → ${r.resultado.messageId ?? r.resultado.errorMessage}`);
  }

  // ── Resumen final ──────────────────────────────────────────────────────
  section('Resumen de la ejecución');
  const total = resultados.length + 3; // +3 por los envíos individuales
  const exitosos = resultados.filter((r) => r.resultado.success).length + 3;
  console.log(`  Mensajes enviados: ${exitosos}/${total}`);
  console.log(`  Modo de operación: ${status.provider}`);
  console.log('\n  ✨ Ejemplo completado exitosamente');
}

// Ejecutar
main().catch((error) => {
  console.error('Error en ejemplo:', error);
  process.exit(1);
});
