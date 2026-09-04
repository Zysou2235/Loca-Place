#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Génère un hash bcrypt utilisable dans ADMIN_PASSWORD_HASH.
#
# À exécuter SUR VOTRE MACHINE, pas dans le conteneur :
#
#   ./scripts/hash-password.sh                 (demande le mot de passe, masqué)
#   ./scripts/hash-password.sh 'mot-de-passe'  (pratique, mais reste dans
#                                               l'historique du shell)
#
# Pourquoi passer par un hash plutôt que par ADMIN_PASSWORD en clair ?
# Parce que le mot de passe en clair reste lisible dans les variables du
# service Railway, et que n'importe qui ayant accès au projet peut l'y lire.
# ---------------------------------------------------------------------------
set -eu

password="${1:-}"
if [ -z "$password" ]; then
    printf 'Mot de passe : ' >&2
    stty -echo 2>/dev/null || true
    read -r password
    stty echo 2>/dev/null || true
    printf '\n' >&2
    printf 'Confirmation : ' >&2
    stty -echo 2>/dev/null || true
    read -r confirm
    stty echo 2>/dev/null || true
    printf '\n' >&2
    [ "$password" = "$confirm" ] || { echo "Les mots de passe diffèrent." >&2; exit 1; }
fi

[ -n "$password" ] || { echo "Mot de passe vide." >&2; exit 1; }
if [ "${#password}" -lt 12 ]; then
    echo "Avertissement : moins de 12 caractères pour une interface exposée sur Internet." >&2
fi

if command -v htpasswd >/dev/null 2>&1; then
    htpasswd -nbB -C 10 admin "$password" | head -n 1 | cut -d: -f2-
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import bcrypt' >/dev/null 2>&1; then
    PW="$password" python3 -c 'import bcrypt, os; print(bcrypt.hashpw(os.environ["PW"].encode(), bcrypt.gensalt(10)).decode())'
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker run --rm httpd:2.4-alpine htpasswd -nbB -C 10 admin "$password" | head -n 1 | cut -d: -f2-
else
    cat >&2 <<'EOF'
Aucun outil de hachage bcrypt trouvé. Installez l'un de ceux-ci :
  - Debian/Ubuntu : sudo apt install apache2-utils
  - macOS         : htpasswd est fourni avec macOS
  - Python        : pip install bcrypt
  - Docker        : suffit à lui seul, ce script s'en servira
Sinon, définissez simplement ADMIN_PASSWORD (en clair) : le conteneur hachera
le mot de passe lui-même au démarrage.
EOF
    exit 1
fi
