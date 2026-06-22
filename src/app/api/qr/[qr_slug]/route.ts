import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/**
 * GET /api/qr/[qr_slug] → PNG QR code pointing to the public box URL /b/[qr_slug].
 * This is what the host prints and sticks on the physical Staybox.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ qr_slug: string }> }
) {
  const { qr_slug } = await params;

  const box = await prisma.box.findUnique({
    where: { qrSlug: qr_slug },
    select: { id: true },
  });

  if (!box) {
    return new Response("Box not found", { status: 404 });
  }

  const targetUrl = `${BASE_URL}/b/${qr_slug}`;

  const png = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
