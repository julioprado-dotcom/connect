#!/bin/bash
# DECODEX v0.13.0 — Deploy Script
# Usage: bash deploy.sh

cd /home/z/my-project/connect

# Leer DB path del archivo centralizado
source "$(dirname "$0")/decodeX-bolivia/scripts/_db-path.sh"
export DATABASE_URL="file:${DECODEX_DB_PATH}"
export AUTH_TRUST_HOST=true
export AUTH_SECRET="decodex-dev-secret-key-2025-test"
export NEXTAUTH_URL="http://localhost:3000"

# Kill existing
pkill -f "next start" 2>/dev/null
sleep 1

# Start production server
exec node node_modules/next/dist/bin/next start -p 3000 </dev/null
