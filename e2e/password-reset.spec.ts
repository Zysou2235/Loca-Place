import crypto from "crypto";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createResetToken } from "./helpers/reset-token";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Reproduit src/lib/auth.ts hashPassword — pour poser un mot de passe initial
// directement en DB (bypass du flux signup + vérification email).
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.escalebox.fr`;
}

test.describe("Mot de passe oublié", () => {
  test("Compte sans mot de passe (créé par l'admin) → définit un mot de passe → connecté", async ({
    page,
  }) => {
    const email = uniqueEmail("nopass");
    const host = await prisma.host.create({
      data: {
        email,
        name: "Sans Mdp",
        subscriptionStatus: "active",
        isTestAccount: true,
        boxQuota: 4,
        // Pas de passwordHash — reproduit exactement /admin/test.
      },
    });
    expect(host.passwordHash).toBeNull();

    // Étape 1 : demande de lien.
    await page.goto("/host/reset");
    await page.fill('input[name="email"]', email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(
      page.getByText(/lien pour choisir votre mot de passe/i)
    ).toBeVisible();

    // Étape 2 : suit le lien (le token est celui qu'un vrai email contiendrait).
    const token = createResetToken(host.id, host.tokenVersion);
    await page.goto(`/host/reset/confirm?token=${encodeURIComponent(token)}`);
    await page.fill('input[name="password"]', "motdepasseinitial123");
    await page.getByRole("button", { name: /définir le mot de passe/i }).click();

    // Auto-connexion après succès.
    await page.waitForURL(/\/host(\?|$|\/)/, { timeout: 10_000 });
    await expect(page.getByText(/Bonjour Sans/)).toBeVisible();

    const updated = await prisma.host.findUniqueOrThrow({ where: { id: host.id } });
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.emailVerified).toBe(true);
    expect(updated.tokenVersion).toBe(host.tokenVersion + 1);

    // Déconnexion puis reconnexion avec le mot de passe tout juste choisi.
    await page.getByText("Menu", { exact: true }).click();
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await page.waitForURL(/\/host\/login|\/$/, { timeout: 10_000 });
    await page.goto("/host/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepasseinitial123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/host(\?|$|\/)/, { timeout: 10_000 });
    await expect(page.getByText(/Bonjour Sans/)).toBeVisible();
  });

  test("Compte avec mot de passe existant → reset remplace l'ancien (l'ancien ne fonctionne plus)", async ({
    page,
  }) => {
    const email = uniqueEmail("haspass");
    const host = await prisma.host.create({
      data: {
        email,
        name: "Avec Mdp",
        passwordHash: hashPassword("ancienmotdepasse123"),
        emailVerified: true,
        subscriptionStatus: "active",
        boxQuota: 1,
      },
    });

    await page.goto("/host/reset");
    await page.fill('input[name="email"]', email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(
      page.getByText(/lien pour choisir votre mot de passe/i)
    ).toBeVisible();

    const token = createResetToken(host.id, host.tokenVersion);
    await page.goto(`/host/reset/confirm?token=${encodeURIComponent(token)}`);
    await page.fill('input[name="password"]', "nouveaumotdepasse456");
    await page.getByRole("button", { name: /définir le mot de passe/i }).click();
    await page.waitForURL(/\/host(\?|$|\/)/, { timeout: 10_000 });

    await page.getByText("Menu", { exact: true }).click();
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await page.waitForURL(/\/host\/login|\/$/, { timeout: 10_000 });

    // L'ancien mot de passe ne doit plus fonctionner.
    await page.goto("/host/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "ancienmotdepasse123");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Identifiants incorrects/i)).toBeVisible();

    // Le nouveau, si.
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "nouveaumotdepasse456");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/host(\?|$|\/)/, { timeout: 10_000 });
    await expect(page.getByText(/Bonjour Avec/)).toBeVisible();
  });

  test("Lien de reset invalide → message d'erreur clair", async ({ page }) => {
    await page.goto("/host/reset/confirm?token=ceci-nest-pas-un-token-valide");
    await page.fill('input[name="password"]', "peuimportelemotdepasse");
    await page.getByRole("button", { name: /définir le mot de passe/i }).click();
    await expect(page.getByText(/lien invalide ou expiré/i)).toBeVisible();
  });

  test("Email inconnu → même message générique (anti-énumération)", async ({
    page,
  }) => {
    await page.goto("/host/reset");
    await page.fill('input[name="email"]', uniqueEmail("inconnu"));
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(
      page.getByText(/lien pour choisir votre mot de passe/i)
    ).toBeVisible();
  });
});
