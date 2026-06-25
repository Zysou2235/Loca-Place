import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Local password hashing (mirrors src/lib/auth.ts) for the demo host.
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Seed = un hôte de démo + une box d'exemple.
// Le modèle : on fournit la box (vide), l'hôte gère ses propres produits.
async function main() {
  const host = await prisma.host.upsert({
    where: { email: "marie@example.com" },
    update: {
      name: "Marie Démo",
      subscriptionStatus: "active",
      subscriptionPlan: "pro",
    },
    create: {
      name: "Marie Démo",
      email: "marie@example.com",
      passwordHash: hashPassword("password123"),
      subscriptionStatus: "active",
      subscriptionPlan: "pro",
      stripeAccountId: process.env.DEMO_HOST_STRIPE_ACCOUNT ?? null,
    },
  });

  const box = await prisma.box.upsert({
    where: { qrSlug: "demo" },
    update: {
      name: "Escale Box — Appartement Bellecour",
      location: "Appartement Bellecour, Lyon",
    },
    create: {
      qrSlug: "demo",
      name: "Escale Box — Appartement Bellecour",
      location: "Appartement Bellecour, Lyon",
      hostId: host.id,
      accessCode: "482",
    },
  });

  // Catalogue d'articles de l'hôte (réutilisables). On en place UN dans la box.
  await prisma.product.deleteMany({ where: { hostId: host.id } });
  const vin = await prisma.product.create({
    data: {
      hostId: host.id,
      name: "Bouteille de vin rouge — Côtes du Rhône",
      description: "Bouteille locale 75cl, parfaite pour l'apéro.",
      priceCents: 1200,
      photoUrl:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
    },
  });
  await prisma.product.create({
    data: {
      hostId: host.id,
      name: "Plateau de fromages",
      description: "Sélection de 3 fromages affinés de la région.",
      priceCents: 1500,
      photoUrl:
        "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80",
    },
  });
  await prisma.product.create({
    data: {
      hostId: host.id,
      name: "Kit petit-déjeuner",
      description: "Café, jus d'orange frais et viennoiseries.",
      priceCents: 900,
      photoUrl:
        "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
    },
  });

  // Article placé dans la box démo.
  await prisma.box.update({
    where: { id: box.id },
    data: { selectedProductId: vin.id },
  });

  console.log("✅ Seed terminé.");
  console.log(`   Hôte démo : ${host.email} / password123`);
  console.log(`   Box : /b/${box.qrSlug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
