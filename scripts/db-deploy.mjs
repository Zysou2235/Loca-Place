// Crée/MAJ les tables au build SI une base est joignable.
// IMPORTANT : ne fait JAMAIS échouer le build — le site (landing statique)
// doit pouvoir se déployer même sans base configurée/joignable.
import { execSync } from "node:child_process";

// Accept the various names used by Vercel/Neon Postgres integrations.
// For DDL (db push), prefer a NON-pooled connection.
const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!url || url.startsWith("file:")) {
  console.log("[db-deploy] DATABASE_URL absente — étape ignorée.");
  process.exit(0);
}

try {
  console.log("[db-deploy] Synchronisation du schéma Prisma…");
  execSync("prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  console.log("[db-deploy] Tables à jour ✅");
} catch (err) {
  // Non bloquant : on log et on laisse le build continuer.
  console.warn(
    "[db-deploy] Synchronisation ignorée (base non joignable au build) :",
    err.message
  );
}

process.exit(0);
