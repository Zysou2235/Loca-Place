import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs } from "./helpers/session";

const prisma = new PrismaClient();
const ADMIN_EMAIL = "admin@test.escalebox.fr";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function makeBox(tag: string) {
  const host = await prisma.host.create({
    data: {
      email: `clients-${tag}-${Date.now()}@test.escalebox.fr`,
      name: `Hôte ${tag}`,
      subscriptionStatus: "active",
      boxQuota: 1,
    },
  });
  return prisma.box.create({
    data: {
      name: `Box ${tag}`,
      qrSlug: `clients-${tag}-${Date.now()}`,
      accessCode: "123",
      hostId: host.id,
    },
  });
}

test.describe("Fichier client", () => {
  test("Un visiteur laisse son email sur la page voyageur → Lead créé", async ({
    page,
  }) => {
    const box = await makeBox("optin");
    const visitorEmail = `voyageur-${Date.now()}@exemple.fr`;

    await page.goto(`/b/${box.qrSlug}`);
    await expect(page.getByText(/Votre avis nous intéresse/i)).toBeVisible();

    await page.getByPlaceholder("vous@exemple.fr").fill(visitorEmail);
    await page.getByRole("button", { name: /Envoyer/i }).click();
    await expect(page.getByText(/Merci ! Votre avis compte/i)).toBeVisible();

    const lead = await prisma.lead.findFirst({
      where: { email: visitorEmail },
    });
    expect(lead?.boxId).toBe(box.id);

    // Revisite avec le même email → pas de doublon, message OK quand même
    await page.goto(`/b/${box.qrSlug}`);
    await page.getByPlaceholder("vous@exemple.fr").fill(visitorEmail);
    await page.getByRole("button", { name: /Envoyer/i }).click();
    await expect(page.getByText(/Merci !/i)).toBeVisible();
    const count = await prisma.lead.count({ where: { email: visitorEmail } });
    expect(count).toBe(1);
  });

  test("Email invalide → message d'erreur", async ({ page }) => {
    const box = await makeBox("bademail");
    await page.goto(`/b/${box.qrSlug}`);
    // required + type=email bloquent côté navigateur ; on force via l'API DOM
    await page.getByPlaceholder("vous@exemple.fr").fill("pas-un-email@x");
    await page.getByRole("button", { name: /Envoyer/i }).click();
    await expect(page.getByText(/Adresse email invalide/i)).toBeVisible();
  });

  test("La page /admin/clients fusionne acheteurs et visiteurs", async ({
    page,
    context,
  }) => {
    await loginAs(context, prisma, { email: ADMIN_EMAIL, name: "Admin Test" });

    const box = await makeBox("merge");
    const buyerEmail = `buyer-${Date.now()}@exemple.fr`;
    const visitorEmail = `optin-${Date.now()}@exemple.fr`;

    await prisma.order.create({
      data: {
        stripeSessionId: `cs_test_${Date.now()}`,
        boxId: box.id,
        productName: "Bière artisanale",
        amountCents: 750,
        customerEmail: buyerEmail,
        paymentMethod: "apple_pay",
      },
    });
    await prisma.lead.create({ data: { email: visitorEmail, boxId: box.id } });

    await page.goto("/admin/clients");
    await expect(
      page.getByRole("heading", { name: /Fichier client/i })
    ).toBeVisible();

    // L'acheteur : badge Acheteur + montant
    const buyerRow = page.locator("tr", { hasText: buyerEmail });
    await expect(buyerRow.getByText("Acheteur")).toBeVisible();
    await expect(buyerRow.getByText(/7,50/)).toBeVisible();

    // Le visiteur : badge Visiteur
    const visitorRow = page.locator("tr", { hasText: visitorEmail });
    await expect(visitorRow.getByText("Visiteur")).toBeVisible();
  });

  test("Export CSV téléchargeable avec les contacts", async ({
    page,
    context,
  }) => {
    await loginAs(context, prisma, { email: ADMIN_EMAIL, name: "Admin Test" });

    const box = await makeBox("csv");
    const email = `csv-${Date.now()}@exemple.fr`;
    await prisma.lead.create({ data: { email, boxId: box.id } });

    const res = await page.request.get("/admin/clients/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Email");
    expect(body).toContain(email);
  });

  test("Empreinte visiteur : scans reliés à l'email, récurrence affichée", async ({
    page,
    context,
  }) => {
    const box = await makeBox("visitor");
    const email = `identite-${Date.now()}@exemple.fr`;

    // Deux visites du même navigateur → même empreinte, récurrence ×2
    await page.goto(`/b/${box.qrSlug}`);
    await page.goto(`/b/${box.qrSlug}`);

    const scans = await prisma.scan.findMany({ where: { boxId: box.id } });
    expect(scans.length).toBeGreaterThanOrEqual(2);
    expect(scans[0]!.visitorHash).toBeTruthy();
    expect(scans[0]!.visitorHash).toBe(scans[1]!.visitorHash);
    expect(scans[0]!.lang).toBeTruthy(); // Accept-Language capté

    // Opt-in → le Lead porte la même empreinte que les scans
    await page.getByPlaceholder("vous@exemple.fr").fill(email);
    await page.getByRole("button", { name: /Envoyer/i }).click();
    await expect(page.getByText(/Merci !/i)).toBeVisible();
    const lead = await prisma.lead.findFirst({ where: { email } });
    expect(lead?.visitorHash).toBe(scans[0]!.visitorHash);

    // Côté admin : identité résolue + badge de récurrence dans Données
    await loginAs(context, prisma, { email: ADMIN_EMAIL, name: "Admin Test" });
    await page.goto(`/admin/data?box=${box.id}`);
    await expect(page.getByText(email).first()).toBeVisible();
    await expect(page.getByText(/×\d+ visites/).first()).toBeVisible();
    await expect(page.getByText("Visiteurs uniques")).toBeVisible();
  });

  test("Le fichier client est refusé aux non-admins", async ({
    page,
    context,
  }) => {
    await loginAs(context, prisma, { name: "Pas Admin" }); // email non listé
    const res = await page.request.get("/admin/clients/export");
    // requireAdmin redirige vers /host → pas de CSV
    expect(res.headers()["content-type"] ?? "").not.toContain("text/csv");
  });
});
