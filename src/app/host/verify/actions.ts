"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { verifyVerifyToken } from "@/lib/verify-token";

/** Active le compte (email vérifié) à partir du lien reçu, puis connecte. */
export async function confirmEmail(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const data = verifyVerifyToken(token);
  if (!data) redirect("/host/login?error=verify");

  const host = await prisma.host.update({
    where: { id: data.hostId },
    data: { emailVerified: true },
    select: { id: true, tokenVersion: true },
  });

  await setSession(host.id, host.tokenVersion);
  redirect("/host");
}
