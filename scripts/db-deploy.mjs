// Crée/MAJ les tables (prisma db push). Tourne au build ET au démarrage :
// sur Railway, la base privée n'est joignable qu'au runtime, donc c'est le
// démarrage qui crée réellement les tables. Ne fait JAMAIS échouer le process.
import { execSync } from "node:child_process";
import path from "node:path";

// Accept the various names used by Vercel/Neon Postgres integrations, ignoring
// non-standard schemes (e.g. Prisma Accelerate `prisma+postgres://`).
const isStandardPostgres = (u) =>
  typeof u === "string" && /^postgres(ql)?:\/\//.test(u);

const url = [
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_PRISMA_URL,
].find(isStandardPostgres);

if (!url) {
  console.log("[db-deploy] Aucune URL Postgres valide — étape ignorée.");
  process.exit(0);
}

// Ensure the local prisma binary is found regardless of how we're invoked.
const binDir = path.join(process.cwd(), "node_modules", ".bin");

try {
  console.log("[db-deploy] Synchronisation du schéma Prisma…");
  execSync("prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });
  console.log("[db-deploy] Tables à jour ✅");
} catch (err) {
  // Non bloquant : on log et on laisse le process continuer.
  console.warn(
    "[db-deploy] Synchronisation ignorée (base non joignable) :",
    err.message
  );
}

process.exit(0);

