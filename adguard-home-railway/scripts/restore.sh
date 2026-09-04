#!/bin/sh
# ---------------------------------------------------------------------------
# Restauration d'une archive créée par adguard-backup.
#
#   adguard-restore                       -> restaure la plus récente
#   adguard-restore <chemin-archive>      -> restaure une archive précise
#   adguard-restore --list                -> liste les archives disponibles
#
# La restauration écrase conf/ et work/data/. AdGuard Home garde sa
# configuration en mémoire et la réécrit quand on touche à l'interface : il
# FAUT redémarrer le service juste après (Railway : bouton « Restart »).
# ---------------------------------------------------------------------------
set -eu

DATA_DIR="${DATA_DIR:-${RAILWAY_VOLUME_MOUNT_PATH:-/data}}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"

log() { printf '[restore] %s\n' "$*"; }

if [ "${1:-}" = "--list" ]; then
    ls -lht "$BACKUP_DIR"/adguardhome-*.tar.gz 2>/dev/null || log "aucune archive dans $BACKUP_DIR"
    exit 0
fi

archive="${1:-$BACKUP_DIR/latest.tar.gz}"
[ -f "$archive" ] || { log "ERREUR: archive introuvable : $archive"; exit 1; }

log "contenu de $archive :"
tar -tzf "$archive" | head -n 20

if [ "${FORCE:-0}" != "1" ]; then
    printf 'Écraser conf/ et work/data/ dans %s ? [oui/NON] ' "$DATA_DIR"
    read -r answer
    case "$answer" in
        oui|OUI|o|O|yes|y) : ;;
        *) log "annulé."; exit 1 ;;
    esac
fi

# Copie de sécurité de la config actuelle avant écrasement.
if [ -f "$DATA_DIR/conf/AdGuardHome.yaml" ]; then
    keep="$DATA_DIR/conf/AdGuardHome.yaml.avant-restauration"
    cp "$DATA_DIR/conf/AdGuardHome.yaml" "$keep"
    log "config actuelle conservée dans $keep"
fi

tar -xzf "$archive" -C "$DATA_DIR"
log "restauration terminée."
log "REDÉMARREZ le service maintenant, sinon AdGuard Home réécrira l'ancienne"
log "configuration depuis sa mémoire."
