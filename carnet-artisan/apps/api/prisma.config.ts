import 'node:process';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 : l'URL de connexion ne vit plus dans le schema.
 * Elle est lue ici pour les migrations, et passee au client via un adaptateur
 * (voir src/db.ts). Aucune valeur par defaut n'est codee en dur : une URL
 * absente doit faire echouer bruyamment, pas pointer vers une base surprise.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
