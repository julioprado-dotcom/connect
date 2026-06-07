#!/bin/bash
# backup-db.sh — Respalda custom.db al branch db-backup en GitHub
set -e

cd ~/decodex-app
DB_PATH="prisma/db/custom.db"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="/tmp/decodex-db-sync"
# Usar la misma URL del remote (ya tiene token)
REPO_URL=$(git remote get-url origin)

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: No se encuentra $DB_PATH"
  exit 1
fi

MENCIONES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Mencion;" 2>/dev/null || echo "?")
CLASIFICADAS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Mencion WHERE clasificacion != 'no_clasificado';" 2>/dev/null || echo "?")
SIZE_MB=$(du -m "$DB_PATH" | cut -f1)

rm -rf "$BACKUP_DIR"
git clone --single-branch --branch db-backup --depth 1 "$REPO_URL" "$BACKUP_DIR"

mkdir -p "$BACKUP_DIR/prisma/db"
cp "$DB_PATH" "$BACKUP_DIR/prisma/db/custom.db"

cd "$BACKUP_DIR"
git add -f prisma/db/custom.db
git commit -m "DB backup: $TIMESTAMP | $MENCIONES menciones ($CLASIFICADAS clasificadas) | ${SIZE_MB}MB"
git push origin db-backup

cd ~
rm -rf "$BACKUP_DIR"

echo "=========================================="
echo " BACKUP DB COMPLETADO: $TIMESTAMP"
echo " Menciones: $MENCIONES"
echo " Clasificadas: $CLASIFICADAS"
echo " Tamaño: ${SIZE_MB}MB"
echo " Branch: github.com/julioprado-dotcom/connect/tree/db-backup"
echo "=========================================="
