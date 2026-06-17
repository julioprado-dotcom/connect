#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# fix-datetime-integer-to-iso.sh — Migración completa DateTime
# DECODEX Bolivia / ONION200
# ═══════════════════════════════════════════════════════════════
#
# Convierte TODOS los campos DateTime almacenados como integers
# (milisegundos Unix) a strings ISO 8601 en UTC.
#
# Uso:
#   cd /root/decodex-app
#   bash scripts/fix-datetime-integer-to-iso.sh
#
# PRECAUCIÓN: Hace backup automático antes de migrar.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
source "${SCRIPT_DIR}/_db-path.sh"

DB_PATH="${DECODEX_DB_PATH}"
BACKUP_FILE="${PROJECT_DIR}/prisma/db/pre-iso-migration-$(date +%Y%m%d-%H%M%S).db"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[iso-fix]${NC} $1"; }
log_warn()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[iso-fix]${NC} $1"; }
log_error() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[iso-fix]${NC} $1" >&2; }

# ─── Verificaciones ──────────────────────────────────────────
if [ ! -f "$DB_PATH" ]; then
  log_error "DB no encontrada: ${DB_PATH}"
  exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
  log_error "sqlite3 no está instalado"
  exit 1
fi

DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "DB: ${DB_PATH} (${DB_SIZE})"

# ─── Backup automático ──────────────────────────────────────
log_info "Creando backup pre-migración: ${BACKUP_FILE}"
cp "$DB_PATH" "$BACKUP_FILE"
if command -v sqlite3 &>/dev/null; then
  INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" = "ok" ]; then
    log_info "Backup integridad: OK"
  else
    log_error "Backup corrupto: ${INTEGRITY} — abortando"
    exit 1
  fi
fi

# ─── Contar integers antes ──────────────────────────────────
log_info "Contando campos DateTime en formato integer ANTES de la migración..."

TOTAL_INTEGERS_BEFORE=0
TOTAL_CELLS=0
TABLES_FIXED=0

# Función para convertir una columna
# Uso: convert_column TABLA COLUMNA [nullable]
convert_column() {
  local table="$1"
  local column="$2"
  local nullable="${3:-false}"

  # Contar integers en esta columna
  local count_sql="SELECT COUNT(*) FROM ${table} WHERE typeof(${column}) = 'integer' AND ${column} > 0"
  if [ "$nullable" = "true" ]; then
    count_sql="SELECT COUNT(*) FROM ${table} WHERE typeof(${column}) = 'integer' AND ${column} IS NOT NULL AND ${column} > 0"
  fi

  local int_count
  int_count=$(sqlite3 "$DB_PATH" "$count_sql" 2>/dev/null || echo "0")

  if [ "$int_count" = "0" ]; then
    return 0
  fi

  TOTAL_INTEGERS_BEFORE=$((TOTAL_INTEGERS_BEFORE + int_count))

  # Convertir: datetime(ms / 1000, 'unixepoch') → ISO UTC
  local update_sql="UPDATE ${table} SET ${column} = datetime(${column} / 1000, 'unixepoch') WHERE typeof(${column}) = 'integer' AND ${column} > 0"
  if [ "$nullable" = "true" ]; then
    update_sql="UPDATE ${table} SET ${column} = datetime(${column} / 1000, 'unixepoch') WHERE typeof(${column}) = 'integer' AND ${column} IS NOT NULL AND ${column} > 0"
  fi

  local result
  result=$(sqlite3 "$DB_PATH" "$update_sql" 2>&1)

  if [ $? -eq 0 ]; then
    # Verificar que ya no hay integers
    local remaining
    remaining=$(sqlite3 "$DB_PATH" "$count_sql" 2>/dev/null || echo "?")
    log_info "  ✓ ${table}.${column}: ${int_count} integers → ISO (remaining: ${remaining})"
  else
    log_error "  ✗ ${table}.${column}: ERROR — ${result}"
  fi

  TABLES_FIXED=$((TABLES_FIXED + 1))
}

# ─── Ejecutar conversiones por tabla ────────────────────────
log_info ""
log_info "${CYAN}── Fase 1: Tablas principales ──${NC}"

# Account
convert_column "Account" "createdAt"
convert_column "Account" "updatedAt"

# AdminFeedback
convert_column "AdminFeedback" "createdAt"
convert_column "AdminFeedback" "updatedAt"
convert_column "AdminFeedback" "aplicadaEn" true

# AprendizajeSistema
convert_column "AprendizajeSistema" "createdAt"
convert_column "AprendizajeSistema" "updatedAt"

# CapturaLog
convert_column "CapturaLog" "fecha"

# Cliente
convert_column "Cliente" "fechaCreacion"
convert_column "Cliente" "fechaActualizacion"

# Comentario
convert_column "Comentario" "fechaComentario" true
convert_column "Comentario" "fechaCaptura"

# Contrato
convert_column "Contrato" "fechaCreacion"
convert_column "Contrato" "fechaActualizacion"
convert_column "Contrato" "fechaInicio"
convert_column "Contrato" "fechaFin" true
convert_column "Contrato" "fechaProgramada" true

