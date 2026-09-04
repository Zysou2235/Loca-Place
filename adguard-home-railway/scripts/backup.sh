#!/bin/sh
# ---------------------------------------------------------------------------
# Sauvegarde de la configuration et de l'historique AdGuard Home.
#
# Utilisation :
#   adguard-backup                 (dans le conteneur, ou via le cron intégré)
#
# Ce que ça sauvegarde :
#   conf/AdGuardHome.yaml   la configuration complète
#   work/data/querylog*     l'historique des requêtes
#   work/data/stats.db      les statistiques
#   work/data/sessions.db   les sessions de l'interface web
#
# Ce que ça NE sauvegarde pas : work/data/filters (les listes de blocage, qui se
# retéléchargent toutes seules) — inutile et volumineux.
#
# ATTENTION — les archives sont écrites SUR LE MÊME VOLUME que les données.
# Cela protège d'une fausse manipulation ou d'une config corrompue, PAS de la
# perte du volume. Pour une vraie sauvegarde hors site, récupérez les archives
# régulièrement (voir la section « Sauvegardes » du README).
# ---------------------------------------------------------------------------
set -eu

DATA_DIR="${DATA_DIR:-${RAILWAY_VOLUME_MOUNT_PATH:-/data}}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"

log() { printf '[backup] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }

[ -d "$DATA_DIR/conf" ] || { log "ERREUR: $DATA_DIR/conf introuvable."; exit 1; }

mkdir -p "$BACKUP_DIR"

stamp=$(date -u '+%Y%m%d-%H%M%S')
archive="$BACKUP_DIR/adguardhome-$stamp.tar.gz"

log "création de $archive"

tar -czf "$archive.part" \
    --exclude='work/data/filters' \
    --exclude='work/data/userfilters' \
    -C "$DATA_DIR" conf work/data

mv "$archive.part" "$archive"
ln -sf "$(basename "$archive")" "$BACKUP_DIR/latest.tar.gz"

size=$(du -h "$archive" | cut -f1)
log "terminé ($size)"

# Rotation : on ne garde que les BACKUP_KEEP archives les plus récentes.
count=0
ls -1t "$BACKUP_DIR"/adguardhome-*.tar.gz 2>/dev/null | while IFS= read -r old; do
    count=$((count + 1))
    if [ "$count" -gt "$BACKUP_KEEP" ]; then
        log "rotation : suppression de $(basename "$old")"
        rm -f "$old"
    fi
done

exit 0
