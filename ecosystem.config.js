// ecosystem.config.js — Configuración PM2 para DECODEX Bolivia
// 3 procesos independientes: Web, Worker, Scheduler
//
// Uso:
//   pm2 start ecosystem.config.js
//   pm2 stop all
//   pm2 restart all
//   pm2 logs decodex
//   pm2 monit

const fs = require('fs');
const useCompiled = fs.existsSync('./dist-services/worker-service.js');

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
      max_memory_restart: '500M',
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
    // Si existe dist-services/worker-service.js (compilado),
    // usa node puro. Si no, fallback a tsx.
    // ═══════════════════════════════════════════════════
    {
      name: 'decodex-worker',
      script: useCompiled
        ? './dist-services/worker-service.js'
        : './node_modules/.bin/tsx',
      args: useCompiled ? '' : 'worker-service.ts',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: useCompiled
          ? '--max-old-space-size=384'
          : '--max-old-space-size=384',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,
    },

    // ═══════════════════════════════════════════════════
    // 3. SCHEDULER — Proceso dedicado de programación
    // ═══════════════════════════════════════════════════
    {
      name: 'decodex-scheduler',
      script: useCompiled
        ? './dist-services/scheduler-service.js'
        : './node_modules/.bin/tsx',
      args: useCompiled ? '' : 'scheduler-service.ts',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
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