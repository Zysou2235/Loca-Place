# ---------------------------------------------------------------------------
# AdGuard Home prêt pour Railway.
#
# On part de l'image officielle (basée sur Alpine) et on ajoute seulement :
#   - de quoi hacher un mot de passe au démarrage ;
#   - un point d'entrée qui rend la config initiale et l'aligne sur $PORT.
# ---------------------------------------------------------------------------

# Version épinglée volontairement : le modèle de configuration déclare
# `schema_version: 34`, qu'une image PLUS ANCIENNE refuserait de lire.
# Pour monter de version : changez ce tag (une image plus récente migre seule),
# ou passez --build-arg ADGUARD_VERSION=vX.Y.Z.
ARG ADGUARD_VERSION=v0.107.79

FROM adguard/adguardhome:${ADGUARD_VERSION}

# apache2-utils -> htpasswd, pour hacher ADMIN_PASSWORD en bcrypt au démarrage.
# tzdata        -> pour que TZ=Europe/Paris donne les bonnes heures.
RUN apk add --no-cache apache2-utils tzdata

COPY config/AdGuardHome.yaml   /usr/local/lib/adguard-railway/AdGuardHome.yaml
COPY scripts/render-config.awk /usr/local/lib/adguard-railway/render-config.awk
COPY scripts/entrypoint.sh     /usr/local/bin/entrypoint.sh
COPY scripts/backup.sh         /usr/local/bin/adguard-backup
COPY scripts/restore.sh        /usr/local/bin/adguard-restore

RUN chmod +x /usr/local/bin/entrypoint.sh \
             /usr/local/bin/adguard-backup \
             /usr/local/bin/adguard-restore

# Interface web + DoH. Railway injecte $PORT et ignore cette valeur ;
# elle sert surtout en local.
EXPOSE 3000

# Ne pas déclarer ENV DATA_DIR ici : l'entrypoint doit pouvoir se rabattre sur
# RAILWAY_VOLUME_MOUNT_PATH quand la variable n'est pas explicitement fournie.

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/login.html" || exit 1

# CMD vidé : l'entrypoint transmet "$@" à AdGuard Home, et on ne veut pas
# hériter d'arguments de l'image de base.
CMD []

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
