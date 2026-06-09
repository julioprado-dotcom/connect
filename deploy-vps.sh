#!/bin/bash
# ─── DECODEX Bolivia — Deploy Completo a VPS ───────────────────────
#
# Este script hace todo el proceso de deploy:
# 1. Detiene servicios PM2
# 2. Hace backup de la BD
# 3. Preserva configs (.env, .z-ai-config) antes de git pull
# 4. Hace git pull con las últimas changes
# 5. Restaura configs (desde .enc si es necesario)
# 6. Instala dependencias si falta node_modules
# 7. Hace build
# 8. Reinicia servicios PM2
#
# Uso:
#   cd /root/decodex-app
#   bash deploy-vps.sh
#
# Si los configs (.env / .z-ai-config) no existen pero los .enc sí,
# intenta descifrarlos. Necesita la passphrase en ~/.config-backup-key
# o en CONFIG_BACKUP_PASSPHRASE.

set -euo pipefail

PROJECT_DIR="/root/decodex-app"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "  DECODEX Bolivia — Deploy VPS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. PARAR SERVICIOS ──────────────────────────────────────────
echo "[1/7] Deteniendo servicios PM2..."
pm2 stop all 2>/dev/null || true
echo "  OK"
echo ""

# ─── 2. BACKUP DE BD ────────────────────────────────────────────
echo "[2/7] Backup de BD..."
mkdir -p prisma/db/backups
DB_FILE="prisma/db/custom.db"
if [[ -f "$DB_FILE" ]]; then
    BACKUP_NAME="pre-deploy-$(date +%Y%m%d-%H%M).db"
    cp "$DB_FILE" "prisma/db/backups/${BACKUP_NAME}"
    echo "  OK → prisma/db/backups/${BACKUP_NAME}"
else
    echo "  SKIP (BD no encontrada)"
fi
echo ""

# ─── 3. PRESERVAR CONFIGS antes de git pull ─────────────────────
echo "[3/7] Preservando configs..."
TEMP_DIR=$(mktemp -d)
CONFIGS_SAVED=false

if [[ -f .env ]]; then
    cp .env "$TEMP_DIR/.env"
    CONFIGS_SAVED=true
    echo "  .env → respaldado"
else
    echo "  .env → NO EXISTE"
fi

if [[ -f .z-ai-config ]]; then
    cp .z-ai-config "$TEMP_DIR/.z-ai-config"
    CONFIGS_SAVED=true
    echo "  .z-ai-config → respaldado"
else
    echo "  .z-ai-config → NO EXISTE"
fi
echo ""

# ─── 4. GIT PULL ──────────────────────────────────────────────────
echo "[4/7] Git pull..."
git checkout -- . 2>/dev/null || true
git clean -fd .next/ 2>/dev/null || true
git pull --no-rebase origin main
echo "  OK"
echo ""

# ─── 5. RESTAURAR CONFIGS ────────────────────────────────────────
echo "[5/7] Restaurando configs..."

# Si los archivos no existen después del pull, intentar descifrar desde .enc
if [[ ! -f .env ]] && [[ -f .env.enc ]]; then
    if [[ -f ~/.config-backup-key ]]; then
        openssl enc -aes-256-cbc -d -pbkdf2 -in .env.enc -out .env -pass "pass:$(cat ~/.config-backup-key)" 2>/dev/null && \
            echo "  .env → restaurado desde .env.enc" || \
            echo "  .env.enc → ERROR al descifrar (passphrase incorrecta?)"
    elif [[ -n "${CONFIG_BACKUP_PASSPHRASE:-}" ]]; then
        openssl enc -aes-256-cbc -d -pbkdf2 -in .env.enc -out .env -pass "pass:${CONFIG_BACKUP_PASSPHRASE}" 2>/dev/null && \
            echo "  .env → restaurado desde .env.enc" || \
            echo "  .env.enc → ERROR al descifrar"
    else
        echo "  .env.enc encontrado pero NO hay passphrase (crear ~/.config-backup-key)"
    fi
elif [[ -f .env ]]; then
    echo "  .env → ya existe (no sobrescribir)"
fi

if [[ ! -f .z-ai-config ]] && [[ -f .z-ai-config.enc ]]; then
    if [[ -f ~/.config-backup-key ]]; then
        openssl enc -aes-256-cbc -d -pbkdf2 -in .z-ai-config.enc -out .z-ai-config -pass "pass:$(cat ~/.config-backup-key)" 2>/dev/null && \
            echo "  .z-ai-config → restaurado desde .z-ai-config.enc" || \
            echo "  .z-ai-config.enc → ERROR al descifrar (passphrase incorrecta?)"
    elif [[ -n "${CONFIG_BACKUP_PASSPHRASE:-}" ]]; then
        openssl enc -aes-256-cbc -d -pbkdf2 -in .z-ai-config.enc -out .z-ai-config -pass "pass:${CONFIG_BACKUP_PASSPHRASE}" 2>/dev/null && \
            echo "  .z-ai-config → restaurado desde .z-ai-config.enc" || \
            echo "  .z-ai-config.enc → ERROR al descifrar"
    else
        echo "  .z-ai-config.enc encontrado pero NO hay passphrase"
    fi
elif [[ -f .z-ai-config ]]; then
    echo "  .z-ai-config → ya existe (no sobrescribir)"
fi

# Si el pull no borró los configs y estaban respaldados en temp, no hacer nada extra
# (los configs del temp son por si git pull hubiera fallado)
rm -rf "$TEMP_DIR"
echo ""

# ─── 6. DEPENDENCIAS + BUILD ─────────────────────────────────────
echo "[6/7] Instalando dependencias y build..."
if [[ ! -d "node_modules" ]]; then
    echo "  npm install..."
    npm install --production 2>&1 | tail -3
fi

echo "  next build..."
npm run build 2>&1 | tail -10
echo "  OK"
echo ""

# ─── 7. REINICIAR ───────────────────────────────────────────────
echo "[7/7] Reiniciando servicios PM2..."
pm2 restart all
echo "  OK"
echo ""

# ─── VERIFICACIÓN ─────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  Deploy completado. Verificación:"
echo "═══════════════════════════════════════════════════════════"
sleep 3
pm2 list
echo ""
echo "Config files:"
ls -la .env .z-ai-config 2>&1
echo ""
echo "Servidor web:"
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/ 2>/dev/null || echo "NO RESPONSE"
echo ""
