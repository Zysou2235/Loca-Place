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
| `STRIPE_SECRET_KEY`       | `sk_test_...` (ou `sk_live_...` en prod)                      |
| `NEXT_PUBLIC_BASE_URL`    | l'URL du déploiement, ex. `https://eskale-box.vercel.app`    |

> Astuce : déploie une première fois pour connaître l'URL, puis renseigne
> `NEXT_PUBLIC_BASE_URL` et redéploie.

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
- Parcours voyageur : `https://<ton-app>.vercel.app/b/demo`
- Paiement : carte test Stripe `4242 4242 4242 4242`.

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
