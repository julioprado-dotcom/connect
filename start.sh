#!/bin/bash
# ─── DECODEX Bolivia — Script de inicio para Z.ai Sandbox ─────────
# Ejecutar desde /home/z/my-project/connect
# Uso: bash start.sh [--dev] [--build]

set -e
cd "$(dirname "$0")"

MODE="${1:---build}"
PROJECT_DIR="/home/z/my-project/connect"
DB_PATH="$PROJECT_DIR/db/custom.db"
LOG="/tmp/decodex-server.log"

echo "╔══════════════════════════════════════════════════╗"
echo "║   DECODEX Bolivia — Iniciando servidor          ║"
echo "╚══════════════════════════════════════════════════╝"

# 1. Matar procesos previos
pkill -f "next" 2>/dev/null || true
sleep 1

# 2. Verificar DB
if [ ! -f "$DB_PATH" ]; then
  echo "⚠ DB no existe, creando..."
  mkdir -p "$PROJECT_DIR/db"
  npx prisma db push 2>&1 | tail -2
fi

# 3. Build o dev
if [ "$MODE" = "--build" ] || [ "$MODE" = "-b" ]; then
  echo "📦 Build de producción..."
  rm -rf .next
  npx next build 2>&1 | tail -3
  echo "🚀 Servidor en producción (puerto 3000)..."
  NODE_OPTIONS=--max-old-space-size=512 nohup npx next start -p 3000 >> "$LOG" 2>&1 &
else
  echo "🔧 Modo desarrollo (webpack)..."
  NODE_OPTIONS=--max-old-space-size=512 nohup npx next dev -p 3000 --webpack >> "$LOG" 2>&1 &
fi

PID=$!
echo "PID: $PID | Log: $LOG"

# 4. Esperar y verificar
for i in $(seq 1 20); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "✅ Servidor listo — http://localhost:3000"
    exit 0
  fi
  if ! kill -0 $PID 2>/dev/null; then
    echo "❌ El servidor se detuvo inesperadamente. Ver: $LOG"
    tail -20 "$LOG"
    exit 1
  fi
done

echo "⚠ Timeout esperando servidor. Ver: $LOG"
tail -10 "$LOG"
