#!/bin/bash
# build-services.sh — Compila worker-service.ts y scheduler-service.ts a JS puro
# Usa esbuild (ya instalado) — transpila sin validar tipos, rápido y liviano

set -e
echo "[build-services] Compilando servicios con esbuild..."

mkdir -p dist-services

# Copiar archivos que los servicios necesitan y no se transpilan
cp -r prisma dist-services/ 2>/dev/null || true
cp -r data dist-services/ 2>/dev/null || true

# Worker service
npx esbuild worker-service.ts \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --outfile=dist-services/worker-service.js \
  --external:./node_modules/* \
  --external:better-sqlite3 \
  --external:@prisma/client \
  --external:sharp \
  --external:puppeteer \
  --log-level=warning

echo "[build-services] ✓ worker-service.js compilado"

# Scheduler service
npx esbuild scheduler-service.ts \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --outfile=dist-services/scheduler-service.js \
  --external:./node_modules/* \
  --external:better-sqlite3 \
  --external:@prisma/client \
  --external:sharp \
  --external:puppeteer \
  --log-level=warning

echo "[build-services] ✓ scheduler-service.js compilado"

# Copiar engine-route.ts (API route del scheduler)
npx esbuild engine-route.ts \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=cjs \
  --outfile=dist-services/engine-route.js \
  --external:./node_modules/* \
  --external:better-sqlite3 \
  --external:@prisma/client \
  --external:sharp \
  --external:puppeteer \
  --log-level=warning

echo "[build-services] ✓ engine-route.js compilado"

# Verificar tamaños
echo "[build-services] Tamaños:"
ls -lh dist-services/*.js

echo "[build-services] ✓ Todos los servicios compilados"