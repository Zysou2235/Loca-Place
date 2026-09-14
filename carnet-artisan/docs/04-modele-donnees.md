# Modèle de données

Source de vérité : `apps/api/prisma/schema.prisma`. Migration initiale :
`apps/api/prisma/migrations/20260914155638_initial/migration.sql`.

## Règle structurante

**Toute table métier porte `entrepriseId`.** Il n'existe aucune donnée métier
partagée entre entreprises, et chaque contrainte d'unicité est composée avec
`entrepriseId` : deux artisans peuvent utiliser la référence catalogue `PC16`
ou le numéro de devis `D2026-0001` sans collision.

L'accès passe par `ContexteEntreprise`
(`apps/api/src/domaine/contexte-entreprise.ts`), qui n'expose **aucune** méthode
capable de lire une ligne sans ce filtre. L'identifiant d'entreprise vient du
jeton de session signé, jamais du corps d'une requête.

## Entités

### Compte et configuration

- **Entreprise** — le locataire. Porte le mode (`DEMONSTRATION` / `REEL`), le
  fuseau, les durées de conservation, et `jetonWebhook` (unique).
- **Utilisateur** — email unique global, mot de passe haché en scrypt, rôle
  `PROPRIETAIRE` ou `MEMBRE`.
- **ConfigTelephonie** — un par entreprise. Clé et secret fournisseur
  **chiffrés en AES-256-GCM**, jamais renvoyés à l'application mobile.
  Porte l'état de la chaîne (`EtatTelephonie`) et `dernierTestReussi`.

### Métier

- **Client** → **Chantier** (un client, plusieurs chantiers) → **Appel**,
  **Devis**, **Tache**, **RendezVous**, **NoteChantier**.
- **Appel** — `@@unique([entrepriseId, pbxCallId])`. Porte le statut de
  traitement, le message d'erreur, le statut d'association et ses alternatives.
  **Un appel n'est jamais supprimé parce que son traitement a échoué.**
- **Transcription**, **Analyse**, **FichierAudio** — un par appel.
  `Analyse.contenu` suit le schéma `AnalyseAppel` de `@carnet/shared`.
- **Prestation** — catalogue propre à l'artisan,
  `@@unique([entrepriseId, reference])`.
- **Devis** / **LigneDevis** — `quantiteMilli` et `prixUnitaireCents` sont
  **nullables** : c'est ainsi qu'une information manquante reste manquante.
  Les totaux sont stockés pour l'affichage mais **recalculés à chaque lecture**
  par le moteur déterministe ; ils ne font jamais autorité.
- **RendezVous** — naît toujours en `PROPOSE`. Conserve
  `expressionEntendue` et `expressionAbandonnee` (quand l'interlocuteur s'est
  repris) pour que l'artisan voie sur quoi la proposition repose.

### Technique

- **EvenementTelephonie** — journal durable, écrit **avant** tout traitement.
  `@@unique([entrepriseId, cleIdempotence])` : un rejeu ne crée pas de doublon.
- **Job** — file de traitement en base. `cleUnicite` unique globalement,
  verrou d'exécution avec expiration, recul exponentiel, `ECHEC_DEFINITIF`
  visible et relançable.
- **UsageMensuel** — `@@unique([entrepriseId, periode])`, alimente `docs/06`.
- **Abonnement** — un par entreprise, **mode test uniquement**.

## Unités

| Donnée | Unité | Pourquoi |
|---|---|---|
| Montants | centimes entiers (`Int`) | aucun flottant sur de l'argent |
| Quantités | millièmes (`quantiteMilli`) | permet 2,5 h sans flottant |
| Taux de TVA | points de base (`2000` = 20 %) | 5,5 % reste un entier : `550` |
| Durées d'appel | secondes entières | — |
| Horodatages | `DateTime` UTC | le fuseau d'affichage vient de l'entreprise |

## Suppressions en cascade

`onDelete: Cascade` depuis `Entreprise` vers tout le métier. Supprimer une
entreprise efface l'intégralité de ses données en base.

Les fichiers sur disque sont supprimés **avant** les lignes en base
(`routes/parametres.ts`) : si la suppression des fichiers échoue, la base garde
leur trace et l'opération peut être reprise, au lieu de laisser des fichiers
orphelins que plus rien ne référence. Test :
`supprime les fichiers ET les lignes en base`.

## Conservation

- `retentionAudioJours` (défaut 30) — `FichierAudio.expireA` en découle, et le
  job `purger_fichiers_expires` supprime le fichier puis horodate `supprimeA`.
  **L'appel, lui, reste consultable.**
- `retentionTranscriptionJours` (défaut 365, `0` = non conservées) — quand la
  valeur est nulle, l'API ne renvoie plus la transcription.
