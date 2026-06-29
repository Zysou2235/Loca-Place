import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Page voyageur /b/[qrSlug]", () => {
  test("Box inexistante → 404", async ({ page }) => {
    const res = await page.goto("/b/inexistant");
    expect(res?.status()).toBe(404);
  });

  test("Box sans produit → 'bientôt disponible'", async ({ page }) => {
    // Crée un hôte + une box minimaliste en DB
    const host = await prisma.host.create({
      data: {
        name: "Hôte vide",
        email: `vide-${Date.now()}@test.escalebox.fr`,
        subscriptionStatus: "active",
        boxQuota: 1,
      },
    });
    const box = await prisma.box.create({
      data: {
        name: "Box vide",
        qrSlug: `vide-${Date.now()}`,
        accessCode: "123",
        hostId: host.id,
      },
    });

    await page.goto(`/b/${box.qrSlug}`);
    await expect(page.getByText(/bientôt disponible/i)).toBeVisible();
  });

  test("Box désactivée → 404", async ({ page }) => {
    const host = await prisma.host.create({
      data: {
        name: "Hôte off",
        email: `off-${Date.now()}@test.escalebox.fr`,
        subscriptionStatus: "active",
        boxQuota: 1,
      },
    });
    const box = await prisma.box.create({
      data: {
        name: "Box off",
        qrSlug: `off-${Date.now()}`,
        accessCode: "123",
        active: false,
        hostId: host.id,
      },
    });

    const res = await page.goto(`/b/${box.qrSlug}`);
    expect(res?.status()).toBe(404);
  });

  test("Box avec produit mais hôte sans Connect → 'bientôt disponible' (vente bloquée)", async ({
    page,
  }) => {
    const host = await prisma.host.create({
      data: {
        name: "Hôte sans Connect",
        email: `noconnect-${Date.now()}@test.escalebox.fr`,
        subscriptionStatus: "active",
        boxQuota: 1,
        // pas de stripeAccountId → vente impossible
      },
    });
    const product = await prisma.product.create({
      data: {
        name: "Bière artisanale",
        priceCents: 500,
        hostId: host.id,
      },
    });
    const box = await prisma.box.create({
      data: {
        name: "Studio test",
        qrSlug: `noc-${Date.now()}`,
        accessCode: "123",
        hostId: host.id,
        selectedProductId: product.id,
      },
    });

    await page.goto(`/b/${box.qrSlug}`);
    // L'hôte n'a pas chargesEnabled → faille argent corrigée → fallback
    await expect(page.getByText(/bientôt disponible/i)).toBeVisible();
  });

  test("Page démo /b/demo (si seedée)", async ({ page }) => {
    // best-effort : si la box de démo n'existe pas, on saute
    const res = await page.goto("/b/demo");
    if (res?.status() === 404) {
      test.skip();
    }
    await expect(page.locator("body")).toBeVisible();
  });
});
