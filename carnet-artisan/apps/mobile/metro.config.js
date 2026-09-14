const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('node:path');

/**
 * Le paquet @carnet/shared vit a la racine du monorepo : Metro doit pouvoir
 * le resoudre hors du dossier de l'application.
 */
const racineMonorepo = path.resolve(__dirname, '../..');

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [racineMonorepo],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(racineMonorepo, 'node_modules'),
    ],
  },
});
