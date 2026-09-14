import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { configuration } from './config.js';

/**
 * Client Prisma unique.
 *
 * Prisma 7 se connecte via un adaptateur de pilote : l'URL n'est plus lue dans
 * le schema, elle vient de la configuration validee au demarrage.
 */
let client: PrismaClient | null = null;

export function prisma(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: configuration().DATABASE_URL });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export async function fermerPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

export type { PrismaClient };
