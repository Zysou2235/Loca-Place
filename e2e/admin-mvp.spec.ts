import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs } from "./helpers/session";

const prisma = new PrismaClient();

// L'admin de test — doit matcher ADMIN_EMAILS du .env.test.
const ADMIN_EMAIL = "admin@test.escalebox.fr";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function loginAsAdmin(
  context: import("@playwright/test").BrowserContext
) {
  return loginAs(context, prisma, {
    email: ADMIN_EMAIL,
    name: "Admin Test",
    emailVerified: true,
  });
}

test.describe("Admin — Tests MVP (box offertes)", () => {
  test("La page /admin/test s'affiche avec le formulaire", async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context);
    await page.goto("/admin/test");
    await expect(
      page.getByRole("heading", { name: /Tests MVP/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder("testeur@exemple.fr")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Activer l'accès test/i })
    ).toBeVisible();
  });

  test("Offrir 4 box à un email → compte créé + box provisionnées", async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context);
    const testerEmail = `testeur-${Date.now()}@test.escalebox.fr`;

    await page.goto("/admin/test");
    await page.getByPlaceholder("testeur@exemple.fr").fill(testerEmail);
    await page.getByPlaceholder("Marie Dupont").fill("Testeur MVP");
    await page.getByPlaceholder("Contexte du test").fill("test e2e");
    await page.getByRole("button", { name: /Activer l'accès test/i }).click();

    await page.waitForURL(/\/admin\/test\?ok=1/);
    await expect(page.getByText(/Accès test créé/i)).toBeVisible();

    // Le testeur apparaît dans la liste avec ses 4 box
    await expect(page.getByText(testerEmail)).toBeVisible();
    await expect(page.getByText("Box #1").first()).toBeVisible();
    await expect(page.getByText("Box #4").first()).toBeVisible();

    // Vérification DB : compte test actif, 4 box, plan "test", hors MRR
    const host = await prisma.host.findUnique({
      where: { email: testerEmail },
      include: { boxes: true },
    });
    expect(host?.isTestAccount).toBe(true);
    expect(host?.subscriptionStatus).toBe("active");
    expect(host?.subscriptionPlan).toBe("test");
    expect(host?.boxQuota).toBe(4);
    expect(host?.boxes).toHaveLength(4);
    // Chaque box a un QR slug et un code cadenas prêts pour l'expédition
    for (const b of host!.boxes) {
      expect(b.qrSlug).toBeTruthy();
      expect(b.accessCode).toMatch(/^\d{3}$/);
    }
  });

  test("Retirer l'accès test → box supprimées, quota 0", async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context);
    const testerEmail = `revoke-${Date.now()}@test.escalebox.fr`;

    // Grant
    await page.goto("/admin/test");
    await page.getByPlaceholder("testeur@exemple.fr").fill(testerEmail);
    await page.getByRole("button", { name: /Activer l'accès test/i }).click();
    await page.waitForURL(/ok=1/);

    // Revoke — cible le bouton dans la carte du testeur
    const card = page
      .locator("div.rounded-2xl")
      .filter({ hasText: testerEmail })
      .first();
    await card.getByRole("button", { name: /Retirer l'accès/i }).click();
    await page.waitForURL(/revoked=1/);

    const host = await prisma.host.findUnique({
      where: { email: testerEmail },
      include: { boxes: true },
    });
    expect(host?.isTestAccount).toBe(false);
    expect(host?.subscriptionStatus).toBe("none");
    expect(host?.boxQuota).toBe(0);
    // Contrairement à un vrai client qui résilie (box désactivées mais
    // conservées), un compte test est nettoyé pour de bon : aucune box
    // fantôme qui resterait bloquée si l'accès est redonné plus tard.
    expect(host?.boxes).toHaveLength(0);
  });

  test("Retirer puis redonner l'accès (même email) → box neuves et actives, la boutique fonctionne", async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context);
    const testerEmail = `recreate-${Date.now()}@test.escalebox.fr`;

    // 1) Octroi initial — 4 box.
    await page.goto("/admin/test");
    await page.getByPlaceholder("testeur@exemple.fr").fill(testerEmail);
    await page.getByRole("button", { name: /Activer l'accès test/i }).click();
    await page.waitForURL(/ok=1/);

    const firstHost = await prisma.host.findUniqueOrThrow({
      where: { email: testerEmail },
      include: { boxes: true },
    });
    const firstSlug = firstHost.boxes[0]!.qrSlug;

    // 2) Retrait de l'accès.
    const card = page
      .locator("div.rounded-2xl")
      .filter({ hasText: testerEmail })
      .first();
    await card.getByRole("button", { name: /Retirer l'accès/i }).click();
    await page.waitForURL(/revoked=1/);

    // L'ancien QR ne doit plus jamais fonctionner (box supprimée).
    const oldRes = await page.goto(`/b/${firstSlug}`);
    expect(oldRes?.status()).toBe(404);

    // 3) Nouvel octroi sur le même email — c'est ici que le bug se produisait :
    // les box restaient désactivées pour toujours (quota déjà "satisfait" en
    // compte total, sans jamais réactiver ni recréer).
    await page.goto("/admin/test");
    await page.getByPlaceholder("testeur@exemple.fr").fill(testerEmail);
    await page.getByRole("button", { name: /Activer l'accès test/i }).click();
    await page.waitForURL(/ok=1/);

    const secondHost = await prisma.host.findUniqueOrThrow({
      where: { email: testerEmail },
      include: { boxes: true },
    });
    expect(secondHost.isTestAccount).toBe(true);
    expect(secondHost.boxes).toHaveLength(4);
    expect(secondHost.boxes.every((b) => b.active)).toBe(true);

    // La nouvelle box fonctionne réellement côté voyageur (plus de 404).
    const newSlug = secondHost.boxes[0]!.qrSlug;
    const newRes = await page.goto(`/b/${newSlug}`);
    expect(newRes?.status()).toBe(200);
  });

  test("Refus d'écraser un vrai abonné payant", async ({ page, context }) => {
    await loginAsAdmin(context);
    const payingEmail = `paying-${Date.now()}@test.escalebox.fr`;
    await prisma.host.create({
      data: {
        email: payingEmail,
        name: "Vrai Client",
        subscriptionStatus: "active",
        subscriptionPlan: "duo",
        boxQuota: 2,
        stripeCustomerId: "cus_fake123",
      },
    });

    await page.goto("/admin/test");
    await page.getByPlaceholder("testeur@exemple.fr").fill(payingEmail);
    await page.getByRole("button", { name: /Activer l'accès test/i }).click();
    await page.waitForURL(/error=paying/);
    await expect(page.getByText(/vrai abonnement Stripe actif/i)).toBeVisible();
  });
});

test.describe("Admin — page Données", () => {
  test("Filtre par hôte et par box → périmètre restreint", async ({
    page,
    context,
  }) => {
    await loginAsAdmin(context);

    // Deux hôtes, chacun une box + un scan, pour vérifier l'isolation
    const mk = async (tag: string) => {
      const h = await prisma.host.create({
        data: {
          email: `filter-${tag}-${Date.now()}@test.escalebox.fr`,
          name: `Hôte ${tag}`,
          subscriptionStatus: "active",
          boxQuota: 1,
        },
      });
      const b = await prisma.box.create({
        data: {
          name: `Box ${tag}`,
          qrSlug: `filter-${tag}-${Date.now()}`,
          accessCode: "123",
          hostId: h.id,
        },
      });
      await prisma.scan.create({ data: { boxId: b.id } });
      return { h, b };
    };
    const a = await mk("Alpha");
    await mk("Beta");

    // Filtre par box Alpha → seule la box Alpha apparaît dans le tableau
    await page.goto(`/admin/data?host=${a.h.id}&box=${a.b.id}`);
    await expect(
      page.getByRole("heading", { name: /Box Alpha/ })
    ).toBeVisible();
    const table = page.locator("section", { hasText: "Activité par box" });
    await expect(table.getByRole("link", { name: "Box Alpha" })).toBeVisible();
    await expect(table.getByText("Box Beta")).toHaveCount(0);

    // Filtre par hôte seul
    await page.goto(`/admin/data?host=${a.h.id}`);
    await expect(page.getByText(/toutes ses box/)).toBeVisible();
    await expect(
      page.locator("section", { hasText: "Activité par box" }).getByText("Box Beta")
    ).toHaveCount(0);
  });

  test("KPIs, breakdowns et tables s'affichent", async ({ page, context }) => {
    await loginAsAdmin(context);
    await page.goto("/admin/data");

    // Visible par défaut : l'essentiel business + marketing, au-dessus du pli.
    await expect(page.getByRole("heading", { name: "Données" })).toBeVisible();
    await expect(page.getByText("Chiffre d'affaires").first()).toBeVisible();
    await expect(page.getByText("Conversion").first()).toBeVisible();
    await expect(
      page.getByText("Visiteurs uniques", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Emails captés")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Moyens de paiement" })
    ).toBeVisible();
    await expect(page.getByText("Activité par box")).toBeVisible();

    // Replié par défaut (progressive disclosure) : contenu secondaire/technique.
    await expect(page.getByRole("heading", { name: "Appareils" })).not.toBeVisible();
    await page.getByText(/Détails visiteurs/i).click();
    await expect(page.getByText("Temps moyen sur page")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Appareils" })).toBeVisible();
    await expect(
      page.getByText(/Scans par heure de la journée/i)
    ).toBeVisible();
  });
});

test.describe("Tracking — durée de visite (beacon)", () => {
  test("POST /api/track enregistre la durée d'un scan", async ({
    page,
    context,
    request,
  }) => {
    // Prépare une box active avec un scan
    const host = await prisma.host.create({
      data: {
        email: `track-${Date.now()}@test.escalebox.fr`,
        name: "Track Host",
        subscriptionStatus: "active",
        boxQuota: 1,
      },
    });
    const box = await prisma.box.create({
      data: {
        name: "Box Track",
        qrSlug: `track-${Date.now()}`,
        accessCode: "123",
        hostId: host.id,
      },
    });

    // Visite la page voyageur → crée un scan
    await page.goto(`/b/${box.qrSlug}`);
    const scan = await prisma.scan.findFirst({
      where: { boxId: box.id },
      orderBy: { createdAt: "desc" },
    });
    expect(scan).toBeTruthy();

    // Envoie le beacon manuellement (simule la fermeture de page)
    const res = await request.post("/api/track", {
      data: { scanId: scan!.id, ms: 12_345 },
    });
    expect(res.status()).toBe(200);

    const updated = await prisma.scan.findUnique({ where: { id: scan!.id } });
    expect(updated?.durationMs).toBe(12_345);

    // Un second beacon n'écrase pas la première mesure
    await request.post("/api/track", {
      data: { scanId: scan!.id, ms: 99_999 },
    });
    const after = await prisma.scan.findUnique({ where: { id: scan!.id } });
    expect(after?.durationMs).toBe(12_345);
  });

  test("POST /api/track rejette les payloads invalides", async ({ request }) => {
    const bad1 = await request.post("/api/track", {
      data: { scanId: "'; DROP TABLE--", ms: 1000 },
    });
    expect(bad1.status()).toBe(400);
    const bad2 = await request.post("/api/track", {
      data: { scanId: "cabc123def456ghi789jkl012", ms: "abc" },
    });
    expect(bad2.status()).toBe(400);
  });
});
