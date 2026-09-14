# Décision d'architecture

## La décision

**Option B retenue pour le pilote : application compagnon.**

L'artisan **répond à ses appels comme aujourd'hui** (application du fournisseur
téléphonique, ou son téléphone). Carnet Artisan reçoit **l'analyse** de ces
appels, pas les appels eux-mêmes.

## Pourquoi

L'audit (`docs/01`) établit que l'API Zadarma n'expose **aucun** mécanisme de
notification push VoIP vers une application tierce : ni jeton APNs/FCM, ni
paramètres de push SIP (RFC 8599). Sans cela, notre application ne peut pas
être réveillée quand l'iPhone dort, et un appel entrant ne sonnerait pas.

Construire l'option A malgré tout, avec les briques actuelles, produirait une
application qui sonne quand elle est ouverte et qui rate les appels le reste du
temps — c'est-à-dire la quasi-totalité du temps, pour un artisan en chantier.

## Ce que cela veut dire concrètement

**L'objectif d'application unique n'est pas atteint.** Il n'est pas abandonné,
il n'est pas remplacé en douce : il est repoussé, et son coût est chiffré
ci-dessous.

Conséquences assumées dans le produit :

- **aucun bouton d'appel** dans l'application — il serait faux ;
- l'écran Réglages affiche explicitement « les appels ne sonnent pas dans cette
  application » tant que `capacitesFournisseur.pushVoipVersApplicationTierce`
  est faux (`apps/mobile/src/ecrans/Parametres.tsx`) ;
- l'état téléphonique ne passe jamais à « vérifié » sans un appel réel reçu,
  signé, enregistré et analysé de bout en bout.

## Ce qui fonctionne quand même, et c'est l'essentiel du produit

```
numéro habituel de l'artisan
  → renvoi configuré par LUI chez SON opérateur
  → numéro technique Zadarma (jamais communiqué aux clients)
  → l'artisan décroche dans l'application du fournisseur
  → enregistrement côté fournisseur
  → webhook signé vers notre serveur
  → transcription → analyse → fiche, tâches, rendez-vous proposés,
    brouillon de devis dans Carnet Artisan
```

L'artisan ne change pas de numéro, ne demande pas de portabilité, ne met pas
son téléphone en haut-parleur, n'enregistre rien lui-même.

**Il doit en revanche installer une seconde application** (celle du
fournisseur) pour décrocher. C'est la friction que l'option A supprimerait.

## Le chemin vers l'option A, et son prix

L'audit a identifié une issue documentée : `POST /v1/pbx/redirection/` avec
`type=sip_uri` permet à Zadarma de transférer l'appel vers **une URI SIP que
nous contrôlons**.

Ce qu'il faudrait alors ajouter :

| Brique | Nature | Remarque |
|---|---|---|
| SBC / proxy SIP (Kamailio, Asterisk, FreeSWITCH) | exploitation 24/7 | le vrai coût : supervision, sécurité, astreinte |
| Émission des pushs VoIP APNs + FCM | développement serveur | certificat APNs VoIP dédié |
| Module natif iOS : PushKit + CallKit + AVAudioSession | développement natif | PushKit n'est autorisé que pour son usage VoIP légitime |
| Module natif Android : ConnectionService (Telecom) + service de premier plan | développement natif | comportement variable selon les constructeurs |
| Matrice de tests sur appareils physiques | validation | voir `docs/05` |

**Aucune de ces briques n'a été souscrite, commandée ou développée.** Le
chiffrage reste à faire, et il n'est pas mince : c'est un changement de nature
du produit, pas une fonctionnalité de plus.

## Alternatives à étudier avant de s'engager

Des fournisseurs de communication proposent des SDK mobiles VoIP intégrant
déjà PushKit/CallKit et ConnectionService. Ils règlent la partie « sonner sur
l'iPhone », mais il faudrait vérifier, pour chacun :

- numéros géographiques français et démarches associées ;
- enregistrement des appels et accès aux fichiers ;
- coût par minute et par numéro ;
- région de traitement des données (RGPD) ;
- compatibilité avec le modèle revendeur (un compte par artisan).

**Rien de tout cela n'a été évalué. Aucun changement de fournisseur ne doit
être décidé sans cette évaluation.**

## Ce que l'architecture logicielle prévoit déjà

Le contrat `FournisseurTelephonie`
(`apps/api/src/adapters/telephony/types.ts`) porte un objet `capacites` décrivant
ce que le fournisseur sait faire. L'interface s'y adapte au lieu d'afficher des
boutons inopérants. Changer de fournisseur, ou passer à l'option A, se fait en
ajoutant un adaptateur — pas en réécrivant le produit.
