#!/bin/sh
# ---------------------------------------------------------------------------
# Point d'entrée AdGuard Home pour Railway.
#
#   1. prépare le volume persistant (conf/ + work/) ;
#   2. au premier démarrage, génère AdGuardHome.yaml depuis le modèle ;
#   3. aux démarrages suivants, réaligne uniquement le port web sur $PORT
#      (Railway peut le changer) et laisse le reste de la config tranquille ;
#   4. lance éventuellement le cron de sauvegarde ;
#   5. exécute AdGuard Home en PID 1.
# ---------------------------------------------------------------------------
set -eu

# Surchargeable pour les tests ; en production, valeurs posées par le Dockerfile.
LIB_DIR="${LIB_DIR:-/usr/local/lib/adguard-railway}"
SEED_FILE="${SEED_FILE:-$LIB_DIR/AdGuardHome.yaml}"
ADGUARD_BIN="${ADGUARD_BIN:-/opt/adguardhome/AdGuardHome}"

log()  { printf '[entrypoint] %s\n' "$*" >&2; }
die()  { printf '[entrypoint] ERREUR: %s\n' "$*" >&2; exit 1; }

# --- Emplacement des données ------------------------------------------------
# Railway expose RAILWAY_VOLUME_MOUNT_PATH quand un volume est attaché.
DATA_DIR="${DATA_DIR:-${RAILWAY_VOLUME_MOUNT_PATH:-/data}}"
CONF_DIR="$DATA_DIR/conf"
WORK_DIR="$DATA_DIR/work"
CONF_FILE="$CONF_DIR/AdGuardHome.yaml"

mkdir -p "$CONF_DIR" "$WORK_DIR/data" 2>/dev/null || true

[ -d "$CONF_DIR" ] && [ -d "$WORK_DIR/data" ] \
    || die "impossible de préparer $DATA_DIR (droits insuffisants ?)."
[ -w "$DATA_DIR" ] || die "$DATA_DIR n'est pas accessible en écriture."

# Sur Railway sans volume attaché, les données atterrissent dans la couche
# éphémère du conteneur : tout disparaît au redéploiement suivant.
if [ -n "${RAILWAY_ENVIRONMENT_NAME:-${RAILWAY_ENVIRONMENT:-}}" ] \
   && [ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
    log "ATTENTION: aucun volume Railway détecté (RAILWAY_VOLUME_MOUNT_PATH vide)."
    log "           Les données sont écrites dans $DATA_DIR, à l'intérieur du"
    log "           conteneur : mot de passe, réglages et historique seront"
    log "           PERDUS au prochain déploiement. Ajoutez un volume monté"
    log "           sur /data (Settings -> Volumes)."
fi

# --- Paramètres -------------------------------------------------------------
WEB_PORT="${PORT:-3000}"
ADMIN_USER="${ADMIN_USER:-admin}"
PLAIN_DNS_PORT="${PLAIN_DNS_PORT:-5353}"
RATELIMIT="${RATELIMIT:-60}"
QUERYLOG_RETENTION="${QUERYLOG_RETENTION:-720h}"
STATS_RETENTION="${STATS_RETENTION:-720h}"
UPSTREAM_DNS="${UPSTREAM_DNS:-https://dns.quad9.net/dns-query,https://dns.cloudflare.com/dns-query}"
TRUSTED_PROXIES="${TRUSTED_PROXIES:-0.0.0.0/0,::/0}"
ALLOWED_CLIENT_IDS="${ALLOWED_CLIENT_IDS:-}"

# Transforme une liste « a,b c;d » en une valeur par ligne.
to_lines() {
    printf '%s' "$1" | tr ',;' '\n\n' | tr ' \t' '\n\n'
}

# Un ClientID doit être une étiquette de nom d'hôte valide : lettres, chiffres
# et tirets, ni au début ni à la fin, 63 caractères maximum. Pas de « _ », pas
# de point, pas d'accent.
validate_client_id() {
    id=$1
    case "$id" in
        -*|*-)          die "ClientID invalide '$id' : ne peut ni commencer ni finir par un tiret." ;;
        *[!a-z0-9-]*)   die "ClientID invalide '$id' : uniquement a-z, 0-9 et '-'." ;;
    esac
    [ "${#id}" -le 63 ] || die "ClientID invalide '$id' : 63 caractères maximum."
}

# --- Mot de passe administrateur -------------------------------------------
resolve_password_hash() {
    if [ -n "${ADMIN_PASSWORD_HASH:-}" ]; then
        printf '%s' "$ADMIN_PASSWORD_HASH"
        return 0
    fi
    if [ -n "${ADMIN_PASSWORD:-}" ]; then
        htpasswd -nbB -C "${BCRYPT_COST:-10}" "$ADMIN_USER" "$ADMIN_PASSWORD" \
            | head -n 1 | cut -d: -f2-
        return 0
    fi
    return 1
}

require_password_hash() {
    if ! hash_value=$(resolve_password_hash); then
        die "aucun mot de passe administrateur défini.
  Renseignez ADMIN_PASSWORD (en clair, haché au démarrage) ou
  ADMIN_PASSWORD_HASH (bcrypt, recommandé).
  Le service est volontairement bloqué : sans mot de passe, l'interface
  d'administration serait publiquement ouverte."
    fi
    case "$hash_value" in
        '$2'*) : ;;
        *) die "ADMIN_PASSWORD_HASH ne ressemble pas à un hash bcrypt (\$2a\$/\$2b\$/\$2y\$).
  Générez-le avec : scripts/hash-password.sh 'votre-mot-de-passe'" ;;
    esac
    printf '%s' "$hash_value"
}

