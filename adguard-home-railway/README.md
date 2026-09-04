# AdGuard Home sur Railway — filtrage DNS familial

Déploie AdGuard Home en conteneur sur Railway, avec un historique DNS
consultable par appareil et une interface d'administration en HTTPS.

Tout est prêt : `Dockerfile`, configuration initiale, sauvegardes, et un
`docker compose` pour essayer en local avant de payer quoi que ce soit.

---

## ⚠️ À lire avant de commencer

Railway ne route **que du TCP/HTTP**. Il n'expose pas d'UDP. Or le DNS
« classique » que vos appareils utilisent aujourd'hui, c'est de l'**UDP sur le
port 53**. Conséquence directe, sans détour :

> **Vous ne pourrez pas mettre l'adresse de ce serveur dans votre box et
> couvrir toute la maison d'un coup.** Le port 53 n'est pas joignable depuis
> Internet sur Railway, quelle que soit la configuration.

Ce qui fonctionne, en revanche, très bien :

| | Sur Railway |
|---|---|
| Interface d'administration en HTTPS | ✅ oui, avec certificat automatique |
| Historique DNS complet et consultable | ✅ oui |
| Historique **par appareil** | ✅ oui, via les ClientID (voir plus bas) |
| DNS-over-HTTPS (DoH) pour vos appareils | ✅ oui, c'est le mode de fonctionnement |
| Fonctionne aussi **hors du domicile** (4G, école, vacances) | ✅ oui, avantage réel sur un Raspberry Pi à la maison |
| DNS classique UDP/53 | ❌ non, Railway ne route pas l'UDP |
| DNS-over-TLS (DoT, port 853) | ❌ en pratique non : le *TCP Proxy* de Railway n'attribue qu'un port public arbitraire, alors que les clients DoT (dont Android) exigent le 853 |
| Configuration au niveau de la box / du routeur | ❌ non (sauf routeur compatible DoH, rare) |
| DNS privé d'Android (« Private DNS ») | ❌ non, Android n'accepte que le DoT |

