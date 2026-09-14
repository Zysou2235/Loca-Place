import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Regles volontairement resserrees sur ce qui compte pour ce projet :
 *  - pas de `any` implicite ni explicite qui ferait passer une donnee non
 *    validee pour sure ;
 *  - pas de promesse laissee sans gestion (un job perdu en silence est pire
 *    qu'une erreur affichee) ;
 *  - pas de variable inutilisee, qui signale souvent du code mort.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/api/src/generated/**',
      'apps/mobile/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./packages/shared/tsconfig.eslint.json', './apps/api/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      'no-console': ['warn', { allow: ['error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Les tests ont le droit d'etre plus directs : assertions non nulles,
    // acces indexes, et journalisation.
    files: ['**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['apps/api/src/jobs/worker-cli.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // `FastifyPluginAsync` impose une fonction async, meme quand le corps du
    // plugin n'attend rien : la regle generique ne s'applique pas ici.
    files: ['apps/api/src/routes/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
);
