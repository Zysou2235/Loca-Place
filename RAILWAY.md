# Déploiement sur Railway

Railway héberge **l'application ET la base Postgres au même endroit** — la
`DATABASE_URL` est une chaîne `postgres://` standard, sans configuration
compliquée.

## 1. Créer le projet

1. Va sur **[railway.com](https://railway.com)** → connecte-toi avec GitHub.
2. **New Project** → **Deploy from GitHub repo** → choisis **`Zysou2235/Loca-Place`**.
3. Railway détecte Next.js et lance un premier build (il échouera tant que la
   base n'est pas branchée — c'est normal, on la crée à l'étape suivante).

## 2. Ajouter la base Postgres

1. Dans le projet → **New** (ou « + Create ») → **Database** → **Add PostgreSQL**.
2. Railway crée un service **Postgres** avec une variable `DATABASE_URL`.

## 3. Brancher la base + le secret sur l'application

Clique sur le service **de l'application** (pas le Postgres) → onglet
**Variables** → ajoute :

| Variable          | Valeur                                                   |
| ----------------- | -------------------------------------------------------- |
| `DATABASE_URL`    | `${{Postgres.DATABASE_URL}}` (référence au service Postgres) |
| `SESSION_SECRET`  | une longue chaîne aléatoire (`openssl rand -hex 32`)     |
| `ADMIN_EMAILS`    | ton email (pour accéder à `/admin`)                      |
| `NEXT_PUBLIC_BASE_URL` | l'URL publique (à remplir après l'étape 5)          |

> Astuce : pour `DATABASE_URL`, Railway propose souvent d'ajouter la référence
> via un menu « Add Reference » → choisis le service **Postgres** → `DATABASE_URL`.

## 4. Redéployer

Onglet **Deployments** → **Redeploy** (ou ça repart tout seul après l'ajout des
variables). Au build, les tables se créent automatiquement
(`prisma db push`), puis l'appli démarre.

## 5. Obtenir l'URL publique

Service de l'app → **Settings → Networking → Generate Domain**.
Tu obtiens une URL du type `https://loca-place-production.up.railway.app`.

Renseigne cette URL dans `NEXT_PUBLIC_BASE_URL`, puis redéploie une dernière fois.

## 6. Tester

- Landing : `https://<ton-app>.up.railway.app`
- Espace hôte : `/host/signup`
- Démo voyageur : `/b/demo`

## 7. Brancher ton vrai nom de domaine

Railway permet de connecter un domaine perso (ex. `eskalebox.fr`).

1. Achète le domaine chez un registrar (OVH, Gandi, Namecheap…).
2. Dans Railway → service de l'app → **Settings → Networking → Custom Domain**
   → saisis ton domaine (ex. `eskalebox.fr` et/ou `www.eskalebox.fr`).
3. Railway affiche un enregistrement **CNAME** (ou A) à ajouter.
4. Chez ton registrar, dans la **zone DNS**, ajoute cet enregistrement.
   Patiente quelques minutes (jusqu'à quelques heures) — le **HTTPS est
   automatique**.
5. Mets `NEXT_PUBLIC_BASE_URL` = `https://eskalebox.fr` puis redéploie.
6. Si Stripe est branché, mets aussi à jour l'URL du webhook avec le domaine.

> Le même principe marche sur Vercel (Settings → Domains). Le nom de domaine
> n'est donc pas un critère de choix entre les deux : les deux le font.

## Stripe (quand tu seras prêt)

1. Ajoute la variable **`STRIPE_SECRET_KEY`** (`sk_test_...` puis `sk_live_...`).
   C'est la **seule** clé indispensable — les tarifs d'abonnement sont créés
   automatiquement (aucun Price ID à configurer).
2. Active **Apple Pay / Google Pay** dans Stripe → Settings → Payment methods
   (activés par défaut). Rien d'autre à faire : ils apparaissent tout seuls.
3. Active **Connect** (versement direct des ventes aux hôtes).
4. (Recommandé en prod) Webhook → URL :
   `https://<ton-app>.up.railway.app/api/stripe/webhook`, événements
   `checkout.session.completed`, `customer.subscription.*`, `account.updated`,
   puis copie le secret dans `STRIPE_WEBHOOK_SECRET`.

## Envoi du code au voyageur (Resend)

Après chaque paiement, l'app envoie automatiquement au voyageur un email
contenant le code d'ouverture de la boîte. Cela passe par **Resend**.

1. Crée un compte gratuit sur **[resend.com](https://resend.com)** (3 000
   emails/mois gratuits).
2. **API Keys → Create** → copie la clé `re_...`.
3. Ajoute les variables sur le service de l'app :

   | Variable          | Valeur                                                  |
   | ----------------- | ------------------------------------------------------- |
   | `RESEND_API_KEY`  | ta clé `re_...`                                         |
   | `RESEND_FROM`     | `onboarding@resend.dev` (test) puis `Eskale Box <codes@tondomaine.fr>` |

> ⚠️ Avec `onboarding@resend.dev`, les emails ne partent **que** vers l'adresse
> de ton compte Resend. Pour écrire à n'importe quel voyageur, vérifie ton
> domaine dans **Resend → Domains** (ajout de 2-3 lignes DNS) puis utilise
> `codes@tondomaine.fr`.

Le voyageur voit aussi son code à l'écran après paiement : si Resend n'est pas
configuré, la vente fonctionne quand même, et tu peux renvoyer le code à la
main depuis `/admin`.

> SMS (Twilio) : optionnel, non requis pour le lancement. À ajouter plus tard
> si tu veux doubler l'email par un SMS.
