import Image from "next/image";
import Link from "next/link";
import type { Guide } from "./guides-data";
import { GUIDES } from "./guides-data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.escalebox.fr";

/**
 * Habillage commun des guides : header, hero, JSON-LD Article + fil
 * d'Ariane, CTA final et liens vers les autres guides (maillage interne).
 */
export function GuideShell({
  guide,
  children,
}: {
  guide: Guide;
  children: React.ReactNode;
}) {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.h1,
    description: guide.description,
    datePublished: guide.datePublished,
    author: { "@type": "Organization", name: "Escale Box" },
    publisher: {
      "@type": "Organization",
      name: "Escale Box",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/escale-box-logo.png` },
    },
    mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: guide.h1 },
    ],
  };

  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div className="bg-white text-brand">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

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
      <section className="bg-gradient-to-b from-brand to-brand-dark px-5 py-14 text-center text-white md:py-16">
        <nav className="text-sm text-white/60">
          <Link href="/" className="hover:text-white">
            Accueil
          </Link>
          {" › "}
          <Link href="/guides" className="hover:text-white">
            Guides
          </Link>
        </nav>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-extrabold leading-tight md:text-4xl">
          {guide.h1}
        </h1>
      </section>

      {/* Contenu */}
      <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <div className="space-y-10">{children}</div>

        {/* CTA */}
        <div className="mt-14 rounded-3xl bg-gradient-to-b from-brand to-brand-dark p-8 text-center text-white">
          <h2 className="font-display text-2xl font-extrabold">
            Prêt à générer des revenus sur chaque séjour&nbsp;?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-white/80">
            Escale Box transforme votre logement en boutique autonome&nbsp;:
            vos voyageurs scannent, paient, se servent. 0% de commission.
          </p>
          <Link
            href="/#tarifs"
            className="mt-6 inline-block rounded-full bg-accent px-7 py-3 font-semibold text-white transition hover:bg-accent-dark"
          >
            Découvrir les formules
          </Link>
        </div>

        {/* Autres guides — maillage interne */}
        <div className="mt-14">
          <h2 className="font-display text-xl font-extrabold text-brand">
            À lire aussi
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {others.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="rounded-2xl border border-black/5 bg-cream p-5 shadow-card transition hover:-translate-y-0.5"
              >
                <span className="font-display font-bold text-brand">
                  {g.h1}
                </span>
                <p className="mt-2 text-sm text-brand/60">{g.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </article>

      {/* Footer minimal */}
      <footer className="border-t border-black/5 bg-cream">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-brand/50">
          <span>© {new Date().getFullYear()} Escale Box</span>
          <nav className="flex gap-5">
            <Link href="/" className="hover:text-brand">
              Accueil
            </Link>
            <Link href="/guides" className="hover:text-brand">
              Guides
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

/* Blocs de mise en forme des articles */

export function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-extrabold text-brand">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-brand/75">
        {children}
      </div>
    </section>
  );
}

export function GuideTip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border-l-4 border-accent bg-cream px-5 py-4 text-brand/80">
      💡 {children}
    </p>
  );
}
