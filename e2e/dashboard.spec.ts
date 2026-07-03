import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs } from "./helpers/session";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Dashboard hôte (sans abonnement)", () => {
  test("Dashboard montre les cartes Abonnement et Paiements", async ({
    page,
    context,
  }) => {
    await loginAs(context, prisma, { name: "Nicolas Test" });
    await page.goto("/host");

    await expect(
      page.getByRole("heading", { name: /Bonjour Nicolas/i })
    ).toBeVisible();
    await expect(page.getByText("Aucun abonnement actif")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Choisir une formule/i })
    ).toBeVisible();
    await expect(page.getByText("À configurer")).toBeVisible();
  });

  test("Aucune box visible sans abonnement", async ({ page, context }) => {
    await loginAs(context, prisma, { name: "No Sub" });
    await page.goto("/host");
    await expect(
      page.getByText(/Activez un abonnement pour recevoir vos box/i)
    ).toBeVisible();
  });

  test("Page billing affiche les 3 formules", async ({ page, context }) => {
    await loginAs(context, prisma, { name: "Billing Test" });
    await page.goto("/host/billing");
    await expect(page.getByText("Essentiel").first()).toBeVisible();
    await expect(page.getByText("Duo").first()).toBeVisible();
    await expect(page.getByText("Multi").first()).toBeVisible();
    await expect(page.getByLabel(/moins/i)).toBeVisible();
    await expect(page.getByLabel(/plus/i)).toBeVisible();

    // Cohérence des taglines : "logement" en cible, "box" en feature
    await expect(page.getByText("Pour un logement").first()).toBeVisible();
    await expect(page.getByText("1 box dédiée").first()).toBeVisible();
  });

  test("Bouton retour ← Tableau de bord visible sur les sous-pages", async ({
    page,
    context,
  }) => {
    await loginAs(context, prisma, { name: "Back Test" });
    await page.goto("/host/billing");
    await expect(
      page.getByRole("link", { name: /Tableau de bord/i }).first()
    ).toBeVisible();
  });

  test("Profil — formulaire visible", async ({ page, context }) => {
    await loginAs(context, prisma, { name: "Profil Test" });
    await page.goto("/host/profil");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Catalogue vide", async ({ page, context }) => {
    await loginAs(context, prisma, { name: "Catalogue Test" });
    await page.goto("/host/catalogue");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Dashboard hôte (abonné)", () => {
  test("Compteur 1/1 box et badge Disponible", async ({ page, context }) => {
    await loginAs(context, prisma, {
      name: "Subscribed",
      subscriptionStatus: "active",
      subscriptionPlan: "essentiel",
      boxQuota: 1,
    });
    await page.goto("/host");

    await expect(page.getByText(/1 ?\/ ?1 box utilisée/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Box #1")).toBeVisible();
    await expect(page.getByText("Disponible").first()).toBeVisible();
  });

  test("Plan Multi 4 → 4 box provisionnées", async ({ page, context }) => {
    await loginAs(context, prisma, {
      name: "Multi",
      subscriptionStatus: "active",
      subscriptionPlan: "multi",
      boxQuota: 4,
    });
    await page.goto("/host");
    await expect(page.getByText("Box #1")).toBeVisible();
    await expect(page.getByText("Box #4")).toBeVisible();
  });
});
