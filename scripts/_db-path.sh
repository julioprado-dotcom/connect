#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# _db-path.sh — UNICA fuente de verdad para la ruta de la DB
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# Todos los scripts shell deben hacer:
#   source "$(dirname "$0")/_db-path.sh"
# ═══════════════════════════════════════════════════════════════

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DECODEX_DB_PATH="${PROJECT_ROOT}/prisma/db/custom.db"
DECODEX_BACKUP_DIR="${PROJECT_ROOT}/prisma/db/backups"
