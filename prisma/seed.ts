import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed = "boîte créée à la main en base" (pas encore de formulaire hôte).
async function main() {
  const host = await prisma.host.upsert({
    where: { email: "marie@example.com" },
    update: { name: "Marie (hôte démo)" },
    create: {
      name: "Marie (hôte démo)",
      email: "marie@example.com",
      // Replace with a real Stripe Connect Express account id (acct_...) to enable
      // routing the payment to the host. If null, Checkout falls back to the
      // platform account so the flow stays testable end-to-end.
      stripeAccountId: process.env.DEMO_HOST_STRIPE_ACCOUNT ?? null,
    },
  });

  const box = await prisma.box.upsert({
    where: { qrSlug: "demo" },
    update: {
      name: "Eskale Box — Appartement Bellecour",
      location: "Appartement Bellecour, Lyon",
    },
    create: {
      qrSlug: "demo",
      name: "Eskale Box — Appartement Bellecour",
      location: "Appartement Bellecour, Lyon",
      hostId: host.id,
    },
  });

  // Reset products for an idempotent seed.
  await prisma.product.deleteMany({ where: { boxId: box.id } });

  await prisma.product.createMany({
    data: [
      {
        boxId: box.id,
        name: "Bouteille de vin rouge — Côtes du Rhône",
        description: "Bouteille locale 75cl, parfaite pour l'apéro.",
        priceCents: 1200,
        photoUrl:
          "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
      },
      {
        boxId: box.id,
        name: "Plateau de fromages",
        description: "Sélection de 3 fromages affinés de la région.",
        priceCents: 1500,
        photoUrl:
          "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80",
      },
      {
        boxId: box.id,
        name: "Kit petit-déjeuner",
        description: "Café, jus d'orange frais et viennoiseries.",
        priceCents: 900,
        photoUrl:
          "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
      },
    ],
  });

  console.log("✅ Seed terminé.");
  console.log(`   Hôte : ${host.name} (${host.email})`);
  console.log(`   Boîte : /b/${box.qrSlug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
