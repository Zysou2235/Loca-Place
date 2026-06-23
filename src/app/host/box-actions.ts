"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionHostId, getCurrentHost } from "@/lib/auth";
import { makeSlug } from "@/lib/slug";
import { maxBoxesFor } from "@/lib/plans";

async function requireHostId(): Promise<string> {
  const hostId = await getSessionHostId();
  if (!hostId) throw new Error("Non authentifié.");
  return hostId;
}

/** Parse a euro string ("12,50" / "12.50") into integer cents. */
function eurosToCents(raw: string): number {
  const n = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("Prix invalide.");
  if (n > 100000) throw new Error("Prix trop élevé.");
  return Math.round(n * 100);
}

/** Trim and cap a string to a max length. */
function clean(raw: FormDataEntryValue | null, max: number): string {
  return String(raw ?? "")
    .trim()
    .slice(0, max);
}

/** Only allow https image URLs (kept null otherwise). */
function cleanPhotoUrl(raw: FormDataEntryValue | null): string | null {
  const value = clean(raw, 2048);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("L'URL de la photo doit commencer par https://");
    }
    return url.toString();
  } catch {
    throw new Error("URL de photo invalide (https requise).");
  }
}

/* --------------------------------------------------------------- Boxes */

export async function createBox(formData: FormData) {
  const host = await getCurrentHost();
  if (!host) throw new Error("Non authentifié.");

  // Enforce the subscription limit (and require an active subscription).
  const limit = maxBoxesFor(host.subscriptionPlan);
  const isActive =
    host.subscriptionStatus === "active" ||
    host.subscriptionStatus === "trialing";
  if (!isActive || limit === 0) {
    throw new Error("Un abonnement actif est requis pour créer une box.");
  }
  const count = await prisma.box.count({ where: { hostId: host.id } });
  if (count >= limit) {
    throw new Error(
      `Votre formule autorise ${limit} logement(s). Passez à une formule supérieure.`
    );
  }

  const name = clean(formData.get("name"), 120);
  const location = clean(formData.get("location"), 200) || null;
  if (!name) throw new Error("Le nom est requis.");

  await prisma.box.create({
    data: { name, location, qrSlug: makeSlug(name), hostId: host.id },
  });
  revalidatePath("/host");
}

export async function deleteBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  // Ownership enforced via hostId in the where clause.
  await prisma.box.deleteMany({ where: { id: boxId, hostId } });
  revalidatePath("/host");
}

/* ------------------------------------------------------------ Products */

async function assertBoxOwner(boxId: string, hostId: string) {
  const box = await prisma.box.findFirst({
    where: { id: boxId, hostId },
    select: { id: true },
  });
  if (!box) throw new Error("Box introuvable.");
}

export async function createProduct(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  await assertBoxOwner(boxId, hostId);

  const name = clean(formData.get("name"), 120);
  const description = clean(formData.get("description"), 500) || null;
  const photoUrl = cleanPhotoUrl(formData.get("photoUrl"));
  const priceCents = eurosToCents(String(formData.get("price") ?? ""));
  if (!name) throw new Error("Le nom du produit est requis.");

  await prisma.product.create({
    data: { name, description, photoUrl, priceCents, boxId },
  });
  revalidatePath(`/host/boxes/${boxId}`);
}

export async function updateProduct(formData: FormData) {
  const hostId = await requireHostId();
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, box: { hostId } },
    select: { id: true, boxId: true },
  });
  if (!product) throw new Error("Produit introuvable.");

  const name = clean(formData.get("name"), 120);
  const description = clean(formData.get("description"), 500) || null;
  const photoUrl = cleanPhotoUrl(formData.get("photoUrl"));
  const priceCents = eurosToCents(String(formData.get("price") ?? ""));
  if (!name) throw new Error("Le nom du produit est requis.");

  await prisma.product.update({
    where: { id: product.id },
    data: { name, description, photoUrl, priceCents },
  });
  revalidatePath(`/host/boxes/${product.boxId}`);
}

export async function toggleProduct(formData: FormData) {
  const hostId = await requireHostId();
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, box: { hostId } },
    select: { id: true, active: true, boxId: true },
  });
  if (!product) throw new Error("Produit introuvable.");

  await prisma.product.update({
    where: { id: product.id },
    data: { active: !product.active },
  });
  revalidatePath(`/host/boxes/${product.boxId}`);
}

export async function deleteProduct(formData: FormData) {
  const hostId = await requireHostId();
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, box: { hostId } },
    select: { id: true, boxId: true },
  });
  if (!product) throw new Error("Produit introuvable.");

  await prisma.product.delete({ where: { id: product.id } });
  revalidatePath(`/host/boxes/${product.boxId}`);
}
