"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

/** Set (or update) the lock code of a box. Admin only. */
export async function setBoxCode(formData: FormData) {
  await requireAdmin();

  const boxId = String(formData.get("boxId") ?? "");
  const code = String(formData.get("code") ?? "")
    .trim()
    .slice(0, 32);
  if (!boxId) throw new Error("Box manquante.");
  if (!code) throw new Error("Le code ne peut pas être vide.");

  await prisma.box.update({
    where: { id: boxId },
    data: { accessCode: code },
  });
  revalidatePath("/admin");
}
