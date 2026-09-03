# Veille des nouvelles entreprises autour de Dinan

Chaque matin, un message Slack te prévient quand une nouvelle entreprise
d'électricité vient d'être créée autour de chez toi. Objectif : prendre contact
tôt et se constituer un réseau de sous-traitants disponibles.

L'outil interroge l'API publique **Recherche d'entreprises** (data.gouv.fr,
gratuite, sans compte ni clé), garde uniquement les sociétés créées récemment
et encore actives, met de côté celles déjà signalées, et envoie le reste
dans Slack.

Trois fichiers, rien d'autre :

| Fichier | À quoi ça sert |
|---|---|
| `veille_entreprises.py` | le script ; **tous les réglages sont en haut du fichier** |
| `.github/workflows/veille.yml` | l'horloge : GitHub lance le script chaque matin |
| `siren_vus.json` | la mémoire : les entreprises déjà signalées |

---

## Étape 1 — Créer le webhook Slack (5 minutes)

Un « webhook » est simplement une adresse secrète : tout ce qu'on lui envoie
s'affiche dans un canal Slack.

1. Va sur **https://api.slack.com/apps** et connecte-toi avec ton compte Slack.
2. **Create New App** → **From scratch**.
3. Donne un nom (par exemple `Veille entreprises`), choisis ton espace de
   travail, puis **Create App**.
4. Dans le menu de gauche : **Incoming Webhooks**. Mets l'interrupteur
   **Activate Incoming Webhooks** sur **On**.
5. En bas de la page : **Add New Webhook to Workspace**. Choisis le canal où tu
   veux recevoir les alertes (crée-en un dédié, par exemple `#veille-elec`),
   puis **Autoriser**.
6. Slack affiche une adresse qui commence par
   `https://hooks.slack.com/services/…` — **copie-la**, on s'en sert à l'étape 3.

> Garde cette adresse pour toi : n'importe qui l'ayant peut écrire dans ton canal.
> Ne la colle jamais directement dans le code.

---

## Étape 2 — Mettre le code sur GitHub (dépôt privé)

Si le code est déjà dans un dépôt GitHub, saute cette étape.

1. Va sur **https://github.com/new**.
2. Nom du dépôt : `veille-entreprises` par exemple.
3. Coche **Private** — c'est important, un dépôt public expose ton historique.
4. **Create repository**, puis suis les lignes affichées par GitHub pour
   envoyer le dossier (`git remote add origin …` puis `git push`).

---

## Étape 3 — Enregistrer le secret Slack

C'est ici que l'adresse copiée à l'étape 1 va vivre, à l'abri des regards.

1. Sur ton dépôt GitHub : onglet **Settings**.
2. Menu de gauche : **Secrets and variables** → **Actions**.
3. Bouton **New repository secret**.
4. **Name** : `SLACK_WEBHOOK_URL` (exactement ça, en majuscules).
5. **Secret** : colle l'adresse `https://hooks.slack.com/services/…`,
   sans guillemets autour.
6. **Add secret**.

---

## Étape 4 — Premier lancement à la main

⚠️ **Le fichier `.github/workflows/veille.yml` doit se trouver sur ta branche
principale (`main`).** GitHub ne déclenche les tâches planifiées que depuis
celle-ci, et le bouton de lancement manuel n'apparaît pas tant que le fichier
est sur une autre branche. Si tu travailles sur une branche, fusionne-la
d'abord dans `main`.

Ensuite :

1. Onglet **Actions** de ton dépôt.
2. Dans la colonne de gauche, clique sur **Veille entreprises**.
3. Bouton **Run workflow** (à droite) → **Run workflow**.
4. Au bout d'une minute environ, la ligne apparaît. Clique dessus pour voir
   le déroulé.

Ce qui doit se passer :

- soit un message arrive dans ton canal Slack ;
- soit le journal affiche `Rien de neuf ce matin.` — c'est normal, ça veut
  simplement dire qu'aucune entreprise n'a été créée récemment dans ton rayon.

