# Déploiement sur Vercel

Eskale Box est une app Next.js 15 + Prisma + Postgres. Voici les étapes exactes
pour la mettre en ligne (≈ 5 min).

## 1. Créer une base Postgres

Choisis un fournisseur (un seul) :

- **Vercel Postgres** (le plus simple) : dans le projet Vercel → onglet
  **Storage** → **Create Database** → Postgres. Les variables `POSTGRES_*` sont
  injectées automatiquement.
- **Neon** : https://neon.tech → crée un projet → copie la **Pooled connection
  string**.
- **Supabase** : https://supabase.com → projet → Settings → Database → copie
  l'URI **Connection pooling** (port 6543, ajoute `?pgbouncer=true`).

## 2. Importer le repo sur Vercel

1. https://vercel.com/new → **Import** le dépôt GitHub.
2. Framework détecté automatiquement : **Next.js**. Ne touche pas au build
   command (le `package.json` lance déjà `prisma generate && next build`).

## 3. Variables d'environnement (Settings → Environment Variables)

| Variable                  | Valeur                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`            | la chaîne **poolée** Postgres (ou `POSTGRES_PRISMA_URL` Vercel) |
| `SESSION_SECRET`          | **obligatoire** — `openssl rand -hex 32`                      |
| `STRIPE_SECRET_KEY`       | `sk_test_...` (ou `sk_live_...` en prod)                      |
| `STRIPE_WEBHOOK_SECRET`   | `whsec_...` (voir étape 6)                                    |
| `STRIPE_PRICE_ESSENTIEL`  | Price ID Stripe de la formule Essentiel (`price_...`)        |
| `STRIPE_PRICE_DUO`        | Price ID Stripe de la formule Duo                            |
| `STRIPE_PRICE_PRO`        | Price ID Stripe de la formule Pro                            |
| `NEXT_PUBLIC_BASE_URL`    | l'URL du déploiement, ex. `https://eskale-box.vercel.app`    |

> ⚠️ `SESSION_SECRET` est **requis en production** : sans lui, les sessions
> seraient falsifiables (l'app refuse de démarrer). Génère-le avec
> `openssl rand -hex 32`.

> Astuce : déploie une première fois pour connaître l'URL, puis renseigne
> `NEXT_PUBLIC_BASE_URL` et redéploie.

### Créer les produits d'abonnement Stripe

Dans le dashboard Stripe → **Produits**, crée 3 produits récurrents (mensuels)
à 19€, 29,90€ et 49€, puis copie chaque **Price ID** (`price_...`) dans les
variables `STRIPE_PRICE_*`.

### Activer Stripe Connect

Active **Connect** dans le dashboard Stripe (pour le versement direct des
ventes aux hôtes via comptes Express).

## 4. Créer les tables + la boîte de démo

Depuis ta machine, pointe Prisma sur la base de prod et lance :

```bash
# DATABASE_URL = la même chaîne Postgres que sur Vercel
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npm run db:seed
```

(Ou utilise l'onglet SQL de Neon/Supabase pour exécuter le schéma.)

## 5. Tester

- Accueil : `https://<ton-app>.vercel.app`
- Espace hôte : `https://<ton-app>.vercel.app/host/signup`
- Parcours voyageur : `https://<ton-app>.vercel.app/b/demo`
- Paiement : carte test Stripe `4242 4242 4242 4242`.

## 6. Configurer le webhook Stripe

Dans Stripe → **Developers → Webhooks → Add endpoint** :

- URL : `https://<ton-app>.vercel.app/api/stripe/webhook`
- Événements : `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `account.updated`
- Copie le **Signing secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`, puis
  redéploie.

## Mettre le code dans un dépôt `eskale-box` dédié

Le code vit actuellement sur la branche `claude/staybox-traveler-checkout-51n3h0`
du dépôt `loca-place`. Pour le copier dans un nouveau repo `eskale-box` :

```bash
# 1. Crée un repo VIDE "eskale-box" sur github.com (sans README)
# 2. Depuis le dossier du projet :
git checkout claude/staybox-traveler-checkout-51n3h0
git remote add eskale https://github.com/Zysou2235/eskale-box.git
git push eskale claude/staybox-traveler-checkout-51n3h0:main
```

Ensuite, sur Vercel, importe `eskale-box` au lieu de `loca-place`.
