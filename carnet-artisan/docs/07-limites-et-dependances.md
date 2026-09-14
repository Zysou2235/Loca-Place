# Limites connues et dépendances externes

Liste tenue à jour volontairement sans ménagement. Ce qui n'est pas fait est
écrit comme tel.

## Ce qui empêche un lancement commercial aujourd'hui

1. **La téléphonie n'a jamais été testée en vrai.** Aucun compte fournisseur,
   aucun numéro, aucun appel reçu. Tout le code téléphonique est écrit et
   typé, jamais exécuté contre l'API réelle (`docs/03`).
2. **L'application mobile n'a jamais été construite ni installée.** Ni `.ipa`
   ni `.apk`. Le code passe le typecheck, rien de plus.
3. **L'application ne reçoit pas les appels** (option B, `docs/02`). L'artisan
   doit installer une seconde application pour décrocher.
4. **Le statut revendeur n'est pas obtenu**, et ses conditions sont inconnues.
   Sans lui, l'artisan devra créer son compte fournisseur lui-même.
5. **Aucun tarif réel** n'est connu : la rentabilité de 24,90 € TTC/mois n'est
   pas démontrée (`docs/06`).
6. **Les règles des magasins d'applications n'ont pas été vérifiées** pour le
   mécanisme d'abonnement.
7. **Le dispositif d'information des personnes enregistrées n'existe pas.**
   Aucun client réel ne doit être enregistré avant.
8. **Le comportement à l'expiration de l'abonnement n'est pas implémenté** :
   notamment la procédure guidée pour désactiver le renvoi d'appel.

## Sécurité — ce qui est fait, ce qui ne l'est pas

**Fait et testé :**

- isolation stricte entre entreprises, vérifiée sur chaque route (17 tests) ;
- webhooks vérifiés par signature **avec le secret de l'entreprise concernée**,
  fermés par défaut, idempotents (16 tests) ;
- téléchargement audio protégé contre les SSRF : HTTPS obligatoire, liste
  blanche de domaines, refus des adresses internes (dont `169.254.169.254`),
  redirections revalidées, limites de taille et de durée (22 tests) ;
- secrets fournisseur chiffrés au repos (AES-256-GCM), jamais renvoyés à
  l'application ;
- transcriptions traitées comme des données non fiables ; le modèle n'a aucun
  outil et ne peut donc rien déclencher ;
- URL d'enregistrement jamais journalisée avec sa chaîne de requête.

**Pas fait :**

- **le jeton de session n'est pas persisté** dans le Keychain iOS ni le
  Keystore Android. Il reste en mémoire : l'artisan se reconnecte à chaque
  lancement. Choix assumé et affiché dans l'application, plutôt qu'un stockage
  en clair dans `AsyncStorage` ;
- pas de rotation des jetons, pas de révocation de session à distance ;
- pas de journal d'audit des accès aux données ;
- pas d'authentification à deux facteurs ;
- pas de limitation de débit spécifique sur la route de connexion (seulement la
  limite globale de 300 requêtes/minute) ;
- **aucun audit de sécurité externe.**

## RGPD

**Ce logiciel n'est pas « certifié RGPD ».** Une telle certification n'existe
pas, et le logiciel ne met personne en conformité — il outille, c'est tout.

Ce qui est en place : isolation des données, conservation configurable,
suppression effective (base **et** fichiers), export complet au format JSON,
journaux sans contenu d'appel, notifications d'écran verrouillé sans détail.

Ce qui reste entièrement à traiter :

- **information des personnes enregistrées** : un client qui appelle doit être
  informé que la conversation est enregistrée. Ni le message d'accueil, ni la
  base légale, ni la durée de conservation à annoncer ne sont définis ;
- registre des traitements, analyse d'impact si nécessaire ;
- contrats de sous-traitance avec chaque fournisseur ;
- **régions de traitement** : où le fournisseur téléphonique stocke les
  enregistrements, où le service de transcription et le modèle d'analyse
  traitent les données. **Inconnu à ce jour** ;
- procédure de réponse aux demandes d'accès et d'effacement.

**Pour le développement, n'utiliser que des données fictives ou des appels de
test entre personnes informées.** Le jeu de démonstration est entièrement
fictif (numéros en `0639 98 xx xx`, réservés aux fictions par l'ARCEP).

## Conformité des devis

Le logiciel **ne garantit pas** la conformité juridique d'un devis. Il signale
ce qu'il sait détecter (SIRET absent, adresse incomplète, mention de franchise
en base à vérifier) et affiche en pied de document les mentions qu'il **ne**
vérifie **pas** : durée de validité, assurance décennale, conditions de
règlement, délai de rétractation.

Un brouillon exporté porte un filigrane « BROUILLON » et le mot brouillon dans
son titre et son nom de fichier. Test :
`exporte un PDF marque brouillon tant que le devis n est pas valide`.

## Dépendances externes

| Dépendance | Rôle | État |
|---|---|---|
| Zadarma (ou équivalent) | téléphonie, enregistrement | **aucun compte** |
| Statut revendeur Zadarma | provisionnement automatique | **non obtenu, conditions inconnues** |
| Service de transcription | audio → texte | **aucun contrat** |
| API de modèle de langage | analyse structurée | **aucune clé** |
| Compte développeur Apple | build iOS, TestFlight, certificat APNs VoIP | **non souscrit** (99 $/an) |
| Compte développeur Google Play | build et distribution Android | **non souscrit** (25 $) |
| PostgreSQL 16+ | base de données | fonctionne en local |
| Infrastructure SIP (option A) | réception des appels dans l'app | **non engagée** |

## Choix techniques assumés

- **Navigation mobile écrite à la main** plutôt que `react-navigation` : cinq
  onglets et un écran de détail ne justifiaient pas des dépendances natives
  supplémentaires au premier build. À revoir dès que la navigation se
  complexifie.
- **File de jobs en base plutôt que Redis** : le MVP doit rester installable
  sans infrastructure supplémentaire, et la file se sauvegarde avec le reste
  des données.
- **scrypt plutôt qu'argon2** : évite une compilation native, avec des
  paramètres explicites et un format de stockage versionné pour permettre une
  migration ultérieure.
- **`@carnet/mobile` hors des workspaces npm** : Metro a sa propre résolution
  de modules et cohabite mal avec le hissage des workspaces.
