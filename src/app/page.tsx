import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Simple landing page. The traveler journey lives at /b/[qr_slug].
export default async function Home() {
  const boxes = await prisma.box
    .findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { qrSlug: true, name: true, location: true },
    })
    .catch(() => []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold">Staybox</h1>
        <p className="mt-2 text-neutral-600">
          La boîte transparente qui permet à vos hôtes de vous proposer des
          produits locaux. Scannez le QR code de votre logement pour commander.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Boîtes de démonstration
        </h2>
        {boxes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Aucune boîte en base. Lancez{" "}
            <code className="rounded bg-neutral-100 px-1">npm run db:seed</code>{" "}
            pour créer la boîte de démo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {boxes.map((box) => (
              <li key={box.qrSlug}>
                <Link
                  href={`/b/${box.qrSlug}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-400"
                >
                  <span>
                    <span className="font-medium">{box.name}</span>
                    {box.location && (
                      <span className="block text-sm text-neutral-500">
                        {box.location}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-blue-600">Ouvrir →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
