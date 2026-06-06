# DECODEX Bolivia — Guía de Deploy a VPS

## Entorno VPS

- **Proveedor:** Alibaba Cloud
- **Ruta proyecto:** `/root/decodex-app/`
- **Gestor de procesos:** PM2 (no systemd, no Docker)
- **Usuario:** root

### Servicios PM2

| ID | Nombre | Comando | Descripción |
|----|--------|---------|-------------|
| 1 | decodex-worker | `tsx worker-service.ts` | Procesa notas, clasificación, colas |
| 2 | decodex-scheduler | `tsx scheduler-service.ts` | Tareas programadas (captura, boletines) |
| 3 | decodex-web | `next start -p 3000` | Servidor web Next.js |

### Base de Datos

- **Ruta:** `/root/decodex-app/prisma/db/custom.db`
- **Backups:** `/root/decodex-app/prisma/db/backups/`
- **NUNCA trackear en git** — ya excluido en `.gitignore`

### Ecosistema PM2

```bash
pm2 list                              # Ver estado de servicios
pm2 logs decodex-worker --lines 50    # Logs del worker
pm2 logs decodex-scheduler --lines 50 # Logs del scheduler
pm2 logs decodex-web --lines 50       # Logs del web
pm2 monit                              # Monitor en tiempo real
pm2 restart all                       # Reiniciar todo
pm2 restart decodex-worker            # Reiniciar uno solo
pm2 stop all                          # Detener todo
```

---

## Deploy Completo (comando de una línea)

```bash
pm2 stop all && cd /root/decodex-app && git checkout -- . && git clean -fd .next/ && git pull --no-rebase origin main && npm run build 2>&1 | tail -10 && pm2 restart all
```

### Paso a paso (si algo falla)

```bash
# 1. PARAR SERVICIOS
pm2 stop all

# 2. IR AL PROYECTO Y LIMPIAR cambios locales
cd /root/decodex-app
git checkout -- .        # Descartar cambios en archivos rastreados
git clean -fd .next/      # Borrar archivos no rastreados en .next/

# 3. PULL
git pull --no-rebase origin main

# 4. BUILD
npm run build 2>&1 | tail -30

# 5. REINICIAR
pm2 restart all

# 6. VERIFICAR
sleep 3
curl -s http://localhost:3000/api/seed | head -c 300
pm2 list
```

### Respaldo antes de deploy

```bash
cp /root/decodex-app/prisma/db/custom.db /root/decodex-app/prisma/db/backups/pre-deploy-$(date +%Y%m%d-%H%M).db
```

---

## Problema Conocido: .next/ trackeado en git

Los builds de `.next/` están rastreados en git por herencia del repo original. Esto causa conflictos en cada `git pull` porque el VPS genera su propio build.

**Solución:** siempre ejecutar `git checkout -- . && git clean -fd .next/` antes del pull.

**Fix permanente (pendiente):** en algún momento limpiar `.next/` del tracking de git:
```bash
git rm -r --cached .next/
git commit -m "chore: eliminar .next/ del tracking de git"
echo ".next/" >> .gitignore
git push
```

---

## Problemas Conocidos Detectados (7 Jun 2026)

### 1. Worker crash loop (432 reinicios)
- El worker se reinicia constantemente
- Verificar con: `pm2 logs decodex-worker --lines 50 --nostream`
- Posibles causas: error en `worker-service.ts`, dependencia rota, BD corrupta

### 2. Scheduler "INICIALIZANDO"
- No termina de arrancar
- Verificar con: `pm2 logs decodex-scheduler --lines 50 --nostream`

### 3. Dashboard con métricas en 0
- Menciones hoy: 0
- Clasificación: 0%
- Productos semana: 0
- IA tokens: 0
- Puede ser porque worker/scheduler no están procesando

### 4. BD reportada como 0 MB
- El widget "Vital Monitor" muestra tamaño BD = 0 MB
- Verificar con: `ls -lh /root/decodex-app/prisma/db/custom.db`

---

## API Endpoints Útiles para Diagnóstico

```bash
# Salud del sistema
curl -s http://localhost:3000/api/system/vitals

# Estado de procesos
curl -s http://localhost:3000/api/system/processes

# Stats generales
curl -s http://localhost:3000/api/stats

# Seed (requiere auth)
curl -s http://localhost:3000/api/seed
```

---

## Arquitectura del Proyecto

- **Framework:** Next.js 16.2.4 (Turbopack)
- **DB:** Prisma + SQLite (custom.db)
- **ORM:** Prisma Client (pre-generado en `prisma/generated-client/`)
- **Seed:** `/src/app/api/seed/route.ts` — 12 dominios estructurales + 73 subejes + 9 lentes transversales
- **Servicios:** worker-service.ts, scheduler-service.ts

### Estructura clave
```
src/
├── app/api/           # API routes
│   ├── seed/          # Seed de ejes, lentes, keywords
│   ├── system/        # Vitals, processes
│   └── ...
├── components/
│   ├── dashboard/     # Widgets del dashboard
│   └── views/         # Vistas de navegación
├── lib/
│   ├── db.ts          # Prisma client
│   └── services/      # Servicios de cola, email, whatsapp
prisma/
├── db/custom.db       # Base de datos (NO trackear)
├── db/backups/        # Backups automáticos
└── schema.prisma      # Schema
```
