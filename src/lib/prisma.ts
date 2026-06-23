import { PrismaClient } from "@prisma/client";

// Pick a connection string that the standard Prisma client can actually use.
// Vercel/Neon integrations expose several names, and some (Prisma Accelerate)
// use a `prisma+postgres://` scheme that the plain client cannot connect to —
// so we explicitly select the first valid `postgres(ql)://` URL available.
const isStandardPostgres = (u: string | undefined): u is string =>
  typeof u === "string" && /^postgres(ql)?:\/\//.test(u);

const connectionString = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
].find(isStandardPostgres);

if (connectionString) {
  process.env.DATABASE_URL = connectionString;
}

// Avoid creating a new PrismaClient on every hot-reload in development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
