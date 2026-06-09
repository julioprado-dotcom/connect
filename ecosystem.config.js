// ecosystem.config.js — Configuración PM2 para DECODEX Bolivia
// 3 procesos independientes: Web, Worker, Scheduler
//
// Uso:
//   pm2 start ecosystem.config.js
//   pm2 stop all
//   pm2 restart all
//   pm2 logs decodex
//   pm2 monit

module.exports = {
  apps: [
    // ═══════════════════════════════════════════════════
    // 1. WEB — Next.js (solo UI + APIs ligeras)
    // ═══════════════════════════════════════════════════
    {
      name: 'decodex-web',
      exec_mode: 'fork',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      merge_logs: true,
    },

    // ═══════════════════════════════════════════════════
    // 2. WORKER — Proceso dedicado de ejecución de jobs
    // FIX: Usa ./node_modules/.bin/tsx directo en vez de npx
    // para evitar que npx descargue tsx on-the-fly si no está
    // en node_modules (tsx ahora es dependency, no devDependency)
    // ═══════════════════════════════════════════════════
    {
      name: 'decodex-worker',
      script: './node_modules/.bin/tsx',
      args: 'worker-service.ts',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=768',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,
    },

    // ═══════════════════════════════════════════════════
    // 3. SCHEDULER — Proceso dedicado de programación
    // FIX: Usa ./node_modules/.bin/tsx directo (ver worker)
    // ═══════════════════════════════════════════════════
    {
      name: 'decodex-scheduler',
      script: './node_modules/.bin/tsx',
      args: 'scheduler-service.ts',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      merge_logs: true,
    },
  ],
};