# EjeTematico
convert_column "EjeTematico" "createdAt"
convert_column "EjeTematico" "updatedAt"

# Entrega
convert_column "Entrega" "fechaCreacion"
convert_column "Entrega" "fechaActualizacion"
convert_column "Entrega" "fechaProgramada" true
convert_column "Entrega" "fechaEnvio" true

# EnvioReporte
convert_column "EnvioReporte" "enviadoEn" true

log_info ""
log_info "${CYAN}── Fase 2: Fuentes, NotaRaw, Menciones ──${NC}"

# FuenteErrorLog
convert_column "FuenteErrorLog" "fecha"

# FuenteEstado (tabla que usa el scheduler)
convert_column "FuenteEstado" "ultimoCheck" true
convert_column "FuenteEstado" "ultimoCambio" true
convert_column "FuenteEstado" "ultimoCheckOk" true
convert_column "FuenteEstado" "ultimoHeadline" true
convert_column "FuenteEstado" "ultimoTexto" true
convert_column "FuenteEstado" "ultimoMencion" true

# Indicador
convert_column "Indicador" "fechaCreacion"
convert_column "Indicador" "fechaActualizacion"

# IndicadorEvaluacion
convert_column "IndicadorEvaluacion" "fechaEvaluacion"

# IndicadorValor
convert_column "IndicadorValor" "fecha"

# Job
convert_column "Job" "fechaCreacion"
convert_column "Job" "fechaActualizacion"
convert_column "Job" "fechaInicio"
convert_column "Job" "fechaFin" true
convert_column "Job" "proximaEjecucion" true

# Keyword
convert_column "Keyword" "createdAt"
convert_column "Keyword" "updatedAt"

# Lente
convert_column "Lente" "createdAt"
convert_column "Lente" "updatedAt"

# Medio
convert_column "Medio" "fechaCreacion"
convert_column "Medio" "ultimaRevisionHumana" true

# Mencion — LA MÁS IMPORTANTE
convert_column "Mencion" "fechaPublicacion" true
convert_column "Mencion" "fechaCaptura"
convert_column "Mencion" "fechaClasificacion" true
convert_column "Mencion" "fechaCreacion"
convert_column "Mencion" "fechaVerificacion" true
convert_column "Mencion" "evidenciaTimestamp" true

# NotaRaw
convert_column "NotaRaw" "fechaCaptura"
convert_column "NotaRaw" "fechaPublicacion" true
convert_column "NotaRaw" "fechaProcesada" true

log_info ""
log_info "${CYAN}── Fase 3: Reportes, Productos, Usuarios ──${NC}"

# Persona
convert_column "Persona" "fechaCreacion"

# Reporte
convert_column "Reporte" "fechaCreacion"
convert_column "Reporte" "fechaInicio"
convert_column "Reporte" "fechaFin"
convert_column "Reporte" "fechaEnvio" true

# ReporteSectorial
convert_column "ReporteSectorial" "periodoInicio"
convert_column "ReporteSectorial" "periodoFin"
convert_column "ReporteSectorial" "creadoEn"
convert_column "ReporteSectorial" "generadoEn" true
convert_column "ReporteSectorial" "enviadoEn" true

# Session
convert_column "Session" "expires"

# SugerenciaInteligencia
convert_column "SugerenciaInteligencia" "createdAt"
convert_column "SugerenciaInteligencia" "updatedAt"
convert_column "SugerenciaInteligencia" "procesadaEn" true

# SuscriptorGratuito
convert_column "SuscriptorGratuito" "fechaSuscripcion"

# SystemLog
convert_column "SystemLog" "fecha"

# User
convert_column "User" "emailVerified" true
convert_column "User" "fechaCreacion"

# VerificationToken
convert_column "VerificationToken" "expires"

# cambio_marco_conceptual
convert_column "cambio_marco_conceptual" "creadoEn"

# eje_tematico_cliente
convert_column "eje_tematico_cliente" "creadoEn"
convert_column "eje_tematico_cliente" "editadoEn" true

# marco_conceptual
convert_column "marco_conceptual" "creadoEn"
convert_column "marco_conceptual" "editadoEn" true

# NotaEje
convert_column "NotaEje" "createdAt"

# RechazoCaptura
convert_column "RechazoCaptura" "createdAt"

# UsoIA
convert_column "UsoIA" "createdAt"

log_info ""
log_info "${CYAN}── Fase 4: Verificación final ──${NC}"

# Contar integers restantes
TOTAL_INTEGERS_AFTER=0
check_remaining() {
  local table="$1"
  local column="$2"
  local nullable="${3:-false}"
  local sql="SELECT COUNT(*) FROM ${table} WHERE typeof(${column}) = 'integer' AND ${column} > 0"
  if [ "$nullable" = "true" ]; then
    sql="SELECT COUNT(*) FROM ${table} WHERE typeof(${column}) = 'integer' AND ${column} IS NOT NULL AND ${column} > 0"
  fi
  local count
  count=$(sqlite3 "$DB_PATH" "$sql" 2>/dev/null || echo "0")
  TOTAL_INTEGERS_AFTER=$((TOTAL_INTEGERS_AFTER + count))
  if [ "$count" != "0" ]; then
    log_warn "  ⚠ ${table}.${column}: ${count} integers restantes"
  fi
}

