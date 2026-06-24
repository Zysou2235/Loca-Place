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

// Réinitialisation volontaire de la base (vide tout puis recrée le schéma).
// À utiliser UNIQUEMENT quand une migration ne peut pas s'appliquer sur des
// données existantes (ex. ajout d'une colonne obligatoire). Activer en posant
// la variable DB_FORCE_RESET=true sur l'hébergeur, déployer, PUIS la retirer.
const forceReset = /^(1|true|yes)$/i.test(process.env.DB_FORCE_RESET ?? "");

const baseCmd = "prisma db push --skip-generate --accept-data-loss";
const cmd = forceReset ? `${baseCmd} --force-reset` : baseCmd;

try {
  if (forceReset) {
    console.warn(
      "[db-deploy] ⚠️ DB_FORCE_RESET activé — la base va être VIDÉE puis recréée."
    );
  }
  console.log("[db-deploy] Synchronisation du schéma Prisma…");
  execSync(cmd, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });
  console.log("[db-deploy] Tables à jour ✅");
  if (forceReset) {
    console.warn(
      "[db-deploy] ⚠️ Base réinitialisée. Pensez à RETIRER la variable DB_FORCE_RESET pour ne pas la vider au prochain déploiement."
    );
  }
} catch (err) {
  // Non bloquant : on log et on laisse le process continuer.
  console.warn(
    "[db-deploy] Synchronisation ignorée (base non joignable ou migration impossible) :",
    err.message
  );
}

process.exit(0);

