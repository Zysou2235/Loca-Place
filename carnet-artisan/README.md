# Carnet Artisan

Assistant mobile pour les artisans du bâtiment : transforme les appels
téléphoniques professionnels en fiches clients, dossiers chantier, tâches,
propositions de rendez-vous et brouillons de devis.

L'artisan continue de parler lui-même à ses clients. Ce n'est pas un robot qui
répond à sa place.

> **Nom provisoire.** « Carnet Artisan » n'a fait l'objet d'aucune recherche
> d'antériorité ni de disponibilité commerciale.

## L'état du projet en trois phrases

1. **Le parcours métier fonctionne et il est testé** : 197 tests automatisés,
   dont 109 contre une vraie base PostgreSQL.
2. **La téléphonie n'a jamais été testée en vrai.** Aucun compte fournisseur,
   aucun numéro, aucun appel reçu. Le code existe, il n'a jamais tourné contre
   l'API réelle.
3. **L'application mobile n'a jamais été construite ni installée** sur un
   téléphone. Elle passe le typecheck, c'est tout.

Le détail, sans arrondi : [`docs/03-etat-telephonie.md`](docs/03-etat-telephonie.md).

## Le résultat le plus important de l'audit

L'API Zadarma **n'expose aucun mécanisme de notification push VoIP vers une
application tierce** : ni jeton APNs/FCM, ni paramètres de push SIP (RFC 8599).
Vérifié dans sa spécification OpenAPI officielle : 0 occurrence de `apns`,
`fcm`, `callkit`, `pushkit`, `device_token`, `8599`.

Sans cela, **notre application ne peut pas sonner quand l'iPhone dort**. CallKit
n'est pas un transport téléphonique : c'est l'interface système d'appel, et il
faut quelqu'un pour la réveiller.

D'où l'**architecture B** pour le pilote : l'artisan décroche dans
l'application du fournisseur, Carnet Artisan reçoit l'**analyse** de l'appel.
L'application unique reste un objectif non atteint, pas un objectif abandonné :
[`docs/02-decision-architecture.md`](docs/02-decision-architecture.md) chiffre
ce qu'il faudrait pour y arriver.

## Démarrer

```bash
npm install
cp .env.example .env
# Renseigner DATABASE_URL, JWT_SECRET et CHIFFREMENT_CLE (commandes dans le fichier).

npm run db:generate -w @carnet/api
npm run db:deploy   -w @carnet/api

npm run dev    -w @carnet/api   # API sur http://localhost:3001
npm run worker -w @carnet/api   # worker, second terminal
```

Par défaut, tous les fournisseurs sont en mode `demo` : **aucun service externe
n'est contacté**. Créez un compte via `POST /auth/inscription`, puis
`POST /demo/preparer` et `POST /demo/rejouer` pour parcourir les huit scénarios.

### Vérifier

```bash
npm run typecheck   # socle + API + mobile
npm run lint
npm test            # 197 tests (nécessite PostgreSQL)
```

Les tests de l'API tournent contre une vraie base. Créez-la une fois :

```bash
createdb carnet_test
DATABASE_URL=postgresql://carnet:carnet@127.0.0.1:5432/carnet_test \
  npm run db:deploy -w @carnet/api
```

### Application mobile

```bash
cd apps/mobile && npm install && npm run typecheck
```

Le build exige des outils absents de l'environnement de développement (Xcode
pour iOS, SDK Android pour Android) :
[`docs/08-configuration-fournisseurs.md`](docs/08-configuration-fournisseurs.md).

## Organisation

```
packages/shared/    logique déterministe : argent, TVA, devis, dates FR,
                    schéma d'extraction, signatures fournisseur
apps/api/           serveur Fastify, Prisma, workers, adaptateurs
apps/mobile/        application React Native (5 onglets, mode démonstration)
docs/               audit, décisions, limites, coûts, tests
```

## Les cinq règles qui tiennent le produit

**1. Rien n'est inventé.** Une quantité, un prix ou une adresse absents de la
conversation restent absents. Le moteur de devis ne suppose jamais une quantité
de 1, ni un taux de TVA à 20 %. Un devis incomplet ne peut pas être validé.

**2. Les calculs ne passent jamais par un modèle de langage.** Montants,
remises, TVA, totaux : code déterministe, centimes entiers, arrondi explicite.
Le modèle rapporte ce qui a été dit ; il ne calcule rien.

**3. Chaque information porte sa provenance.** Valeur, extrait de
transcription, repère temporel, et statut : *dit pendant l'appel*, *déduit*, ou
*à confirmer*. Une valeur marquée « explicite » sans citation est
automatiquement rétrogradée.

**4. Une transcription est une donnée, jamais une instruction.** N'importe qui
peut appeler et dicter des consignes. Le modèle n'a aucun outil : il ne peut
rien déclencher. Les tentatives sont remontées à l'artisan, jamais exécutées.

**5. Rien n'est « connecté » avant d'avoir été vérifié.** Enregistrer une clé
API ne fait pas passer la téléphonie en vert. Seul un appel réel, reçu, signé,
enregistré et analysé de bout en bout le fait.

## Mode démonstration

Huit conversations fictives couvrent les situations qui cassent un pipeline
naïf : ambiguïté de chantier, correction de quantité en cours d'appel, urgence
sans prix convenu, audio dégradé, numéro masqué, tentative d'injection
d'instructions.

Les données sont entièrement fictives (numéros en `0639 98 xx xx`, réservés aux
fictions par l'ARCEP). Aucun appel réseau, aucune facturation.

**Une démonstration réussie ne prouve rien sur la réception réelle des appels**,
et l'application le rappelle à l'écran.

## Documentation

| | |
|---|---|
| [01 — Audit de faisabilité Zadarma](docs/01-audit-faisabilite-zadarma.md) | sources, endpoints, signatures, quotas, ce qui reste à vérifier |
| [02 — Décision d'architecture](docs/02-decision-architecture.md) | pourquoi l'option B, et le prix de l'option A |
| [03 — État exact de la téléphonie](docs/03-etat-telephonie.md) | écrit / compile / testé / validé sur appareil |
| [04 — Modèle de données](docs/04-modele-donnees.md) | entités, unités, conservation |
| [05 — Matrice de tests mobiles](docs/05-matrice-tests-mobiles.md) | plan de test appareils — aucune ligne exécutée |
| [06 — Modèle de coûts](docs/06-modele-couts.md) | ce qui est mesuré, ce qui manque |
| [07 — Limites et dépendances](docs/07-limites-et-dependances.md) | ce qui bloque un lancement commercial |
| [08 — Configuration des fournisseurs](docs/08-configuration-fournisseurs.md) | procédures, à valider en conditions réelles |

## Tarif

**24,90 € TTC par mois est une hypothèse à tester, pas un prix validé.** Sa
rentabilité n'est pas démontrée : aucun tarif fournisseur réel n'est connu à ce
jour ([`docs/06`](docs/06-modele-couts.md)).
