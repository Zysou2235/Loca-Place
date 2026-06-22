// Crée/MAJ automatiquement les tables au build SI une base est configurée.
// Évite à l'utilisateur de lancer `prisma db push` à la main.
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;

if (!url || url.startsWith("file:")) {
  console.log("[db-deploy] DATABASE_URL absente — étape ignorée.");
  process.exit(0);
}

try {
  console.log("[db-deploy] Synchronisation du schéma Prisma…");
  execSync("prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
  });
  console.log("[db-deploy] Tables à jour ✅");
} catch (err) {
  console.error("[db-deploy] Échec de la synchronisation :", err.message);
  process.exit(1);
}
