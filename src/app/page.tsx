import Image from "next/image";
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
      <header className="flex flex-col items-center text-center">
        <Image
          src="/eskale-box-logo.png"
          alt="Eskale Box"
          width={200}
          height={200}
          priority
          className="h-auto w-44"
        />
        <p className="mt-4 text-neutral-600">
          La boutique autonome pour voyageurs. Vos hôtes vous proposent des
          produits locaux : scannez le QR code de votre logement pour commander.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Boîtes de démonstration
        </h2>
        {boxes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Aucune Eskale Box en base. Lancez{" "}
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
                  <span className="text-sm font-medium text-accent">
                    Ouvrir →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
