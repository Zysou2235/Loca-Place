# Modèle de coûts

## Avertissement

**Ce modèle ne contient aucun tarif réel.** Les pages de tarifs Zadarma étaient
inaccessibles pendant le développement (`docs/01`), et aucun contrat n'a été
signé avec un service de transcription ou d'analyse.

Tous les tarifs sont donc des **paramètres de configuration à zéro par
défaut**, accompagnés de leur source et de leur date :

```
COUT_TELEPHONIE_MILLIEMES_PAR_MINUTE=0
COUT_TRANSCRIPTION_MILLIEMES_PAR_MINUTE=0
COUT_IA_MILLIEMES_PAR_ANALYSE=0
COUT_STOCKAGE_MILLIEMES_PAR_GO_MOIS=0
COUTS_SOURCE=non renseigne
COUTS_DATE=non renseignee
```

Les montants sont exprimés en **millièmes d'euro** pour garder la précision sur
des coûts à la minute, et convertis en centimes au moment d'écrire en base
(arrondi au centime supérieur : mieux vaut surestimer un coût que le
sous-estimer).

**Tant que `COUTS_SOURCE` vaut « non renseigne », aucune simulation de ce
document ne doit servir à décider d'un prix de vente.**

## Ce qui est réellement mesuré

Le pipeline alimente `UsageMensuel`, par entreprise et par mois :

| Champ | Alimenté par |
|---|---|
| `minutesAudio` | durée réelle des appels analysés |
| `nbAppels`, `nbAnalyses`, `nbReprises` | compteurs du pipeline |
| `coutTelephonieCentimes` | minutes × tarif configuré |
| `coutTranscriptionCentimes` | renvoyé par l'adaptateur de transcription |
| `coutIaCentimes` | renvoyé par l'adaptateur d'analyse |
| `stockageOctets` | taille des fichiers conservés |

Ce sont des mesures, pas des estimations. Elles seront exactes dès que les
tarifs le seront.

## Structure de coûts

### Coûts variables (par artisan, par mois)

| Poste | Dépend de | Tarif |
|---|---|---|
| Minutes entrantes | volume d'appels | **à obtenir** |
| Abonnement du numéro | fixe par artisan | **à obtenir** |
| Stockage des enregistrements chez le fournisseur | volume × rétention | **à obtenir** |
| Transcription | minutes | **à obtenir** |
| Analyse par modèle de langage | nombre d'analyses | **à obtenir** |
| Stockage de nos fichiers | volume × rétention | **à obtenir** |

### Coûts fixes (à répartir)

Serveur applicatif, base de données et sauvegardes, supervision et journaux,
nom de domaine et certificats, comptes développeur **Apple (99 $/an) et Google
Play (25 $ une fois)** — ces deux derniers sont les seuls chiffres publics et
stables du tableau, et ils ne dépendent pas du nombre d'artisans.

### Support et acquisition

Volontairement séparés : ce sont eux qui décident de la rentabilité réelle d'un
abonnement à 24,90 € TTC, et ils ne se déduisent d'aucun tarif fournisseur.

- **Support** : l'accompagnement d'un artisan sur la configuration du renvoi
  d'appel est un coût humain, probablement le plus lourd du modèle au début.
- **Acquisition** : coût d'obtention d'un client, à mesurer, pas à supposer.

## Trois scénarios à simuler

Une fois les tarifs obtenus, remplir ce tableau :

| Poste | 100 min/mois | 300 min/mois | 600 min/mois |
|---|---|---|---|
| Minutes entrantes | à compléter | à compléter | à compléter |
| Abonnement numéro | à compléter | à compléter | à compléter |
| Transcription | à compléter | à compléter | à compléter |
| Analyse | à compléter | à compléter | à compléter |
| Stockage | à compléter | à compléter | à compléter |
| **Total variable** | — | — | — |
| **Marge sur 24,90 € TTC (20,75 € HT)** | — | — | — |

Points à ne pas oublier dans le calcul :

- **24,90 € TTC = 20,75 € HT** à 20 % de TVA. C'est ce montant-là qui couvre
  les coûts.
- Un appel de 3 minutes coûte de la téléphonie **et** de la transcription
  **et** de l'analyse. Les postes s'additionnent sur la même minute.
- Les **reprises** après échec consomment une seconde fois la transcription et
  l'analyse. `nbReprises` existe pour les rendre visibles.
- 600 minutes par mois, c'est 10 heures de conversation : un volume plausible
  pour un artisan qui répond beaucoup, pas un cas extrême.

## Règles de communication

- **Ne jamais afficher « illimité »** sans démonstration économique. Le champ
  `minutesAudio` existe précisément pour qu'on ne soit pas obligé de mentir.
- **Le tarif de 24,90 € TTC/mois est une hypothèse à tester**, pas un prix
  validé. Sa rentabilité n'est pas démontrée à ce jour.

## Abonnement et expiration

- **Facturation en mode test uniquement.** Aucun prélèvement réel. Le champ
  `Abonnement.referenceExterne` est prévu, jamais utilisé en production.
- **Règles des magasins à vérifier avant de choisir le mécanisme de
  souscription.** Apple et Google imposent leurs achats intégrés pour certains
  usages numériques, avec leur commission. Intégrer un paiement externe en
  violation de ces règles expose au retrait de l'application. Cette
  vérification n'a pas été faite.
- **Une interruption d'abonnement ne doit jamais faire disparaître les appels.**
  Comportement à définir et à implémenter : les données restent accessibles en
  lecture et exportables, et l'artisan doit être guidé pour **désactiver son
  renvoi d'appel** chez son opérateur — sinon ses appels partent vers un
  service qui ne les traite plus. C'est la conséquence la plus grave d'une
  expiration mal gérée, et elle n'est **pas encore implémentée**.
