import Image from "next/image";
import Link from "next/link";
import { GUIDES } from "./guides-data";

export const metadata = {
  title: "Guides pour hôtes Airbnb & gîtes — Escale Box",
  description:
    "Conseils pratiques pour hôtes de locations saisonnières : revenus complémentaires, minibar, accueil voyageurs. Guides gratuits par Escale Box.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Guides pour hôtes Airbnb & gîtes — Escale Box",
    description:
      "Conseils pratiques pour hôtes de locations saisonnières : revenus complémentaires, minibar, accueil voyageurs.",
    url: "/guides",
  },
};

export default function GuidesIndexPage() {
  return (
    <div className="bg-white text-brand">
      {/* Header */}
      <header className="border-b border-black/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/escale-box-logo.png"
              alt="Escale Box"
              width={120}
              height={120}
              className="h-10 w-auto"
            />
          </Link>
          <Link
            href="/host/signup"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
          >
            Devenir hôte
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand to-brand-dark px-5 py-16 text-center text-white">
        <span className="text-sm font-bold uppercase tracking-wide text-accent-light">
          Guides & conseils
        </span>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-extrabold md:text-4xl">
          Mieux accueillir, mieux rentabiliser
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          Des guides pratiques et gratuits pour les hôtes Airbnb, propriétaires
          de gîtes et conciergeries.
        </p>
      </section>

      {/* Liste */}
      <section className="mx-auto max-w-3xl px-5 py-14">
        <div className="space-y-5">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="block rounded-3xl border border-black/5 bg-cream p-7 shadow-card transition hover:-translate-y-0.5"
            >
              <h2 className="font-display text-xl font-extrabold text-brand">
                {g.h1}
              </h2>
              <p className="mt-2 text-brand/65">{g.excerpt}</p>
              <span className="mt-4 inline-block font-semibold text-accent">
                Lire le guide →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="border-t border-black/5 bg-cream">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-brand/50">
          <span>© {new Date().getFullYear()} Escale Box</span>
          <nav className="flex gap-5">
            <Link href="/" className="hover:text-brand">
              Accueil
            </Link>
            <Link href="/a-propos" className="hover:text-brand">
              À propos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
