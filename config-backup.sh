#!/usr/bin/env bash
# ─── DECODEX Bolivia — Backup Cifrado de Configuración ─────────────
#
# Cifra .env y .z-ai-config con AES-256-CBC y los guarda como
# .env.enc y .z-ai-config.enc para commitear al repo.
#
# Uso:
#   ./config-backup.sh encrypt    # Cifrar archivos → .enc
#   ./config-backup.sh decrypt    # Descifrar .enc → archivos originales
#   ./config-backup.sh status     # Ver estado de los backups
#
# La passphrase se lee de:
#   1. Variable de entorno CONFIG_BACKUP_PASSPHRASE
#   2. Archivo ~/.config-backup-key (si existe)
#   3. Se pide interactivamente

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

FILES_TO_BACKUP=(".env" ".z-ai-config")
ENCRYPTED_SUFFIX=".enc"
KEY_FILE="$HOME/.config-backup-key"

# ─── Colores ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ─── Obtener passphrase ─────────────────────────────────────────────
get_passphrase() {
    if [[ -n "${CONFIG_BACKUP_PASSPHRASE:-}" ]]; then
        echo "$CONFIG_BACKUP_PASSPHRASE"
    elif [[ -f "$KEY_FILE" ]]; then
        cat "$KEY_FILE"
    else
        echo -n "Enter passphrase for config backup: " >&2
        read -r -s PASS
        echo "" >&2
        echo -n "Confirm passphrase: " >&2
        read -r -s PASS2
        echo "" >&2
        if [[ "$PASS" != "$PASS2" ]]; then
            log_err "Passphrases do not match"
            exit 1
        fi
        echo "$PASS"
    fi
}

# ─── Comando: encrypt ──────────────────────────────────────────────
cmd_encrypt() {
    local PASSPHRASE
    PASSPHRASE=$(get_passphrase)

    local any_encrypted=false
    for file in "${FILES_TO_BACKUP[@]}"; do
        local enc_file="${file}${ENCRYPTED_SUFFIX}"
        if [[ -f "$file" ]]; then
            openssl enc -aes-256-cbc -salt -pbkdf2 -in "$file" -out "$enc_file" -pass "pass:${PASSPHRASE}" 2>/dev/null
            log_ok "Encrypted: $file → $enc_file"
            any_encrypted=true
        else
            log_warn "Skipped: $file (not found)"
        fi
    done

    if $any_encrypted; then
        log_ok "Config backup updated. Commit .enc files to git."
    fi
}

# ─── Comando: decrypt ──────────────────────────────────────────────
cmd_decrypt() {
    local PASSPHRASE
    PASSPHRASE=$(get_passphrase)

    for file in "${FILES_TO_BACKUP[@]}"; do
        local enc_file="${file}${ENCRYPTED_SUFFIX}"
        if [[ -f "$enc_file" ]]; then
            openssl enc -aes-256-cbc -d -pbkdf2 -in "$enc_file" -out "$file" -pass "pass:${PASSPHRASE}" 2>/dev/null
            log_ok "Decrypted: $enc_file → $file"
        else
            log_warn "Skipped: $enc_file (not found)"
        fi
    done
}

# ─── Comando: status ──────────────────────────────────────────────
cmd_status() {
    echo "Config Backup Status"
    echo "===================="
    for file in "${FILES_TO_BACKUP[@]}"; do
        local enc_file="${file}${ENCRYPTED_SUFFIX}"
        if [[ -f "$file" ]]; then
            local size
            size=$(wc -c < "$file")
            echo -e "  $file: ${GREEN}exists${NC} (${size} bytes)"
        else
            echo -e "  $file: ${RED}MISSING${NC}"
        fi

        if [[ -f "$enc_file" ]]; then
            local enc_size
            enc_size=$(wc -c < "$enc_file")
            echo -e "  $enc_file: ${GREEN}exists${NC} (${enc_size} bytes)"
        else
            echo -e "  $enc_file: ${YELLOW}not yet backed up${NC}"
        fi
    done

    if [[ -f "$KEY_FILE" ]]; then
        echo -e "  Key file: ${GREEN}exists${NC} ($KEY_FILE)"
    else
        echo -e "  Key file: ${YELLOW}not set${NC} (will prompt for passphrase)"
    fi
}

# ─── Comando: save-key ─────────────────────────────────────────────
cmd_save_key() {
    if [[ -n "${CONFIG_BACKUP_PASSPHRASE:-}" ]]; then
        echo -n "$CONFIG_BACKUP_PASSPHRASE" > "$KEY_FILE"
        chmod 600 "$KEY_FILE"
        log_ok "Passphrase saved to $KEY_FILE"
    else
        echo -n "Enter passphrase to save: " >&2
        read -r -s PASS
        echo "" >&2
        echo -n "$PASS" > "$KEY_FILE"
        chmod 600 "$KEY_FILE"
        log_ok "Passphrase saved to $KEY_FILE"
    fi
}

# ─── Main ───────────────────────────────────────────────────────────
case "${1:-status}" in
    encrypt|enc|e)  cmd_encrypt ;;
    decrypt|dec|d)  cmd_decrypt ;;
    status|st|s)    cmd_status ;;
    save-key)       cmd_save_key ;;
    *)              echo "Usage: $0 {encrypt|decrypt|status|save-key}" >&2; exit 1 ;;
esac