**Chaque appareil doit donc être configuré individuellement en DoH.** C'est
une à deux minutes par appareil (et un simple profil à installer sur iPhone /
iPad / Mac). La section [Configurer les appareils](#5-configurer-les-appareils)
détaille chaque cas, y compris ce qu'il faut faire pour Android et pour couvrir
malgré tout toute la maison.

Si votre besoin est vraiment « je mets une IP dans ma box et c'est réglé »,
Railway n'est pas le bon hébergeur : voyez
[Si Railway ne convient pas](#12-si-railway-ne-convient-pas).

---

## 1. Comment ça marche

```
   iPhone / PC / TV                    Railway                     Internet
   ───────────────                     ───────                     ────────

   DoH (HTTPS 443)          ┌──────────────────────────┐
   ───────────────────────► │  Proxy Railway (TLS)     │
   https://votre-app        │  termine le HTTPS        │
     .up.railway.app        └───────────┬──────────────┘
     /dns-query/pc-papa                 │ HTTP clair, port $PORT
                                        ▼
                            ┌──────────────────────────┐
                            │      AdGuard Home        │
                            │  • interface web  /      │   DoH   ┌──────────┐
                            │  • DoH      /dns-query/… │ ──────► │  Quad9   │
                            │  • filtrage + historique │         │Cloudflare│
                            └───────────┬──────────────┘         └──────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Volume Railway (/data)  │
                            │  conf/ + historique      │
                            └──────────────────────────┘
```

Deux points techniques qui expliquent la configuration livrée :

- **DoH est servi par le serveur web d'AdGuard**, sur le port que Railway
  expose. C'est le réglage `http.doh.insecure_enabled: true` : il autorise les
  requêtes DoH arrivant en HTTP clair, ce qui est exactement le cas ici
  puisque c'est Railway qui déchiffre le TLS en amont. AdGuard ne gère aucun
  certificat.
- **Le DNS classique reste actif en interne** (port 5353 par défaut). Ce n'est
  pas un oubli : AdGuard Home refuse de démarrer s'il n'a aucun point d'écoute
  DNS, et notre DoH passe par le serveur web, pas par son proxy DNS.

---

## 2. Contenu du dossier

```
adguard-home-railway/
├── Dockerfile                   image basée sur adguard/adguardhome, épinglée
├── docker-compose.yml           pour tester en local (DNS classique inclus)
├── railway.json                 build + healthcheck côté Railway
├── .env.example                 toutes les variables, commentées
├── config/
│   └── AdGuardHome.yaml         modèle de configuration initiale
└── scripts/
    ├── entrypoint.sh            prépare le volume, rend la config, lance AdGuard
    ├── render-config.awk        moteur de substitution du modèle
    ├── backup.sh                sauvegarde config + historique (cron interne)
    ├── restore.sh               restauration d'une archive
    └── hash-password.sh         génère le hash bcrypt du mot de passe admin
```

Le modèle `config/AdGuardHome.yaml` n'est lu **qu'au premier démarrage**.
Ensuite, c'est AdGuard Home qui possède le fichier sur le volume : il le
réécrit à chaque modification faite depuis l'interface. Modifier le modèle
après coup n'a donc aucun effet sur un déploiement existant.

---

## 3. Déploiement sur Railway

### Le bouton « Deploy on Railway », honnêtement

Les modèles Railway déploient **un dépôt entier**, et ne permettent pas de
préciser un sous-dossier ni de créer le volume à votre place. Comme ce projet
vit dans un sous-dossier d'un dépôt qui contient déjà une autre application,
un bouton pointant vers ce dépôt construirait la mauvaise chose.

Deux possibilités :

- **suivre les étapes ci-dessous** (5 minutes, aucun piège) ;
- ou **extraire `adguard-home-railway/` dans son propre dépôt** ; le bouton
  devient alors pertinent, et vous pourrez publier un vrai modèle depuis
  Railway (*Project → Settings → Create Template*), qui mémorisera le volume
  et les variables. À coller dans le README du nouveau dépôt :

  ```markdown
  [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/VOTRE-COMPTE/VOTRE-DEPOT)
  ```

### Étapes

1. **Créer le service**
   Railway → *New Project* → *Deploy from GitHub repo* → choisissez ce dépôt.

2. **Pointer sur le bon dossier** *(indispensable ici)*
   *Settings → Source → Root Directory* : `adguard-home-railway`
   Railway y trouvera `Dockerfile` et `railway.json` et construira l'image
   Docker (et non l'application Next.js du dépôt).

3. **Ajouter le volume** *(indispensable — sans lui, tout est perdu à chaque
   redéploiement : mot de passe, historique, réglages)*
   *Settings → Volumes → New Volume*
   Point de montage : `/data`
   Taille : 5 Go suffisent pour 30 jours d'historique familial.

4. **Renseigner les variables**
   *Variables →* au minimum :

   ```
   ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
   TZ=Europe/Paris
   ```

   Mieux : générez le hash chez vous et ne mettez jamais le mot de passe en
   clair dans Railway :

   ```bash
   ./scripts/hash-password.sh
   # copiez la sortie dans ADMIN_PASSWORD_HASH
   ```

   Le service **refuse volontairement de démarrer** si aucune des deux
   variables n'est définie : une interface d'administration publique sans mot
   de passe serait prise en quelques heures.

5. **Générer le domaine public**
   *Settings → Networking → Generate Domain*. Railway propose un port :
   **laissez-le choisir**, il injecte `PORT` et l'entrypoint aligne AdGuard
   dessus automatiquement.

6. **Vérifier**
   Ouvrez `https://votre-app.up.railway.app` → page de connexion AdGuard Home.
   Connectez-vous avec `admin` et votre mot de passe.

7. **Fermer le résolveur** *(à ne pas remettre à plus tard, voir §4)*

---

## 4. Sécuriser le résolveur — les ClientID

Tel quel, `https://votre-app.up.railway.app/dns-query` répond à **n'importe
qui**. Un résolveur ouvert finit toujours par être trouvé, utilisé pour du
trafic qui n'est pas le vôtre, et facturé sur votre compte.

La parade est aussi la fonctionnalité qui donne l'historique par appareil : le
**ClientID**, un identifiant placé dans le chemin de l'URL DoH.

```
https://votre-app.up.railway.app/dns-query/iphone-marie
https://votre-app.up.railway.app/dns-query/pc-papa
https://votre-app.up.railway.app/dns-query/salon-tv
```

Renseignez la variable et redéployez :

```
ALLOWED_CLIENT_IDS=iphone-marie-7f3a,pc-papa-91cd,salon-tv-2b8e,ipad-enfants-4d10
```

À partir de là, AdGuard **refuse toute requête sans ClientID connu** — y
compris sur `/dns-query` tout court. Chaque appareil apparaît sous son nom
dans le journal et dans les statistiques, et vous pouvez lui appliquer des
règles propres (contrôle parental sur la tablette des enfants, par exemple).

Détails utiles :

- Format d'un ClientID : minuscules, chiffres et tirets uniquement, 63
  caractères max. Pas de `_`, pas de point, pas d'accent.
- Ajoutez un suffixe aléatoire (`-7f3a`) : ce n'est pas un vrai secret, mais
  ça rend l'URL non devinable.
- `ALLOWED_CLIENT_IDS` n'est appliqué **qu'au premier démarrage**. Sur une
  installation déjà en service, ajoutez les appareils depuis l'interface :
  *Réglages → Clients → Ajouter un client* (identifiant = le ClientID), et
  *Réglages → Paramètres DNS → Listes d'accès → Clients autorisés*.

---

## 5. Configurer les appareils

Notez d'abord votre domaine, par exemple `adguard-famille.up.railway.app`.

### iPhone, iPad, Mac — le plus simple

AdGuard Home génère un profil de configuration Apple. Ouvrez cette URL
**dans Safari, sur l'appareil concerné** :

```
https://adguard-famille.up.railway.app/apple/doh.mobileconfig?host=adguard-famille.up.railway.app&client_id=iphone-marie-7f3a
```

Puis *Réglages → Profil téléchargé → Installer*. C'est tout : **tout le
trafic DNS de l'appareil** passe par votre AdGuard, à la maison comme en 4G.

Un profil par appareil, avec son propre `client_id`.

### Android — Private DNS ne marchera pas

Le « DNS privé » d'Android n'accepte que le **DoT** (port 853), que Railway ne
permet pas d'exposer. Il faut donc une application qui parle DoH :

- **AdGuard for Android** — mode « DNS uniquement », serveur DoH personnalisé ;
- **Intra** (Google, gratuit) — champ « serveur personnalisé » ;
- **Nebulo** (gratuit, F-Droid) ou **RethinkDNS** (gratuit).

Dans toutes, l'URL à saisir est
`https://adguard-famille.up.railway.app/dns-query/pixel-lea-33c1`.

### Windows 11

Le DoH intégré à Windows exige une **adresse IP** de serveur, que nous n'avons
pas ici (Railway ne donne qu'un nom d'hôte). Deux options :

- configurer le DoH **navigateur par navigateur** (ci-dessous) — couvre
  l'essentiel de l'usage réel ;
- ou installer un petit relais local :
  [`dnsproxy`](https://github.com/AdguardTeam/dnsproxy) écoute en `127.0.0.1:53`
  et transmet en DoH. Windows pointe alors sur `127.0.0.1` :
  ```
  dnsproxy -l 127.0.0.1 -p 53 -u https://adguard-famille.up.railway.app/dns-query/pc-papa-91cd
  ```

### Navigateurs (toutes plateformes)

- **Firefox** : *Paramètres → Vie privée et sécurité → DNS via HTTPS →
  Protection maximale → Fournisseur : Personnalisé* puis l'URL complète.
- **Chrome / Edge** : *Paramètres → Confidentialité et sécurité → Sécurité →
  Utiliser un DNS sécurisé → Personnalisé* puis l'URL complète.

Attention : ce réglage ne couvre que le navigateur, pas les applications ni la
télévision connectée.

### Couvrir toute la maison malgré tout

La box ne sait pas parler DoH. Pour que **tous** les appareils du domicile
soient filtrés sans configuration individuelle, il faut un relais sur le
réseau local :

1. sur un Raspberry Pi, un NAS ou un petit PC toujours allumé, lancez
   `dnsproxy` (ou un second AdGuard Home) qui écoute en UDP/53 sur le réseau
   local et transmet vers votre URL DoH Railway ;
2. déclarez l'IP de cette machine comme serveur DNS dans le DHCP de la box.

Vous gardez alors les avantages du serveur Railway (accessible partout,
historique centralisé, sauvegardé) tout en couvrant les appareils qui ne
savent pas se configurer — TV, consoles, objets connectés.

### Vérifier que ça marche

```bash
# doit répondre 200 et application/dns-message
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  'https://adguard-famille.up.railway.app/dns-query/pc-papa-91cd?dns=AAABAAABAAAAAAAAB2V4ZW1wbGUCZnIAAAEAAQ'

# avec un ClientID inconnu, la requête doit être refusée (pas de 200 exploitable)
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://adguard-famille.up.railway.app/dns-query/inconnu?dns=AAABAAABAAAAAAAAB2V4ZW1wbGUCZnIAAAEAAQ'
```

(La chaîne `dns=…` est une requête DNS `exemple.fr` de type A encodée au
format RFC 8484.)

Avec `dig` ≥ 9.18 ou `kdig` :

```bash
dig  @adguard-famille.up.railway.app +https=/dns-query/pc-papa-91cd exemple.fr
kdig @https://adguard-famille.up.railway.app/dns-query/pc-papa-91cd exemple.fr
```

Le test qui compte vraiment : configurez un appareil, naviguez un peu, et
regardez apparaître ses requêtes dans *Journal des requêtes*.

---

## 6. L'historique

Interface → **Journal des requêtes** : chaque requête, l'appareil qui l'a
émise, la réponse, et la règle qui l'a éventuellement bloquée. Filtrable par
client, domaine et statut. **Statistiques** donne les vues d'ensemble.

Réglages livrés par défaut :

| Réglage | Valeur | Variable |
|---|---|---|
| Conservation du journal | 30 jours | `QUERYLOG_RETENTION` |
| Conservation des statistiques | 30 jours | `STATS_RETENTION` |
| Écriture sur disque | activée | — |
| Anonymisation des IP | désactivée | — |

**Taille sur le disque.** Comptez 25 à 60 Mo pour 100 000 requêtes. Une
famille de quatre génère typiquement 50 000 à 150 000 requêtes par jour, soit
grossièrement **0,5 à 3 Go pour 30 jours**. Un volume de 5 Go convient pour
30 jours ; pour 90 jours (`2160h`), prévoyez plutôt 15 Go — et sachez que le
volume est facturé au Go provisionné.

Si le volume sature, AdGuard ne peut plus écrire : réduisez la rétention, ou
agrandissez le volume dans les réglages Railway.

---

## 7. Le filtrage livré par défaut

Actives dès le premier démarrage :

| Liste | Rôle |
|---|---|
| AdGuard DNS filter | publicités et traqueurs, liste maintenue par AdGuard |
| OISD Blocklist Big | la référence généraliste, très peu de faux positifs |
| Phishing Army (Extended) | hameçonnage |
| *Navigation sécurisée AdGuard* | vérification en direct des domaines malveillants (`safebrowsing_enabled`) |

Présentes mais désactivées, à activer d'un clic dans *Filtres → Listes de
blocage DNS* : AdAway, StevenBlack, Peter Lowe, **OISD NSFW** (contenus
adultes), HaGeZi Multi PRO, HaGeZi Threat Intelligence Feeds.

**À propos d'EasyList.** Elle est fournie mais désactivée, et c'est
intentionnel : EasyList est conçue pour les bloqueurs de navigateur. La
plupart de ses règles sont cosmétiques ou basées sur le chemin de l'URL,
choses qu'un filtre DNS ne voit pas — il ne connaît que des noms de domaine.
L'activer ajoute des dizaines de milliers de règles pour un gain quasi nul.
Pour du blocage de publicité en DNS, AdGuard DNS filter + OISD font le travail.

**Contrôle parental.** Deux approches, combinables : activer *Filtres →
Contrôle parental* (base AdGuard), ou activer la liste OISD NSFW. Les deux
peuvent s'appliquer **à un client précis** (*Réglages → Clients → l'appareil
de l'enfant*), ce qui est tout l'intérêt des ClientID.

---

## 8. Variables d'environnement

Toutes sont documentées dans [`.env.example`](.env.example). L'essentiel :

| Variable | Défaut | Rôle |
|---|---|---|
| `ADMIN_PASSWORD` | *(vide)* | mot de passe admin en clair, haché au démarrage |
| `ADMIN_PASSWORD_HASH` | *(vide)* | hash bcrypt (préférable) |
| `ADMIN_USER` | `admin` | identifiant de connexion |
| `RESET_ADMIN_PASSWORD` | `false` | réécrit l'utilisateur au prochain démarrage |
| `ALLOWED_CLIENT_IDS` | *(vide)* | ClientID autorisés — **à renseigner** |
| `UPSTREAM_DNS` | Quad9 + Cloudflare | résolveurs en amont, en DoH |
| `QUERYLOG_RETENTION` | `720h` | conservation de l'historique |
| `STATS_RETENTION` | `720h` | conservation des statistiques |
| `RATELIMIT` | `60` | requêtes/seconde par IP cliente |
| `TRUSTED_PROXIES` | `0.0.0.0/0,::/0` | proxies dont on croit le `X-Forwarded-For` |
| `PLAIN_DNS_PORT` | `5353` | port DNS interne (53 en local) |
| `TZ` | *(UTC)* | fuseau horaire des journaux |
| `BACKUP_ENABLED` | `false` | active le cron de sauvegarde |
| `PORT` | injecté par Railway | port de l'interface web |
| `DATA_DIR` | `RAILWAY_VOLUME_MOUNT_PATH` sinon `/data` | emplacement des données |

Deux remarques :

- `ALLOWED_CLIENT_IDS`, `UPSTREAM_DNS`, `QUERYLOG_RETENTION`, `RATELIMIT` et
  les autres réglages de contenu ne sont appliqués **qu'à la création du
  fichier de configuration**. Ensuite, c'est l'interface web qui fait foi —
  c'est voulu : sinon un redémarrage écraserait vos réglages.
  `PORT` et, si demandé, le mot de passe restent alignés à chaque démarrage.
- `TRUSTED_PROXIES=0.0.0.0/0` accorde une confiance large à l'en-tête
  `X-Forwarded-For`. Sur Railway c'est raisonnable : le proxy d'entrée est le
  seul chemin vers le port HTTP du conteneur. Cela permet de voir la vraie IP
  publique de la maison dans l'historique et d'appliquer la limite de débit
  par IP réelle. En local (`docker compose`), la valeur est ramenée à
  `127.0.0.0/8,::1/128`.

---

## 9. Sauvegardes

Activation :

```
BACKUP_ENABLED=true
BACKUP_CRON=17 4 * * *     # tous les jours à 4 h 17 (heure du conteneur)
BACKUP_KEEP=14             # nombre d'archives conservées
```

Une archive `<volume>/backups/adguardhome-AAAAMMJJ-HHMMSS.tar.gz` contient la
configuration, le journal des requêtes, les statistiques et les sessions.
`latest.tar.gz` pointe toujours sur la plus récente. Les listes de blocage
sont exclues : elles se retéléchargent seules.

**Ce que cela protège, et ce que cela ne protège pas.** Les archives sont sur
le même volume que les données : cela vous sauve d'une mauvaise manipulation
ou d'une configuration cassée, **pas de la perte du volume**. Pour une vraie
sauvegarde hors site, récupérez-les avec la CLI Railway :

```bash
railway link                       # une fois, pour rattacher le dossier au projet
railway ssh "cat /data/backups/latest.tar.gz" > sauvegarde-adguard.tar.gz
```

Le plus important tient d'ailleurs en un fichier — la configuration :

```bash
railway ssh "cat /data/conf/AdGuardHome.yaml" > AdGuardHome-sauvegarde.yaml
```

Restauration, depuis un shell dans le conteneur (`railway ssh`) :

```bash
adguard-restore --list          # voir les archives
adguard-restore                 # restaurer la plus récente
adguard-restore /data/backups/adguardhome-20260901-041700.tar.gz
```

Puis **redémarrez le service** (Railway → *Restart*) : sans cela, AdGuard Home
réécrira l'ancienne configuration depuis sa mémoire.

---

## 10. Essayer en local

Utile pour valider le mot de passe, les filtres et le comportement avant de
déployer — et ici, contrairement à Railway, le **DNS classique fonctionne**.

```bash
cd adguard-home-railway
cp .env.example .env       # renseignez ADMIN_PASSWORD
docker compose up --build
```

- Interface : <http://localhost:3000>
- DoH : `http://localhost:3000/dns-query/pc-local` (HTTP clair : il n'y a pas
  de terminaison TLS en local)
- DNS classique : `dig @127.0.0.1 exemple.fr`

Pour repartir de zéro : `docker compose down -v` (supprime le volume, donc
toute la configuration).

---

## 11. Coût

Ordre de grandeur, à vérifier sur la grille tarifaire Railway du moment :

- le plan **Hobby** est payant (environ 5 $/mois, incluant un crédit d'usage) ;
- le conteneur tourne **24 h/24** : comptez la RAM en continu. AdGuard Home
  avec les listes par défaut consomme typiquement **150 à 350 Mo** ;
- le **volume est facturé au Go provisionné**, pas au Go utilisé : ne
  surdimensionnez pas ;
- le trafic DNS lui-même est négligeable (quelques centaines d'octets par
  requête).

Un usage familial rentre généralement dans le crédit du plan Hobby, mais
regardez la consommation réelle après une semaine. Et gardez
`ALLOWED_CLIENT_IDS` renseigné : un résolveur ouvert peut faire exploser la
facture.

---

## 12. Si Railway ne convient pas

Rien de tout ceci ne remet en cause AdGuard Home — seulement l'hébergeur.

- **Vous voulez configurer la box une fois pour toutes** → il vous faut un
  hébergeur qui route l'UDP/53 : un petit VPS (Hetzner, Scaleway, OVH, ~4 €/mois)
  avec la même image Docker. Pensez alors à restreindre l'accès au port 53
  (pare-feu sur votre IP publique, ou clients autorisés dans AdGuard) : un
  résolveur DNS ouvert en UDP est un outil d'attaque par amplification.
- **Vous ne voulez rien payer et tout garder chez vous** → Raspberry Pi ou NAS
  à la maison. Meilleure confidentialité, mais rien n'est filtré quand les
  appareils sortent du domicile, et les sauvegardes sont à votre charge.
- **Le meilleur des deux** → AdGuard Home sur Railway (accessible partout,
  sauvegardé) **plus** un relais `dnsproxy` à la maison qui le prend comme
  amont, pour les appareils incapables de faire du DoH. C'est la configuration
  décrite en [§5](#couvrir-toute-la-maison-malgré-tout).

---

## 13. Dépannage

**Le déploiement échoue avec « aucun mot de passe administrateur défini ».**
C'est volontaire. Définissez `ADMIN_PASSWORD` ou `ADMIN_PASSWORD_HASH`.

**Mot de passe oublié.** Mettez `RESET_ADMIN_PASSWORD=true` et le nouveau
`ADMIN_PASSWORD`, redéployez, connectez-vous, puis **remettez
`RESET_ADMIN_PASSWORD=false`** — sinon le bloc utilisateur est réécrit à
chaque redémarrage.

**Tout est perdu après un redéploiement.** Le volume n'est pas monté, ou pas
au bon endroit. *Settings → Volumes* : il doit exister et être monté sur
`/data` (ou sur le chemin indiqué par `DATA_DIR`). Les journaux de démarrage
affichent le dossier réellement utilisé.

**Le healthcheck échoue.** Le service met quelques secondes à télécharger ses
listes au premier démarrage. Si l'échec persiste, regardez les journaux : une
erreur de configuration YAML y est indiquée explicitement, avec la clé fautive.

**`unknown schema version` / AdGuard refuse de démarrer.** Vous utilisez une
image plus ancienne que le modèle (`schema_version: 34`, AdGuard Home
v0.107.79). Remettez le tag d'origine dans le `Dockerfile`, ou plus récent.

**Les requêtes DoH sont refusées.** Vérifiez le ClientID dans l'URL :
il doit figurer dans *Réglages → Paramètres DNS → Clients autorisés*, à
l'orthographe près. Sans ClientID valide, le refus est le comportement attendu.

**Tous les appareils apparaissent sous la même IP.** Normal : ils partagent
l'IP publique du domicile. C'est précisément à quoi servent les ClientID —
un par appareil.

**La consommation mémoire grimpe.** Trop de listes activées, ou une rétention
de journal élevée avec `size_memory` important. Désactivez les listes
redondantes (OISD Big couvre déjà l'essentiel de StevenBlack et AdAway).

---

## 14. Mettre à jour AdGuard Home

Changez le tag dans le `Dockerfile` :

```dockerfile
ARG ADGUARD_VERSION=v0.107.79
```

Puis redéployez. Une version plus récente migre automatiquement le fichier de
configuration (et incrémente `schema_version` sur le volume). **Le retour en
arrière n'est pas possible** une fois la migration faite : faites une
sauvegarde avant, et évitez les tags `latest`, `edge` et `beta`, qui feraient
diverger le volume de ce que le `Dockerfile` sait relire.
