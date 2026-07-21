#!/bin/bash
# build-services.sh — Compila worker-service.ts y scheduler-service.ts a JS puro
# Esto elimina la dependencia de tsx en producción y reduce uso de RAM ~60%

set -e
echo "[build-services] Compilando servicios a JS..."

# Crear directorio de salida
mkdir -p dist-services

# Copiar archivos estáticos que los servicios necesitan
if [ -f prisma/db/custom.db ]; then
  mkdir -p dist-services/prisma/db
  cp -r prisma/db/custom.db dist-services/prisma/db/ 2>/dev/null || true
fi

# Compilar worker y scheduler
npx tsc --project tsconfig.services.json

echo "[build-services] ✓ Compilación completa"
echo "[build-services] Archivos generados:"
ls -la dist-services/worker-service.js dist-services/scheduler-service.js 2>/dev/null || echo "  (verificar rutas)"
