# Rend le modèle config/AdGuardHome.yaml en configuration réelle.
#
# Toutes les valeurs arrivent par l'environnement (jamais par -v : awk y
# interprète les séquences d'échappement, ce qui casserait un hash bcrypt).
#
#   CFG_<NOM>    : valeur scalaire, remplace le jeton __<NOM>__
#   LIST_<NOM>   : éléments séparés par des retours à la ligne ; la ligne
#                  "  - __LIST_<NOM>__" est remplacée par un élément par ligne
#                  (ligne supprimée si la liste est vide → clé nulle)
#   BLOCK_<NOM>  : texte multiligne déjà indenté ; la ligne "__BLOCK_<NOM>__"
#                  est remplacée tel quel (supprimée si vide)

function lit_replace(s, tok, val,   i, out) {
    out = ""
    while ((i = index(s, tok)) > 0) {
        out = out substr(s, 1, i - 1) val
        s = substr(s, i + length(tok))
    }
    return out s
}

function trim(s) {
    sub(/^[ \t]+/, "", s)
    sub(/[ \t]+$/, "", s)
    return s
}

BEGIN {
    split("WEB_PORT ADMIN_USER ADMIN_PASSWORD_HASH PLAIN_DNS_PORT RATELIMIT " \
          "QUERYLOG_RETENTION STATS_RETENTION WORK_DIR", scalars, " ")
}

{
    line = $0

    # Bloc multiligne.
    if (trim(line) ~ /^__BLOCK_[A-Z_]+__$/) {
        name = trim(line)
        gsub(/^__BLOCK_|__$/, "", name)
        block = ENVIRON["BLOCK_" name]
        if (block != "") {
            print block
        }
        next
    }

    # Liste YAML.
    if (line ~ /^[ ]*- __LIST_[A-Z_]+__$/) {
        indent = substr(line, 1, index(line, "-") - 1)
        name = line
        sub(/^[ ]*- __LIST_/, "", name)
        sub(/__$/, "", name)
        n = split(ENVIRON["LIST_" name], items, "\n")
        for (k = 1; k <= n; k++) {
            v = trim(items[k])
            if (v != "") {
                print indent "- " v
            }
        }
        next
    }

    # Valeurs scalaires.
    for (s in scalars) {
        line = lit_replace(line, "__" scalars[s] "__", ENVIRON["CFG_" scalars[s]])
    }

    print line
}
