import { test, expect } from "@playwright/test";

test.describe("Pages publiques", () => {
  test("Accueil — hero, pricing et CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Escale Box/i);

    // Hero
    await expect(page.locator("h1").first()).toContainText("chiffre d'affaires");

    // CTA principal présent
    await expect(
      page.getByRole("link", { name: /Équiper mes logements/i }).first()
    ).toBeVisible();

    // Section pricing visible — taglines cohérentes
    await expect(page.getByText("Pour un logement").first()).toBeVisible();
    await expect(page.getByText("Pour deux logements").first()).toBeVisible();
    await expect(
      page.getByText("Pour les multi-propriétaires").first()
    ).toBeVisible();

    // Features décrivent ce que l'hôte reçoit (box)
    await expect(page.getByText("1 box dédiée").first()).toBeVisible();
    await expect(page.getByText("2 box dédiées").first()).toBeVisible();
  });

  test("CGV", async ({ page }) => {
    await page.goto("/cgv");
    await expect(page.locator("h1")).toContainText(/Conditions/i);
    await expect(page.locator("body")).toContainText("box mise à disposition");
  });

  test("Confidentialité", async ({ page }) => {
    await page.goto("/confidentialite");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Mentions légales", async ({ page }) => {
    await page.goto("/mentions-legales");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("À propos — storytelling logement", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page.locator("h1")).toBeVisible();
    // Storytelling parle bien de "logement" (fondateurs racontent leur Airbnb)
    await expect(page.locator("body")).toContainText("logement");
  });

  test("Sitemap", async ({ page }) => {
    const res = await page.goto("/sitemap.xml");
    expect(res?.status()).toBe(200);
    const body = await page.content();
    expect(body).toContain("<urlset");
  });

  test("Robots.txt", async ({ page }) => {
    const res = await page.goto("/robots.txt");
    expect(res?.status()).toBe(200);
  });
});
