import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Tests d'authentification : signup, login, logout, reset.
 *
 * Le flux signup réel envoie un email d'activation puis montre un message
 * "vérifiez vos emails". Côté test, on signup puis on flippe emailVerified
 * directement en DB pour simuler le clic sur le lien d'activation.
 */

function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.escalebox.fr`;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Auth", () => {
  test("Signup → message d'activation affiché", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/host/signup");
    await expect(page.locator("h1")).toBeVisible();

    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');

    // Message "Vérifiez votre boîte mail" doit s'afficher
    await expect(
      page.getByText(/Vérifiez votre boîte mail/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Login avec mauvais mot de passe → erreur affichée", async ({ page }) => {
    await page.goto("/host/login");
    await page.fill('input[name="email"]', "inexistant@test.escalebox.fr");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/host\/login/);
    await expect(page.getByText(/Identifiants incorrects/i)).toBeVisible();
  });

  test("Login sans vérif email → message d'erreur clair", async ({ page }) => {
    const email = uniqueEmail("nonverif");
    await page.goto("/host/signup");
    await page.fill('input[name="name"]', "Non Verif");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    await page.goto("/host/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');

    await expect(page.getByText(/pas encore activé/i)).toBeVisible();
  });

  test("Login après email vérifié → dashboard", async ({ page }) => {
    const email = uniqueEmail("verif");
    // signup
    await page.goto("/host/signup");
    await page.fill('input[name="name"]', "Verif User");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    // simule le clic sur le lien d'activation
    await prisma.host.update({ where: { email }, data: { emailVerified: true } });

    // login
    await page.goto("/host/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "motdepassesolide123");
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/host(\?|$|\/)/, { timeout: 10_000 });
    await expect(page.getByText(/Bonjour Verif/)).toBeVisible();
  });
});