# Re-check todas las columnas (misma lista que arriba)
for entry in \
  "Account:createdAt:false" "Account:updatedAt:false" \
  "AdminFeedback:createdAt:false" "AdminFeedback:updatedAt:false" "AdminFeedback:aplicadaEn:true" \
  "AprendizajeSistema:createdAt:false" "AprendizajeSistema:updatedAt:false" \
  "CapturaLog:fecha:false" \
  "Cliente:fechaCreacion:false" "Cliente:fechaActualizacion:false" \
  "Comentario:fechaComentario:true" "Comentario:fechaCaptura:false" \
  "Contrato:fechaCreacion:false" "Contrato:fechaActualizacion:false" "Contrato:fechaInicio:false" "Contrato:fechaFin:true" "Contrato:fechaProgramada:true" \
  "EjeTematico:createdAt:false" "EjeTematico:updatedAt:false" \
  "Entrega:fechaCreacion:false" "Entrega:fechaActualizacion:false" "Entrega:fechaProgramada:true" "Entrega:fechaEnvio:true" \
  "EnvioReporte:enviadoEn:true" \
  "FuenteEstado:ultimoCheck:true" "FuenteEstado:ultimoCambio:true" "FuenteEstado:ultimoCheckOk:true" "FuenteEstado:ultimoHeadline:true" "FuenteEstado:ultimoTexto:true" "FuenteEstado:ultimoMencion:true" \
  "Indicador:fechaCreacion:false" "Indicador:fechaActualizacion:false" \
  "IndicadorEvaluacion:fechaEvaluacion:false" \
  "IndicadorValor:fecha:false" \
  "Job:fechaCreacion:false" "Job:fechaActualizacion:false" "Job:fechaInicio:false" "Job:fechaFin:true" "Job:proximaEjecucion:true" \
  "Keyword:createdAt:false" "Keyword:updatedAt:false" \
  "Lente:createdAt:false" "Lente:updatedAt:false" \
  "Medio:fechaCreacion:false" "Medio:ultimaRevisionHumana:true" \
  "Mencion:fechaPublicacion:true" "Mencion:fechaCaptura:false" "Mencion:fechaClasificacion:true" "Mencion:fechaCreacion:false" "Mencion:fechaVerificacion:true" "Mencion:evidenciaTimestamp:true" \
  "NotaRaw:fechaCaptura:false" "NotaRaw:fechaPublicacion:true" "NotaRaw:fechaProcesada:true" \
  "Persona:fechaCreacion:false" \
  "Reporte:fechaCreacion:false" "Reporte:fechaInicio:false" "Reporte:fechaFin:false" "Reporte:fechaEnvio:true" \
  "ReporteSectorial:periodoInicio:false" "ReporteSectorial:periodoFin:false" "ReporteSectorial:creadoEn:false" "ReporteSectorial:generadoEn:true" "ReporteSectorial:enviadoEn:true" \
  "Session:expires:false" \
  "SugerenciaInteligencia:createdAt:false" "SugerenciaInteligencia:updatedAt:false" "SugerenciaInteligencia:procesadaEn:true" \
  "SuscriptorGratuito:fechaSuscripcion:false" \
  "SystemLog:fecha:false" \
  "User:emailVerified:true" "User:fechaCreacion:false" \
  "VerificationToken:expires:false" \
  "cambio_marco_conceptual:creadoEn:false" \
  "eje_tematico_cliente:creadoEn:false" "eje_tematico_cliente:editadoEn:true" \
  "marco_conceptual:creadoEn:false" "marco_conceptual:editadoEn:true" \
  "NotaEje:createdAt:false" \
  "RechazoCaptura:createdAt:false" \
  "UsoIA:createdAt:false"; do
  IFS=':' read -r table column nullable <<< "$entry"
  check_remaining "$table" "$column" "$nullable"
done

# ─── Resumen ─────────────────────────────────────────────────
log_info ""
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "RESULTADO:"
log_info "  Columnas procesadas: ${TABLES_FIXED}"
log_info "  Integers antes: ${TOTAL_INTEGERS_BEFORE}"
log_info "  Integers después: ${TOTAL_INTEGERS_AFTER}"
log_info "  Backup: ${BACKUP_FILE}"

if [ "$TOTAL_INTEGERS_AFTER" -eq 0 ]; then
  log_info "${GREEN}✓ MIGRACIÓN COMPLETADA — todos los DateTime ahora son ISO${NC}"
else
  log_warn "${YELLOW}⚠ ${TOTAL_INTEGERS_AFTER} integers restantes — revisar las columnas marcadas arriba${NC}"
fi

# ─── Verificar integridad post-migración ─────────────────────
FINAL_INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>/dev/null | head -1)
if [ "$FINAL_INTEGRITY" = "ok" ]; then
  log_info "Integridad post-migración: OK"
else
  log_error "Integridad post-migración: ${FINAL_INTEGRITY} — restaurar desde backup"
  log_error "  cp ${BACKUP_FILE} ${DB_PATH}"
fi

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"