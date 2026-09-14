# État exact de la téléphonie

Ce document existe pour qu'on ne confonde jamais quatre choses très
différentes : **code écrit**, **code compilé**, **intégration testée**,
**produit validé sur téléphone**.

## Tableau de vérité

| Élément | Écrit | Compile | Testé hors ligne | Testé contre l'API réelle | Validé sur appareil |
|---|---|---|---|---|---|
| Signature des requêtes API Zadarma | oui | oui | oui (7 tests) | **non** | — |
| Vérification des webhooks Zadarma | oui | oui | oui (16 tests) | **non** | — |
| Création de sous-compte revendeur | oui | oui | non | **non** | — |
| Récupération des clés d'un sous-compte | oui | oui | non | **non** | — |
| Configuration du standard et de l'enregistrement | oui | oui | non | **non** | — |
| Récupération d'un lien d'enregistrement | oui | oui | non | **non** | — |
| Téléchargement audio protégé contre les SSRF | oui | oui | oui (22 tests) | **non** | — |
| Transcription par service externe | oui | oui | non | **non** | — |
| Analyse par modèle de langage | oui | oui | schéma et prompt testés | **non** | — |
| Pipeline complet en mode démonstration | oui | oui | oui (18 tests) | sans objet | — |
| Isolation entre entreprises | oui | oui | oui (17 tests, vraie base) | sans objet | — |
| Application mobile | oui | **typecheck seulement** | non | non | **non** |
| Réception d'appel dans l'application | **non** | — | — | — | — |
| CallKit / PushKit | **non** | — | — | — | — |
| Android Telecom / ConnectionService | **non** | — | — | — | — |

## Ce qui n'existe pas

- **Aucun build iOS.** Xcode n'est pas disponible dans l'environnement de
  développement. Aucun `.ipa`, aucun TestFlight, aucun lien de téléchargement.
- **Aucun build Android.** Le SDK Android n'est pas installé (`ANDROID_HOME`
  absent, pas de `sdkmanager`, pas d'`adb`). Java 21 et Gradle sont présents,
  mais cela ne suffit pas. Aucun `.apk`.
- **Aucun test sur appareil physique.** La matrice de `docs/05` est un plan de
  test, pas un résultat.
- **Aucun appel réel n'a été passé, reçu, enregistré ni analysé.**
- **Aucun compte fournisseur n'a été créé, aucun numéro commandé, aucun
  renvoi activé.**

## Les cinq états affichés à l'artisan

`packages/shared/src/types.ts` → `EtatTelephonie`

| État | Signification | Ce qui fait passer à l'état suivant |
|---|---|---|
| `NON_CONFIGURE` | rien n'a été fait | lancer la configuration |
| `EN_ATTENTE_FOURNISSEUR` | compte créé, en attente de numéro ou de justificatifs | action du fournisseur |
| `EN_ATTENTE_RENVOI_OPERATEUR` | tout est paramétré côté logiciel | **l'artisan** active le renvoi chez son opérateur |
| `PRET_A_TESTER` | le renvoi est déclaré actif | un appel de test réel |
| `TEST_REUSSI` | un appel réel a été reçu, signé, enregistré, analysé | — |
| `ERREUR` | une étape a échoué | correction, puis nouvel appel de test |

**`PRET_A_TESTER` ne veut pas dire « connecté ».** La règle est vérifiée par le
test `ne passe a TEST_REUSSI qu apres un appel reel analyse de bout en bout` :
enregistrer une clé API ne change pas l'état, et un appel de **démonstration**
ne le change pas non plus.

## Deux garde-fous explicites

**La boucle de renvoi.** Si le numéro technique et le numéro personnel sont le
même, le renvoi tourne en rond et l'artisan perd tous ses appels. La
configuration est refusée, y compris quand les deux numéros sont écrits
différemment (`+33299887766` et `0299887766`). Test
`refuse un renvoi qui bouclerait sur le numero technique`.

**Jamais de renvoi activé automatiquement.** L'application n'active aucun
renvoi : elle guide, l'artisan agit chez son opérateur, puis le déclare. Le
champ s'appelle `renvoiConfirmeParUtilisateur` et non `renvoiActif`.

## Appels sortants

Périmètre distinct, volontairement non traité dans ce MVP :

- un appel passé depuis la **carte SIM** ne transite pas par le fournisseur et
  **n'est donc pas analysé** — l'application doit le dire clairement ;
- la présentation du numéro habituel exige un CallerID confirmé côté
  fournisseur, et sa légalité en France reste à vérifier (`docs/01`, §6).
