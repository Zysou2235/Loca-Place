# Escale Box — MVP

> _La boutique autonome pour voyageurs._

La boîte transparente avec QR code qui permet aux hôtes Airbnb de vendre des
produits à leurs voyageurs. Le voyageur scanne le QR code, voit les produits et
paie en invité via Stripe Checkout. **Commission Petz : 0%** au MVP — l'argent
va directement à l'hôte.

> Ce MVP couvre **l'Étape 1 : le parcours voyageur**. Le formulaire hôte
> (création de boîtes / produits) n'est pas encore implémenté : la boîte de démo
> est créée via le seed.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Prisma + PostgreSQL** (Neon / Supabase / Vercel Postgres)
- **Stripe** Checkout + Connect Express (`on_behalf_of` → destination charge)
- **qrcode** pour générer le QR code depuis l'URL `/b/[qr_slug]`
- **Tailwind CSS**

## Modèle de données (3 tables)

- `Host` — l'hôte, avec son `stripeAccountId` (compte Connect Express)
- `Box` — la boîte physique, identifiée par un `qrSlug` public (`/b/[qr_slug]`)
- `Product` — un produit (nom, prix en centimes, photo optionnelle)

## Démarrage

```bash
npm install

# Configure l'environnement
cp .env.example .env
# Renseigne DATABASE_URL (Postgres) et STRIPE_SECRET_KEY dans .env

# Crée les tables + la boîte de démo
npm run db:push
npm run db:seed

npm run dev
```

> Pas de Postgres local ? Crée une base gratuite sur Neon/Supabase et utilise sa
> chaîne de connexion comme `DATABASE_URL` (en local comme en prod).

**Déploiement Vercel : voir [DEPLOY.md](./DEPLOY.md).**

Puis ouvre :

- **Accueil** : http://localhost:3000
- **Parcours voyageur (boîte démo)** : http://localhost:3000/b/demo
- **QR code de la boîte démo** : http://localhost:3000/api/qr/demo

## Parcours voyageur

1. `/b/[qr_slug]` affiche la liste des produits (nom, prix, photo optionnelle).
2. Le bouton **« Payer »** crée une Stripe Checkout Session et redirige vers la
   page de paiement hébergée par Stripe (paiement en invité).
3. Après paiement, retour sur `/checkout/success` qui confirme la commande.

## Routage de l'argent (0% commission)

Quand l'hôte a un `stripeAccountId` (compte Connect Express `acct_...`), la
Checkout Session utilise un *destination charge* :

```ts
payment_intent_data: {
  on_behalf_of: host.stripeAccountId,
  transfer_data: { destination: host.stripeAccountId },
}
```

Aucun `application_fee_amount` n'est appliqué → **la totalité va à l'hôte**.

Pour tester de bout en bout sans compte Connect, laisse `stripeAccountId` à
`null` (valeur par défaut du seed) : le paiement se fait alors sur le compte
plateforme. Renseigne `DEMO_HOST_STRIPE_ACCOUNT=acct_...` avant le seed pour
activer le routage vers l'hôte.

## Cartes de test Stripe

- Succès : `4242 4242 4242 4242`, date future, CVC quelconque.
