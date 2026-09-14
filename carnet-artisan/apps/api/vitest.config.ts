import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@carnet/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    // Les tests d'isolation partagent une base PostgreSQL : on evite les
    // courses entre fichiers en les executant en serie.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
