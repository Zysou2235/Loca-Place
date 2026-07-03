import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Le tracker client (LandingVisitTracker) déclenche ce même appel via
// useEffect au chargement de "/". On teste directement l'endpoint plutôt que
// de naviguer sur la page : en `next dev`, le CSP `script-src` sans
// `unsafe-eval` fait planter le runtime React Refresh et bloque toute
// hydratation (bug connu, dev-only — vérifié absent en build de prod).
test.describe("Landing page — alerte visite", () => {
  test("POST /api/landing-visit enregistre la visite", async ({ request }) => {
    const before = await prisma.landingVisit.count();

    const res = await request.post("/api/landing-visit", {
      data: { path: "/" },
    });
    expect(res.status()).toBe(200);

    const after = await prisma.landingVisit.count();
    expect(after).toBeGreaterThan(before);

    const visit = await prisma.landingVisit.findFirst({
      orderBy: { createdAt: "desc" },
    });
    expect(visit?.path).toBe("/");
    expect(visit?.userAgent).toBeTruthy();
    expect(visit?.visitorHash).toBeTruthy();
  });

  test("POST /api/landing-visit rejette un body invalide sans planter", async ({
    request,
  }) => {
    const res = await request.post("/api/landing-visit", {
      data: "not json",
      headers: { "Content-Type": "application/json" },
    });
    // Best-effort : même un body invalide répond 200 (path par défaut "/"),
    // tant que ça ne casse jamais l'appelant.
    expect(res.status()).toBe(200);
  });
});
