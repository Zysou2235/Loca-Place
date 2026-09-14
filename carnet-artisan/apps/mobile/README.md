# Application mobile

React Native 0.87 + TypeScript. Interface entièrement en français.

## État

**Le code passe le typecheck. Il n'a jamais été construit ni installé sur un
téléphone.** Aucun `.ipa`, aucun `.apk`, aucun lien de téléchargement.

```bash
npm install
npm run typecheck   # fonctionne
npm run android     # exige le SDK Android (absent de l'env. de développement)
npm run ios         # exige Xcode, donc un Mac
```

## Écrans

`Aujourd'hui` · `Appels` · `Clients / Chantiers` · `Devis` · `Réglages`,
plus un écran de détail d'appel et un écran de démonstration.

Navigation écrite à la main : cinq onglets ne justifiaient pas d'ajouter
`react-navigation` et ses dépendances natives au premier build. À revoir dès
que la navigation se complexifie (retour matériel Android, liens profonds).

## Deux points d'honnêteté dans l'interface

**Aucun bouton d'appel.** Le fournisseur retenu n'expose pas de notification
VoIP vers une application tierce : l'application ne peut pas recevoir les
appels. Un bouton « appeler » serait faux, donc il n'existe pas. L'écran
Réglages l'explique, en se fondant sur
`capacitesFournisseur.pushVoipVersApplicationTierce`.

**Le jeton de session n'est pas persisté.** `StockageMemoire` en garde une copie
en mémoire et disparaît à la fermeture : l'artisan se reconnecte à chaque
lancement. C'est délibéré — un jeton de session n'a rien à faire dans
`AsyncStorage`, lisible en clair sur un appareil compromis. La persistance
demande le Keychain iOS et le Keystore Android, donc un build natif.
L'application affiche cette limite au lieu de la cacher.

## Adresse du serveur

Dans `src/configuration.ts` :

| Contexte | Valeur |
|---|---|
| Émulateur Android | `http://10.0.2.2:3001` (défaut) |
| Simulateur iOS | `http://localhost:3001` |
| Téléphone physique | `http://<IP de la machine>:3001` |

Depuis un téléphone physique, `localhost` désigne le téléphone lui-même.

## Pas dans les workspaces npm

`@carnet/mobile` est volontairement hors des workspaces : Metro a sa propre
résolution de modules et cohabite mal avec le hissage des dépendances.
`metro.config.js` déclare la racine du monorepo en `watchFolders`.
