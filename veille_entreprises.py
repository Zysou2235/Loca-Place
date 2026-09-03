#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Veille des nouvelles entreprises autour de Dinan.

Interroge l'API publique Recherche d'entreprises (data.gouv.fr, sans cle
d'API), ne garde que les societes creees recemment et encore actives, ecarte
celles deja signalees lors des passages precedents, et envoie les nouveautes
dans Slack via un webhook entrant.

Bibliotheque standard uniquement. Aucun pip install, aucun fichier de
dependances.

Utilisation :
    python3 veille_entreprises.py             passage normal
    python3 veille_entreprises.py --test-api  verifie l'API et montre les
                                              champs bruts renvoyes
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# REGLAGES  (c'est ici, et seulement ici, que tu as besoin de toucher)
# ---------------------------------------------------------------------------

# Point de depart de la recherche : Dinan (22100)
LAT = 48.4553
LON = -2.0464

# Rayon de recherche en km (50 maximum, impose par l'API)
RAYON_KM = 30

# Metiers surveilles : code NAF -> libelle affiche dans Slack.
# Pour en ajouter un, ajoute une ligne. Exemples courants :
#   "43.39Z": "Platrerie / finitions"
#   "43.22B": "Chauffage / clim"
#   "43.32A": "Menuiserie"
CODES_NAF = {
    "43.21A": "Electricite",
}

# On ne signale que les entreprises creees depuis moins de X jours
ANCIENNETE_MAX_JOURS = 45

# Prenom utilise dans l'entete du message Slack (laisse vide pour l'enlever)
NOM_UTILISATEUR = "Nicolas"

# Fichier de memoire : la liste des SIREN deja signales
FICHIER_MEMOIRE = "siren_vus.json"

# ---------------------------------------------------------------------------
# CONSTANTES TECHNIQUES (pas besoin d'y toucher)
# ---------------------------------------------------------------------------

API_URL = "https://recherche-entreprises.api.gouv.fr/near_point"
FICHE_URL = "https://annuaire-entreprises.data.gouv.fr/entreprise/{siren}"

PER_PAGE = 25          # maximum autorise par l'API
PAGES_MAX = 20         # garde-fou : 20 pages x 25 = 500 entreprises par metier
PAUSE_SECONDES = 0.5   # politesse entre deux pages
TIMEOUT_SECONDES = 20
TENTATIVES = 2         # une seconde tentative en cas de panne reseau passagere

# Slack accepte 50 blocs par message : on garde de la marge pour l'entete.
BLOCS_MAX_PAR_MESSAGE = 45

USER_AGENT = "veille-entreprises/1.0 (script personnel, usage non commercial)"


# ---------------------------------------------------------------------------
# Memoire des entreprises deja vues
# ---------------------------------------------------------------------------

def charger_memoire(chemin):
    """Renvoie l'ensemble des SIREN deja signales. Fichier absent = ensemble vide."""
    if not os.path.exists(chemin):
        return set()
    try:
        with open(chemin, "r", encoding="utf-8") as f:
            contenu = json.load(f)
    except (OSError, ValueError) as err:
        print("Attention : %s illisible (%s). On repart d'une memoire vide." % (chemin, err))
        return set()

    # Tolere les deux formes : une liste brute, ou un objet {"siren": [...]}
    if isinstance(contenu, dict):
        contenu = contenu.get("siren", [])
    if not isinstance(contenu, list):
        print("Attention : %s n'a pas le format attendu. On repart d'une memoire vide." % chemin)
        return set()
    return {str(s) for s in contenu if s}


def enregistrer_memoire(chemin, sirens):
    """Reecrit le fichier memoire, trie, pour que les diffs Git restent lisibles."""
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(sorted(sirens), f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Appels a l'API
# ---------------------------------------------------------------------------

def appel_api(params):
    """Appelle l'API et renvoie le JSON.

    Renvoie (donnees, None) si tout va bien, (None, message_erreur) sinon.
    Une panne reseau ou une erreur HTTP ne fait jamais planter le script.
    """
    url = API_URL + "?" + urllib.parse.urlencode(params)
    derniere_erreur = None

    for tentative in range(1, TENTATIVES + 1):
        requete = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(requete, timeout=TIMEOUT_SECONDES) as reponse:
                brut = reponse.read().decode("utf-8")
            return json.loads(brut), None
        except urllib.error.HTTPError as err:
            # Une erreur 4xx ne se resoudra pas en reessayant : on sort tout de suite.
            detail = ""
            try:
                detail = err.read().decode("utf-8", "replace")[:300]
            except Exception:
                pass
            return None, "HTTP %s sur %s %s" % (err.code, url, detail)
        except urllib.error.URLError as err:
            derniere_erreur = "Probleme reseau : %s" % err.reason
        except ValueError as err:
            derniere_erreur = "Reponse illisible (JSON invalide) : %s" % err

        if tentative < TENTATIVES:
            time.sleep(2)

    return None, derniere_erreur


def chercher_entreprises(code_naf, libelle):
    """Recupere toutes les entreprises d'un code NAF autour du point, page par page.

    Renvoie (entreprises, succes). succes vaut False si l'API n'a pas repondu :
    le script continue, mais le passage sera signale comme incomplet.
    """
    entreprises = []
    succes = True
    page = 1
    total_pages = 1
    code_utilise = code_naf

    while page <= total_pages and page <= PAGES_MAX:
        params = {
            "lat": LAT,
            "long": LON,
            "radius": RAYON_KM,
            "activite_principale": code_utilise,
            "page": page,
            "per_page": PER_PAGE,
        }
        donnees, erreur = appel_api(params)

        # Repli : certaines bases attendent le code NAF sans point (4321A).
        if erreur and page == 1 and "." in code_utilise and erreur.startswith("HTTP 4"):
            code_sans_point = code_utilise.replace(".", "")
            print("  Le code %s a ete refuse, nouvel essai avec %s" % (code_utilise, code_sans_point))
            code_utilise = code_sans_point
            params["activite_principale"] = code_utilise
            donnees, erreur = appel_api(params)

        if erreur:
            print("  Echec de la recherche %s (%s) : %s" % (code_naf, libelle, erreur))
            succes = False
            break

        resultats = donnees.get("results") or []
        for entreprise in resultats:
            entreprise["_metier"] = libelle
            entreprises.append(entreprise)

        total_pages = donnees.get("total_pages") or 1
        if page == 1:
            total = donnees.get("total_results", len(resultats))
            print("  %s (%s) : %s entreprise(s) dans le rayon, %s page(s)"
                  % (code_naf, libelle, total, total_pages))

        page += 1
        if page <= total_pages and page <= PAGES_MAX:
            time.sleep(PAUSE_SECONDES)

    if total_pages > PAGES_MAX:
        print("  Garde-fou : on s'arrete a %s pages sur %s." % (PAGES_MAX, total_pages))

    return entreprises, succes


# ---------------------------------------------------------------------------
# Filtres
# ---------------------------------------------------------------------------

def lire_date(valeur):
    """Convertit 'AAAA-MM-JJ' en date. Renvoie None si la valeur est inutilisable."""
    if not valeur:
        return None
    try:
        return datetime.strptime(str(valeur)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def est_recente(entreprise, aujourdhui):
    """Vrai si l'entreprise a ete creee il y a moins de ANCIENNETE_MAX_JOURS."""
    creation = lire_date(entreprise.get("date_creation"))
    if creation is None:
        return False
    age = (aujourdhui - creation).days
    return 0 <= age <= ANCIENNETE_MAX_JOURS


def etat_administratif(entreprise):
    """Etat administratif de l'entreprise : 'A' active, 'C' cessee, None si absent."""
    etat = entreprise.get("etat_administratif")
    if not etat:
        siege = entreprise.get("siege") or {}
        etat = siege.get("etat_administratif")
    return etat


def est_active(entreprise):
    """Vrai si l'entreprise est active.

    Si l'API ne renvoie pas le champ, on garde l'entreprise plutot que de tout
    ecarter en silence : le message d'avertissement est affiche par main().
    """
    etat = etat_administratif(entreprise)
    if etat is None:
        return True
    return str(etat).upper() == "A"


# ---------------------------------------------------------------------------
# Mise en forme du message Slack
# ---------------------------------------------------------------------------

def date_fr(valeur):
    """'2026-08-12' devient '12/08/2026'."""
    date = lire_date(valeur)
    return date.strftime("%d/%m/%Y") if date else "date inconnue"


def nom_dirigeant(entreprise):
    """Nom du premier dirigeant, personne physique ou morale. None si absent."""
    dirigeants = entreprise.get("dirigeants") or []
    for dirigeant in dirigeants:
        if not isinstance(dirigeant, dict):
            continue
        prenoms = (dirigeant.get("prenoms") or "").strip()
        nom = (dirigeant.get("nom") or "").strip()
        if prenoms or nom:
            return " ".join(part for part in (prenoms, nom) if part)
        denomination = (dirigeant.get("denomination") or "").strip()
        if denomination:
            return denomination
    return None


def localisation(entreprise):
    """'22100 Dinan', ou ce qui est disponible."""
    siege = entreprise.get("siege") or {}
    morceaux = [siege.get("code_postal"), siege.get("libelle_commune")]
    texte = " ".join(m for m in morceaux if m)
    return texte or "commune inconnue"


def ligne_entreprise(entreprise):
    """Le texte Slack (mrkdwn) decrivant une entreprise."""
    siren = str(entreprise.get("siren") or "")
    nom = (entreprise.get("nom_complet")
           or entreprise.get("nom_raison_sociale")
           or "Nom inconnu")

    lignes = [
        "*%s*" % nom,
        "%s  |  %s" % (entreprise.get("_metier", "Metier inconnu"), localisation(entreprise)),
        "Creee le %s" % date_fr(entreprise.get("date_creation")),
    ]
    dirigeant = nom_dirigeant(entreprise)
    if dirigeant:
        lignes.append("Dirigeant : %s" % dirigeant)
    if siren:
        lignes.append("<%s|Voir la fiche officielle>" % FICHE_URL.format(siren=siren))
    return "\n".join(lignes)


def titre_message(nombre, numero_lot=1, total_lots=1):
    pluriel = "s" if nombre > 1 else ""
    titre = "%s nouvelle%s entreprise%s autour de Dinan" % (nombre, pluriel, pluriel)
    if total_lots > 1:
        titre += " (%s/%s)" % (numero_lot, total_lots)
    return titre


def construire_message(entreprises, numero_lot=1, total_lots=1, total_general=None):
    """Construit un message Slack au format Block Kit (50 blocs maximum)."""
    nombre = total_general if total_general is not None else len(entreprises)
    titre = titre_message(nombre, numero_lot, total_lots)

    salutation = "Bonjour %s ! " % NOM_UTILISATEUR if NOM_UTILISATEUR else ""
    contexte = "%sRayon de %s km, creees depuis moins de %s jours." % (
        salutation, RAYON_KM, ANCIENNETE_MAX_JOURS)

    blocs = [
        {"type": "header", "text": {"type": "plain_text", "text": "🔌 " + titre, "emoji": True}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": contexte}]},
    ]
    for entreprise in entreprises:
        blocs.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": ligne_entreprise(entreprise)},
        })
    return {"text": titre, "blocks": blocs}


def message_en_texte(message):
    """Version console du message, pour tester sans webhook."""
    lignes = []
    for bloc in message["blocks"]:
        if bloc["type"] == "header":
            lignes.append("")
            lignes.append(bloc["text"]["text"])
            lignes.append("-" * 60)
        elif bloc["type"] == "context":
            lignes.append(bloc["elements"][0]["text"])
        else:
            lignes.append("")
            lignes.append(bloc["text"]["text"])
    return "\n".join(lignes)


# ---------------------------------------------------------------------------
# Envoi Slack
# ---------------------------------------------------------------------------

def url_webhook(brut):
    """Extrait une URL de webhook Slack propre a partir de la variable d'env.

    Tolere les erreurs de copier-coller courantes : guillemets autour de la
    valeur, espaces, ou commande curl entiere collee au lieu de la seule URL.
    Renvoie None si rien d'exploitable n'est trouve.
    """
    if not brut:
        return None
    trouve = re.search(r"https://hooks\.slack\.com/services/\S+", brut)
    if not trouve:
        print("Attention : SLACK_WEBHOOK_URL est presente mais ne ressemble pas a une "
              "URL de webhook Slack. Elle doit commencer par "
              "https://hooks.slack.com/services/ sans guillemets ni texte autour.")
        return None
    return trouve.group(0).rstrip("\"'.,;")


def envoyer_slack(url, message):
    """Poste un message Slack. Renvoie True si Slack a bien accepte l'envoi."""
    corps = json.dumps(message).encode("utf-8")
    requete = urllib.request.Request(
        url,
        data=corps,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=TIMEOUT_SECONDES) as reponse:
            reponse.read()
        return True
    except urllib.error.HTTPError as err:
        detail = ""
        try:
            detail = err.read().decode("utf-8", "replace")[:300]
        except Exception:
            pass
        print("Echec de l'envoi Slack : HTTP %s %s" % (err.code, detail))
    except urllib.error.URLError as err:
        print("Echec de l'envoi Slack : probleme reseau (%s)" % err.reason)
    return False


def lots(elements, taille):
    """Decoupe une liste en paquets de `taille` elements."""
    return [elements[i:i + taille] for i in range(0, len(elements), taille)]


# ---------------------------------------------------------------------------
# Mode diagnostic : verifier l'API et les noms de champs
# ---------------------------------------------------------------------------

def tester_api():
    """Fait un vrai appel a l'API et affiche les champs bruts recus."""
    print("Test de l'API Recherche d'entreprises")
    print("Point : %s, %s   Rayon : %s km" % (LAT, LON, RAYON_KM))
    print("")

    souci = False
    for code_naf, libelle in CODES_NAF.items():
        params = {
            "lat": LAT,
            "long": LON,
            "radius": RAYON_KM,
            "activite_principale": code_naf,
            "page": 1,
            "per_page": 3,
        }
        print("--- %s (%s) ---" % (code_naf, libelle))
        print("URL : %s?%s" % (API_URL, urllib.parse.urlencode(params)))
        donnees, erreur = appel_api(params)
        if erreur:
            print("ECHEC : %s" % erreur)
            souci = True
            print("")
            continue

        print("Cles de la reponse : %s" % ", ".join(sorted(donnees.keys())))
        print("total_results : %s   total_pages : %s"
              % (donnees.get("total_results"), donnees.get("total_pages")))

        resultats = donnees.get("results") or []
        if not resultats:
            print("Aucun resultat : verifie le code NAF ou agrandis le rayon.")
            print("")
            continue

        print("Cles d'une entreprise : %s" % ", ".join(sorted(resultats[0].keys())))
        for entreprise in resultats[:3]:
            print("")
            print("  nom_complet        : %s" % entreprise.get("nom_complet"))
            print("  siren              : %s" % entreprise.get("siren"))
            print("  date_creation      : %s" % entreprise.get("date_creation"))
            print("  etat_administratif : %s" % etat_administratif(entreprise))
            print("  siege              : %s" % localisation(entreprise))
            print("  dirigeant          : %s" % nom_dirigeant(entreprise))
        print("")

    return 1 if souci else 0


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def main():
    analyseur = argparse.ArgumentParser(
        description="Veille des nouvelles entreprises autour de Dinan.")
    analyseur.add_argument(
        "--test-api", action="store_true",
        help="verifie que l'API repond et affiche les champs bruts, sans rien envoyer")
    options = analyseur.parse_args()

    if options.test_api:
        return tester_api()

    aujourdhui = datetime.now(timezone.utc).date()
    print("Veille du %s" % aujourdhui.strftime("%d/%m/%Y"))

    deja_vus = charger_memoire(FICHIER_MEMOIRE)
    print("Memoire : %s entreprise(s) deja signalee(s)" % len(deja_vus))

    trouvees = []
    api_incomplete = False
    for code_naf, libelle in CODES_NAF.items():
        resultats, succes = chercher_entreprises(code_naf, libelle)
        trouvees.extend(resultats)
        if not succes:
            api_incomplete = True

    # Le script ne plante pas, mais le passage se termine en erreur pour que la
    # ligne apparaisse en rouge dans Actions : une veille muette pendant des
    # semaines passerait sinon totalement inapercue.
    if api_incomplete:
        print("Attention : l'API n'a pas repondu pour au moins un metier. "
              "Ce passage est incomplet.")

    if not trouvees:
        print("Aucune entreprise renvoyee par l'API. Rien a envoyer.")
        return 1 if api_incomplete else 0

    nouveautes = []
    sirens_du_lot = set()
    etat_manquant = 0

    for entreprise in trouvees:
        siren = str(entreprise.get("siren") or "")
        if not siren or siren in deja_vus or siren in sirens_du_lot:
            continue
        if not est_recente(entreprise, aujourdhui):
            continue
        if etat_administratif(entreprise) is None:
            etat_manquant += 1
        if not est_active(entreprise):
            continue
        sirens_du_lot.add(siren)
        nouveautes.append(entreprise)

    if etat_manquant:
        print("Attention : %s entreprise(s) sans champ etat_administratif. "
              "Le filtre actives/cessees n'a pas pu leur etre applique." % etat_manquant)

    # Les plus recentes en premier
    nouveautes.sort(key=lambda e: str(e.get("date_creation") or ""), reverse=True)

    print("%s entreprise(s) analysee(s), %s nouveaute(s) a signaler"
          % (len(trouvees), len(nouveautes)))

    if not nouveautes:
        print("Rien de neuf ce matin.")
        return 1 if api_incomplete else 0

    webhook = url_webhook(os.environ.get("SLACK_WEBHOOK_URL"))
    paquets = lots(nouveautes, BLOCS_MAX_PAR_MESSAGE)

    if not webhook:
        print("")
        print("SLACK_WEBHOOK_URL absente : affichage dans la console au lieu de Slack.")
        print("La memoire n'est PAS mise a jour, pour que ces entreprises "
              "repartent au prochain passage.")
        for numero, paquet in enumerate(paquets, start=1):
            message = construire_message(paquet, numero, len(paquets), len(nouveautes))
            print(message_en_texte(message))
        return 1 if api_incomplete else 0

    envoyes = set()
    echec = False
    for numero, paquet in enumerate(paquets, start=1):
        message = construire_message(paquet, numero, len(paquets), len(nouveautes))
        if envoyer_slack(webhook, message):
            envoyes.update(str(e.get("siren")) for e in paquet)
            print("Message %s/%s envoye sur Slack (%s entreprise(s))"
                  % (numero, len(paquets), len(paquet)))
        else:
            echec = True
            print("Message %s/%s non envoye : ces entreprises repartiront "
                  "au prochain passage." % (numero, len(paquets)))
        if numero < len(paquets):
            time.sleep(PAUSE_SECONDES)

    # Regle importante : on ne memorise que ce que Slack a vraiment recu.
    if envoyes:
        enregistrer_memoire(FICHIER_MEMOIRE, deja_vus | envoyes)
        print("Memoire mise a jour : %s SIREN au total" % len(deja_vus | envoyes))

    return 1 if (echec or api_incomplete) else 0


if __name__ == "__main__":
    sys.exit(main())