# --- Premier démarrage : génération de la configuration ---------------------
build_persistent_clients() {
    block=""
    old_ifs=$IFS
    IFS='
'
    for cid in $1; do
        [ -n "$cid" ] || continue
        block="$block    - name: $cid
      ids:
        - $cid
      tags: []
      upstreams: []
      use_global_settings: true
      use_global_blocked_services: true
      filtering_enabled: true
      safebrowsing_enabled: true
      parental_enabled: false
      ignore_querylog: false
      ignore_statistics: false
"
    done
    IFS=$old_ifs
    # Retire le retour à la ligne final ajouté par la concaténation.
    printf '%s' "${block%
}"
}

render_config() {
    client_ids=$(to_lines "$(printf '%s' "$ALLOWED_CLIENT_IDS" | tr 'A-Z' 'a-z')")

    old_ifs=$IFS
    IFS='
'
    for cid in $client_ids; do
        [ -n "$cid" ] && validate_client_id "$cid"
    done
    IFS=$old_ifs

    persistent_block=$(build_persistent_clients "$client_ids")

    CFG_WEB_PORT="$WEB_PORT" \
    CFG_ADMIN_USER="$ADMIN_USER" \
    CFG_ADMIN_PASSWORD_HASH="$1" \
    CFG_PLAIN_DNS_PORT="$PLAIN_DNS_PORT" \
    CFG_RATELIMIT="$RATELIMIT" \
    CFG_QUERYLOG_RETENTION="$QUERYLOG_RETENTION" \
    CFG_STATS_RETENTION="$STATS_RETENTION" \
    CFG_WORK_DIR="$WORK_DIR" \
    LIST_UPSTREAM_DNS="$(to_lines "$UPSTREAM_DNS")" \
    LIST_ALLOWED_CLIENTS="$client_ids" \
    LIST_TRUSTED_PROXIES="$(to_lines "$TRUSTED_PROXIES")" \
    BLOCK_PERSISTENT_CLIENTS="$persistent_block" \
    awk -f "$LIB_DIR/render-config.awk" "$SEED_FILE" > "$CONF_FILE.tmp"

    mv "$CONF_FILE.tmp" "$CONF_FILE"

    if [ -n "$client_ids" ]; then
        log "accès restreint aux ClientID : $(printf '%s' "$client_ids" | tr '\n' ' ')"
    else
        log "ATTENTION: ALLOWED_CLIENT_IDS est vide — le point d'accès DoH"
        log "           répondra à n'importe qui connaissant l'URL."
    fi
}

# --- Démarrages suivants : réalignement minimal -----------------------------
sync_web_port() {
    current=$(awk '/^  address:/ { print $2; exit }' "$CONF_FILE")
    wanted="0.0.0.0:$WEB_PORT"
    if [ -z "$current" ]; then
        log "ATTENTION: aucune clé 'http.address' trouvée dans $CONF_FILE."
        return 0
    fi
    if [ "$current" != "$wanted" ]; then
        log "port web : $current -> $wanted"
        sed -i "s|^  address: .*|  address: $wanted|" "$CONF_FILE"
    fi
}

reset_admin_password() {
    log "RESET_ADMIN_PASSWORD=true — réécriture du bloc 'users'."
    CFG_ADMIN_USER="$ADMIN_USER" CFG_ADMIN_PASSWORD_HASH="$1" awk '
        /^users:/ {
            print "users:"
            print "  - name: " ENVIRON["CFG_ADMIN_USER"]
            print "    password: " ENVIRON["CFG_ADMIN_PASSWORD_HASH"]
            skip = 1
            found = 1
            next
        }
        skip == 1 && /^[ \t]/ { next }
        { skip = 0; print }
        END { if (!found) exit 3 }
    ' "$CONF_FILE" > "$CONF_FILE.tmp" || die "bloc 'users' introuvable dans $CONF_FILE."
    mv "$CONF_FILE.tmp" "$CONF_FILE"
}

if [ ! -f "$CONF_FILE" ]; then
    log "première initialisation dans $DATA_DIR"
    # Affectation séparée : dans « f "$(g)" », un exit de g ne stopperait pas
    # le script, alors qu'ici « set -e » le voit.
    admin_hash=$(require_password_hash)
    render_config "$admin_hash"
else
    log "configuration existante réutilisée ($CONF_FILE)"
    sync_web_port
    if [ "${RESET_ADMIN_PASSWORD:-false}" = "true" ]; then
        admin_hash=$(require_password_hash)
        reset_admin_password "$admin_hash"
    fi
fi

# --- Sauvegardes planifiées (optionnel) -------------------------------------
if [ "${BACKUP_ENABLED:-false}" = "true" ]; then
    mkdir -p /etc/crontabs
    printf '%s /usr/local/bin/adguard-backup >> %s/backups/backup.log 2>&1\n' \
        "${BACKUP_CRON:-17 4 * * *}" "$DATA_DIR" > /etc/crontabs/root
    mkdir -p "$DATA_DIR/backups"
    crond -b -l 8 -c /etc/crontabs
    log "sauvegardes activées (cron: ${BACKUP_CRON:-17 4 * * *}, rétention: ${BACKUP_KEEP:-14})"
fi

log "démarrage d'AdGuard Home — interface sur :$WEB_PORT, DNS clair sur :$PLAIN_DNS_PORT"

exec "$ADGUARD_BIN" \
    --no-check-update \
    -c "$CONF_FILE" \
    -w "$WORK_DIR" \
    "$@"
