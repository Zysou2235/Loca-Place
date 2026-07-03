import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Escale Box e2e tests.
 *
 * Lance le dev Next.js avec un .env.test, taps des PORT/DB locaux.
 * Les tests Stripe (souscription, paiement voyageur) sont décrits mais
 * skipped sans `STRIPE_SECRET_KEY` valide — voir e2e/billing.spec.ts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // séquentiel — DB partagée
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    },
  },
  webServer: {
    command: "set -a && . ./.env.test && set +a && npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
