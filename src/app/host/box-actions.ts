"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionHostId } from "@/lib/auth";
import { rateLimit, HOUR } from "@/lib/rate-limit";

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

// Max size for an imported (data URL) image, ~2 MB once base64-encoded.
const MAX_PHOTO_LEN = 2_800_000;

/**
 * Accept either an imported raster image (data:image/...;base64) or an https
 * URL. Returns null when empty. On refuse explicitement les SVG et autres
 * formats non-raster (un SVG peut embarquer du script — défense en profondeur).
 */
const ALLOWED_IMAGE_TYPES = /^data:image\/(png|jpe?g|webp|gif|avif);/i;

function cleanPhotoUrl(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("data:")) {
    if (!ALLOWED_IMAGE_TYPES.test(value)) {
      throw new Error(
        "Format d'image non supporté (PNG, JPEG, WebP, GIF ou AVIF uniquement)."
      );
    }
    if (value.length > MAX_PHOTO_LEN) {
      throw new Error("Image trop lourde (max ~2 Mo). Réessayez avec une photo plus légère.");
    }
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("L'URL de la photo doit commencer par https://");
    }
    return url.toString();
  } catch {
    throw new Error("Photo invalide (image importée ou URL https requise).");
  }
}

/* --------------------------------------------------------------- Boxes */
// Note : la création est gérée automatiquement à l'activation de l'abonnement
// (cf. lib/box-provisioning). La suppression a lieu uniquement à la résiliation
// (désactivation). L'hôte ne peut que renommer / attribuer un produit.

export async function renameBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  const name = clean(formData.get("name"), 120);
  const location = clean(formData.get("location"), 200) || null;
  if (!name) throw new Error("Le nom est requis.");

  await assertBoxOwner(boxId, hostId);
  await prisma.box.update({
    where: { id: boxId },
    data: { name, location },
  });
  revalidatePath(`/host/boxes/${boxId}`);
  revalidatePath("/host");
}

/**
 * Désactive une box : la page voyageur renvoie 404, mais l'enregistrement
 * (QR slug, code du cadenas, historique des ventes) est conservé en cache
 * pour pouvoir réactiver la box plus tard, éventuellement sur un autre
 * logement.
 */
export async function deactivateBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  await assertBoxOwner(boxId, hostId);
  await prisma.box.update({
    where: { id: boxId },
    data: { active: false, selectedProductId: null },
  });
  revalidatePath(`/host/boxes/${boxId}`);
  revalidatePath("/host");
}

/** Réactive une box précédemment désactivée. */
export async function reactivateBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  await assertBoxOwner(boxId, hostId);
  await prisma.box.update({
    where: { id: boxId },
    data: { active: true },
  });
  revalidatePath(`/host/boxes/${boxId}`);
  revalidatePath("/host");
}

/* --------------------------------------------------- Catalogue d'articles */
// Un article appartient à l'hôte (catalogue réutilisable). On en place UN seul
// dans chaque box via box.selectedProductId.

async function assertBoxOwner(boxId: string, hostId: string) {
  const box = await prisma.box.findFirst({
    where: { id: boxId, hostId },
    select: { id: true },
  });
  if (!box) throw new Error("Box introuvable.");
}

/** Crée un article dans le catalogue de l'hôte. Si boxId est fourni, l'article
 *  est aussitôt placé dans cette box. */
export async function createProduct(formData: FormData) {
  const hostId = await requireHostId();

  const name = clean(formData.get("name"), 120);
  const description = clean(formData.get("description"), 500) || null;
  const photoUrl = cleanPhotoUrl(formData.get("photoUrl"));
  const priceCents = eurosToCents(String(formData.get("price") ?? ""));
  if (!name) throw new Error("Le nom de l'article est requis.");

  const product = await prisma.product.create({
    data: { name, description, photoUrl, priceCents, hostId },
  });

  const boxId = String(formData.get("boxId") ?? "");
  if (boxId) {
    await assertBoxOwner(boxId, hostId);
    await prisma.box.update({
      where: { id: boxId },
      data: { selectedProductId: product.id },
    });
    revalidatePath(`/host/boxes/${boxId}`);
  }
  revalidatePath("/host/catalogue");
}

export async function updateProduct(formData: FormData) {
  const hostId = await requireHostId();
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, hostId },
    select: { id: true },
  });
  if (!product) throw new Error("Article introuvable.");

  const name = clean(formData.get("name"), 120);
  const description = clean(formData.get("description"), 500) || null;
  const photoUrl = cleanPhotoUrl(formData.get("photoUrl"));
  const priceCents = eurosToCents(String(formData.get("price") ?? ""));
  if (!name) throw new Error("Le nom de l'article est requis.");

  await prisma.product.update({
    where: { id: product.id },
    data: { name, description, photoUrl, priceCents },
  });
  revalidatePath("/host/catalogue");
  const boxId = String(formData.get("boxId") ?? "");
  if (boxId) revalidatePath(`/host/boxes/${boxId}`);
}

export async function deleteProduct(formData: FormData) {
  const hostId = await requireHostId();
  const productId = String(formData.get("productId") ?? "");
  const product = await prisma.product.findFirst({
    where: { id: productId, hostId },
    select: { id: true },
  });
  if (!product) throw new Error("Article introuvable.");

  // onDelete: SetNull détache automatiquement l'article des box.
  await prisma.product.delete({ where: { id: product.id } });
  revalidatePath("/host/catalogue");
}

/** Place (coche) un article du catalogue dans une box. */
export async function assignProductToBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await assertBoxOwner(boxId, hostId);

  const product = await prisma.product.findFirst({
    where: { id: productId, hostId },
    select: { id: true },
  });
  if (!product) throw new Error("Article introuvable.");

  await prisma.box.update({
    where: { id: boxId },
    data: { selectedProductId: product.id },
  });
  revalidatePath(`/host/boxes/${boxId}`);
}

/** Retire l'article de la box (la box n'a plus rien à vendre). */
export async function removeProductFromBox(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  await assertBoxOwner(boxId, hostId);

  await prisma.box.update({
    where: { id: boxId },
    data: { selectedProductId: null },
  });
  revalidatePath(`/host/boxes/${boxId}`);
}

/**
 * L'hôte change lui-même le code du cadenas de sa box. Le code saisi doit
 * correspondre à la combinaison physiquement réglée sur le cadenas (3 chiffres).
 * On exige une confirmation explicite que le cadenas a bien été réglé.
 */
export async function changeBoxCode(formData: FormData) {
  const hostId = await requireHostId();
  const boxId = String(formData.get("boxId") ?? "");
  await assertBoxOwner(boxId, hostId);

  if (!rateLimit(`changecode:${hostId}`, 10, HOUR)) {
    throw new Error("Trop de changements de code. Réessayez plus tard.");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{3}$/.test(code)) {
    throw new Error("Le code doit comporter exactement 3 chiffres (000–999).");
  }
  if (formData.get("confirmed") !== "on") {
    throw new Error("Confirmez d'abord avoir réglé le cadenas sur ce code.");
  }

  await prisma.box.update({
    where: { id: boxId },
    data: { accessCode: code },
  });
  revalidatePath(`/host/boxes/${boxId}`);
}
