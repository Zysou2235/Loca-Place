# Matrice de tests sur appareils physiques

**Aucune ligne de ce tableau n'a été exécutée.** C'est un plan de test, pas un
résultat. Il ne pourra être rempli qu'une fois l'application construite et
installée sur de vrais téléphones.

## Règles de remplissage

1. **Un simulateur ou un émulateur ne valide rien ici.** Le comportement en
   arrière-plan, les restrictions de batterie, le routage Bluetooth et les
   notifications VoIP diffèrent de l'appareil réel.
2. **Une notification ordinaire reçue ne prouve rien sur la fiabilité d'un
   appel VoIP.** Les deux canaux n'ont ni la même priorité, ni le même
   traitement système.
3. Chaque ligne se remplit avec : appareil, version d'OS, date, résultat,
   et l'observation brute. « Ça marche » n'est pas un résultat.
4. Un test qui échoue reste dans le tableau avec son échec.

## Portée actuelle

L'architecture retenue est l'**option B** (`docs/02`) : l'application ne reçoit
pas les appels. Les lignes marquées **(A)** ne deviennent pertinentes que si
l'option A est engagée. Les lignes **(B)** concernent le produit tel qu'il est
aujourd'hui.

## Appareils minimaux

| Rôle | Appareil | Pourquoi |
|---|---|---|
| iOS récent | iPhone 15 ou plus, iOS 18+ | cible principale |
| iOS ancien | iPhone SE 2e/3e gén. | parc réel des artisans |
| Android constructeur « agressif » | Xiaomi, Oppo ou Samsung | gestion batterie la plus restrictive |
| Android proche de l'AOSP | Pixel | comportement de référence |
| Voiture | un véhicule avec Bluetooth mains libres | usage quotidien en déplacement |

## Matrice

| # | Scénario | Portée | Attendu | Résultat |
|---|---|---|---|---|
| 1 | Appel entrant, application ouverte | (A) | l'appel s'affiche et sonne | **non testé** |
| 2 | Appel entrant, application en arrière-plan | (A) | réveil par push VoIP, sonnerie | **non testé** |
| 3 | Appel entrant, écran verrouillé | (A) | interface d'appel système | **non testé** |
| 4 | Appel entrant, application fermée de force | (A) | comportement à documenter, pas à promettre | **non testé** |
| 5 | Casque/enceinte Bluetooth voiture connectée | (A) | audio routé vers la voiture | **non testé** |
| 6 | Bascule Wi-Fi → réseau mobile en cours d'appel | (A) | appel maintenu ou coupure explicite | **non testé** |
| 7 | Perte de connexion pendant l'appel | (A) | message clair, pas de silence | **non testé** |
| 8 | Appel refusé | (A) | état cohérent des deux côtés | **non testé** |
| 9 | Appel manqué | (A)(B) | trace de l'appel manqué | **non testé** |
| 10 | Interruption par un appel cellulaire | (A) | priorité au cellulaire, reprise propre | **non testé** |
| 11 | Réception en double du même événement | (B) | un seul appel créé — *testé côté serveur* | **non testé sur appareil** |
| 12 | Restrictions de batterie Android actives | (A)(B) | comportement documenté | **non testé** |
| 13 | Mode économie d'énergie iOS | (A)(B) | comportement documenté | **non testé** |
| 14 | Serveur injoignable au lancement | (B) | message d'erreur, pas d'écran vide | **non testé** |
| 15 | Session expirée pendant l'utilisation | (B) | retour à l'écran de connexion | **non testé** |
| 16 | Relance de l'application après redémarrage | (B) | reconnexion demandée (jeton en mémoire) | **non testé** |
| 17 | Parcours démonstration complet | (B) | appel → analyse → devis → PDF | **non testé sur appareil** |
| 18 | Affichage en plein soleil | (B) | contrastes lisibles | **non testé** |
| 19 | Utilisation avec des gants | (B) | zones tactiles ≥ 44 pt | **non testé** |
| 20 | Notification sur écran verrouillé | (B) | **aucun détail client visible** | **non testé** |

## Points à documenter, pas à promettre

- **Exécution permanente en arrière-plan : impossible à garantir.** Ni iOS ni
  Android ne la permettent pour une application tierce. Toute promesse de ce
  type serait fausse.
- **Après une fermeture forcée** (balayage dans le sélecteur d'applications),
  iOS ne relance pas l'application pour une notification ordinaire. Seul un
  push VoIP PushKit le fait — et il n'est légitime que pour un vrai appel.
- **Les constructeurs Android** appliquent des politiques de veille très
  variables. Un comportement validé sur Pixel ne vaut pas pour Xiaomi.

## Tests automatisés côté serveur, déjà exécutés

Ils ne remplacent pas les tests sur appareil, mais ils couvrent la logique :

| Sujet | Fichier | Tests |
|---|---|---|
| Isolation entre entreprises | `apps/api/src/__tests__/isolation.test.ts` | 17 |
| Authentification et idempotence des webhooks | `webhook.test.ts` | 16 |
| Protection SSRF du téléchargement | `telechargement.test.ts` | 22 |
| Parcours métier complet | `parcours.test.ts` | 18 |
| Reprises, conservation, suppression | `resilience.test.ts` | 18 |
| Rattachement client/chantier, import CSV | `association.test.ts` | 18 |
| Socle déterministe | `packages/shared/src/__tests__/` | 88 |

**197 tests, exécutés contre une vraie base PostgreSQL.**