À partir de là, c'est automatique : du lundi au vendredi, à 6h00 UTC —
soit **8h00 en France l'été, 7h00 l'hiver** (GitHub ne raisonne qu'en heure UTC).

---

## Vérifier que l'API répond bien (recommandé avant le premier lancement)

Sur ton ordinateur, dans le dossier du projet :

```bash
python3 veille_entreprises.py --test-api
```

Cette commande fait un vrai appel à l'API et affiche ce qu'elle renvoie :
le nombre d'entreprises trouvées dans ton rayon, et les premières fiches
(nom, SIREN, date de création, état, commune, dirigeant).

C'est le moyen le plus rapide de confirmer que le rayon et le code d'activité
sont bons. Si la commande affiche `Aucun resultat`, essaie d'agrandir
`RAYON_KM` ou vérifie le code NAF.

Pour tester l'envoi complet sans rien envoyer sur Slack :

```bash
python3 veille_entreprises.py
```

Sans la variable `SLACK_WEBHOOK_URL`, le script affiche le message dans la
console au lieu de l'envoyer — et **ne touche pas** à la mémoire, pour que ces
entreprises repartent bien lors du vrai passage.

Pour tester un envoi Slack réel depuis ton poste :

```bash
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." python3 veille_entreprises.py
```

Aucune installation n'est nécessaire : le script n'utilise que ce qui est
livré avec Python (version 3.11 ou plus récente).

---

## Changer les réglages

Tout est regroupé en haut de `veille_entreprises.py`, sous
`REGLAGES`. Modifie, enregistre, envoie sur GitHub (`git push`) : c'est pris en
compte au passage suivant.

```python
LAT = 48.4553          # Dinan
LON = -2.0464
RAYON_KM = 30          # 50 maximum (limite de l'API)

CODES_NAF = {
    "43.21A": "Electricite",
}

ANCIENNETE_MAX_JOURS = 45
NOM_UTILISATEUR = "Nicolas"   # le prénom affiché dans le message Slack
```

**Surveiller d'autres métiers** — ajoute une ligne dans `CODES_NAF` :

```python
CODES_NAF = {
    "43.21A": "Electricite",
    "43.39Z": "Platrerie / finitions",
    "43.22B": "Chauffage / clim",
    "43.32A": "Menuiserie",
}
```

**Changer l'heure d'envoi** — dans `.github/workflows/veille.yml`, la ligne
`- cron: "0 6 * * 1-5"` se lit : *minute 0, heure 6 (UTC), du lundi (1) au
vendredi (5)*. Pour 9h00 françaises en été, mets `"0 7 * * 1-5"`.

---

## Bon à savoir

- **La mémoire, c'est `siren_vus.json`.** Le script y ajoute les entreprises
  qu'il vient de signaler, puis GitHub enregistre le fichier automatiquement.
  Si tu le vides, tu recevras à nouveau toutes les alertes des 45 derniers jours.
- **Si Slack ne répond pas, rien n'est mémorisé** : l'info repart au passage
  suivant. Rien ne se perd. La ligne apparaît alors en rouge dans l'onglet
  Actions — c'est volontaire, pour que tu le voies.
- **Une panne de l'API ne fait pas planter le script** : il affiche un message
  clair et s'arrête proprement — mais la ligne passe en rouge dans Actions,
  pour que tu voies qu'aucune veille n'a eu lieu ce jour-là. Rien n'est
  mémorisé, donc rien n'est perdu.
- **Limites imposées par l'API** (pas par le script) : rayon de 50 km maximum,
  25 résultats par page. Le script pagine tout seul, avec une petite pause
  entre deux pages pour rester poli, et un garde-fou à 20 pages par métier.
- **Slack n'accepte que 50 blocs par message.** S'il y a beaucoup de nouveautés
  le même jour, le script découpe en plusieurs messages.

---

## En cas de souci

| Ce que tu vois | Ce qu'il faut faire |
|---|---|
| Aucun bouton **Run workflow** dans Actions | le fichier `veille.yml` n'est pas encore sur la branche `main` |
| `SLACK_WEBHOOK_URL absente` dans le journal | le secret n'est pas enregistré, ou son nom est mal orthographié (étape 3) |
| `ne ressemble pas a une URL de webhook Slack` | tu as collé des guillemets ou du texte en trop autour de l'adresse |
| `Echec de l'envoi Slack : HTTP 404` | le webhook a été supprimé côté Slack — refais l'étape 1 |
| `Aucun resultat` avec `--test-api` | agrandis `RAYON_KM`, ou vérifie le code NAF |
| `Rien de neuf ce matin.` | tout va bien : aucune création récente dans ton rayon |
| La ligne est rouge dans Actions | ouvre le journal : soit Slack n'a pas répondu, soit l'API était injoignable. Dans les deux cas l'info repart au passage suivant |
