import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

/** Public base URL: env var if set, otherwise derived from the request host. */
function baseUrlFrom(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/**
 * GET /api/qr/[qr_slug] → PNG QR code pointing to the public box URL /b/[qr_slug].
 * This is what gets printed and stuck on the physical Eskale Box.
 */
export async function GET(
  req: NextRequest,
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

  const targetUrl = `${baseUrlFrom(req)}/b/${qr_slug}`;

  const png = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H", // higher error correction → robust once printed
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
