#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# _db-path.sh — UNICA fuente de verdad para la ruta de la DB
# DECODEX Bolivia / ONION200 Connect App
# ═══════════════════════════════════════════════════════════════
#
# Todos los scripts shell deben hacer:
#   source "$(dirname "$0")/_db-path.sh"
#
# Esto garantiza que si la ruta cambia, solo se actualiza aquí.
# ═══════════════════════════════════════════════════════════════

# DB canónica — el mismo valor que .env DATABASE_URL
DECODEX_DB_PATH="/home/z/my-project/db/custom.db"

# Directorio de backups
DECODEX_BACKUP_DIR="/home/z/my-project/backups"
