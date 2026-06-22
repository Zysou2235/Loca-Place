import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Eskale Box — La boutique autonome pour voyageurs",
};

// Adresse de contact à personnaliser.
const CONTACT_EMAIL = "contact@eskalebox.fr";

export default function Home() {
  return (
    <div className="bg-white text-brand">
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <HowItWorks />
        <Benefits />
        <UseCases />
        <Pricing />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- Header */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/eskale-box-logo.png"
            alt="Eskale Box"
            width={120}
            height={120}
            priority
            className="h-11 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-brand/70 md:flex">
          <a href="#fonctionnement" className="hover:text-brand">
            Fonctionnement
          </a>
          <a href="#avantages" className="hover:text-brand">
            Avantages
          </a>
          <a href="#tarifs" className="hover:text-brand">
            Tarifs
          </a>
          <a href="#faq" className="hover:text-brand">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/b/demo"
            className="hidden text-sm font-semibold text-brand hover:text-accent sm:inline"
          >
            Voir la démo
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
          >
            Devenir hôte
          </a>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand to-brand-dark text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-light ring-1 ring-white/15">
            La boutique autonome pour voyageurs
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight md:text-5xl">
            Transformez votre logement en{" "}
            <span className="text-accent-light">boutique autonome</span>.
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/80">
            Une box transparente avec QR code dans votre location. Vos voyageurs
            scannent, paient et se servent. Vous encaissez —{" "}
            <strong className="text-white">sans rien gérer</strong>.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark"
            >
              Installer ma Eskale Box
            </a>
            <Link
              href="/b/demo"
              className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Voir la démo →
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-6 text-sm text-white/70">
            <span className="flex items-center gap-2">
              <Check /> 0% de commission
            </span>
            <span className="flex items-center gap-2">
              <Check /> Paiement direct
            </span>
            <span className="flex items-center gap-2">
              <Check /> Installation 5 min
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="mx-auto flex max-w-sm flex-col items-center rounded-3xl bg-white/95 p-8 text-brand shadow-soft">
            <Image
              src="/eskale-box-logo.png"
              alt="Eskale Box"
              width={320}
              height={320}
              priority
              className="h-auto w-56"
            />
            <p className="mt-4 text-center text-sm font-medium text-brand/60">
              Scannez · Payez · Ouvrez · Profitez
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- TrustBar */

function TrustBar() {
  return (
    <section className="border-b border-black/5 bg-cream">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <p className="text-center text-sm font-medium text-brand/50">
          Conçu pour les hôtes Airbnb, Booking, gîtes et locations courte durée
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- HowItWorks */

function HowItWorks() {
  const steps = [
    {
      icon: <IconScan />,
      title: "Scannez",
      text: "Le voyageur scanne le QR code de la box avec son téléphone.",
    },
    {
      icon: <IconCard />,
      title: "Payez",
      text: "Il choisit ses produits et paie en quelques secondes, sans créer de compte.",
    },
    {
      icon: <IconUnlock />,
      title: "Ouvrez",
      text: "La box s'ouvre, il récupère son produit. Tout est transparent.",
    },
    {
      icon: <IconBag />,
      title: "Profitez",
      text: "Vous êtes payé instantanément, directement sur votre compte.",
    },
  ];

  return (
    <section id="fonctionnement" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Comment ça marche"
          title="Quatre étapes, zéro friction"
          subtitle="Une expérience d'achat fluide pour vos voyageurs, totalement automatisée pour vous."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-black/5 bg-cream p-6 shadow-card transition hover:-translate-y-1 hover:shadow-soft"
            >
              <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-brand/5">
                {i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                {step.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-brand/60">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Benefits */

function Benefits() {
  const items = [
    {
      icon: <IconCoins />,
      title: "Des revenus en plus",
      text: "Monétisez chaque séjour avec des produits que vos voyageurs veulent vraiment.",
    },
    {
      icon: <IconZero />,
      title: "0% de commission",
      text: "L'intégralité du paiement va directement sur votre compte. Aucun frais caché.",
    },
    {
      icon: <IconBolt />,
      title: "Paiement instantané",
      text: "Encaissement sécurisé via Stripe, viré directement à l'hôte.",
    },
    {
      icon: <IconAuto />,
      title: "100% autonome",
      text: "Pas de check-in produit, pas de gestion. La box travaille pendant que vous dormez.",
    },
    {
      icon: <IconWrench />,
      title: "Installation en 5 min",
      text: "Posez la box, collez le QR code, ajoutez vos produits. C'est tout.",
    },
    {
      icon: <IconChart />,
      title: "Suivi des ventes",
      text: "Visualisez ce qui se vend et réapprovisionnez au bon moment.",
    },
  ];

  return (
    <section id="avantages" className="bg-brand py-20 text-white md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          dark
          eyebrow="Pourquoi Eskale Box"
          title="Conçu pour les hôtes exigeants"
          subtitle="Tout ce qu'il faut pour vendre sans effort, et rien de superflu."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
                {item.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-white/70">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- UseCases */

function UseCases() {
  const cases = [
    {
      img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
      title: "Vins & spiritueux locaux",
      text: "Une bouteille de la région pour l'apéro du soir.",
    },
    {
      img: "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80",
      title: "Produits du terroir",
      text: "Fromages, charcuterie, spécialités à découvrir.",
    },
    {
      img: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
      title: "Kits petit-déjeuner",
      text: "Café, jus frais et viennoiseries au réveil.",
    },
    {
      img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80",
      title: "Essentiels & dépannage",
      text: "Chargeurs, dentifrice, ce qu'on oublie toujours.",
    },
  ];

  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Idées de produits"
          title="Vendez ce que vos voyageurs recherchent"
          subtitle="À vous de composer votre boutique selon votre logement et votre région."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((c) => (
            <div
              key={c.title}
              className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-card transition hover:shadow-soft"
            >
              <div className="relative h-40 w-full">
                <Image
                  src={c.img}
                  alt={c.title}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-display font-bold">{c.title}</h3>
                <p className="mt-1 text-sm text-brand/60">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Pricing */

function Pricing() {
  return (
    <section id="tarifs" className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Tarifs"
          title="Simple et transparent"
          subtitle="Vous gardez 100% de vos ventes. Sans engagement."
        />

        <div className="mx-auto mt-14 max-w-lg">
          <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-white p-8 shadow-soft">
            <span className="absolute right-6 top-6 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
              Offre de lancement
            </span>
            <h3 className="font-display text-xl font-bold">Hôte</h3>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-display text-5xl font-extrabold">0%</span>
              <span className="mb-1 text-brand/60">de commission</span>
            </div>
            <p className="mt-3 text-sm text-brand/60">
              Vous ne payez que les frais de paiement Stripe standards. Tout le
              reste est pour vous.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Page de vente avec QR code dédié",
                "Paiement sécurisé sans compte voyageur",
                "Versement direct sur votre compte",
                "Produits illimités",
                "Suivi des ventes",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 text-accent">
                    <Check />
                  </span>
                  <span className="text-brand/80">{f}</span>
                </li>
              ))}
            </ul>

            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-8 block rounded-full bg-accent px-6 py-3 text-center font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark"
            >
              Démarrer gratuitement
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Testimonials */

function Testimonials() {
  const quotes = [
    {
      quote:
        "Mes voyageurs adorent pouvoir s'offrir une bouteille de vin local à toute heure. Et moi, je génère un revenu sans rien faire.",
      name: "Marie L.",
      role: "Hôte à Lyon",
    },
    {
      quote:
        "Installation ultra simple. En une semaine, la box s'était déjà remboursée plusieurs fois.",
      name: "Thomas R.",
      role: "Gîte en Provence",
    },
    {
      quote:
        "Le paiement direct sans commission, c'est ce qui m'a convaincu. Transparent et rentable.",
      name: "Sophie M.",
      role: "Appartements à Bordeaux",
    },
  ];

  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Ils nous font confiance"
          title="Des hôtes déjà conquis"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col rounded-2xl border border-black/5 bg-cream p-6 shadow-card"
            >
              <div className="text-accent">{"★★★★★"}</div>
              <blockquote className="mt-4 flex-1 text-brand/80">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-5">
                <div className="font-display font-bold">{q.name}</div>
                <div className="text-sm text-brand/50">{q.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

function Faq() {
  const faqs = [
    {
      q: "Comment mes voyageurs paient-ils ?",
      a: "Ils scannent le QR code de la box, choisissent leurs produits et paient en invité via Stripe — aucun compte à créer.",
    },
    {
      q: "Quelle commission prenez-vous ?",
      a: "0%. L'intégralité du paiement est versée directement sur votre compte. Seuls les frais de transaction Stripe standards s'appliquent.",
    },
    {
      q: "Que puis-je vendre ?",
      a: "Tout ce qui fait sens pour votre logement : vins et produits locaux, kits petit-déjeuner, snacks, essentiels de dépannage, souvenirs…",
    },
    {
      q: "L'installation est-elle compliquée ?",
      a: "Non. Vous posez la box, collez le QR code fourni et ajoutez vos produits depuis votre espace. Comptez environ 5 minutes.",
    },
    {
      q: "Et si un produit n'est plus en stock ?",
      a: "Vous gérez votre catalogue : désactivez ou réapprovisionnez les produits quand vous le souhaitez.",
    },
  ];

  return (
    <section id="faq" className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHeading eyebrow="FAQ" title="Vous avez des questions" />

        <div className="mt-12 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-black/5 bg-white p-5 shadow-card [&_summary]:list-none"
            >
              <summary className="flex cursor-pointer items-center justify-between font-display font-semibold">
                {f.q}
                <span className="ml-4 text-accent transition group-open:rotate-45">
                  <Plus />
                </span>
              </summary>
              <p className="mt-3 text-sm text-brand/70">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- FinalCta */

function FinalCta() {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark px-8 py-14 text-center text-white shadow-soft md:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <h2 className="relative font-display text-3xl font-extrabold md:text-4xl">
            Prêt à rentabiliser chaque séjour ?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/80">
            Rejoignez les hôtes qui transforment leur logement en boutique
            autonome avec Eskale Box.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-full bg-accent px-7 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark"
            >
              Installer ma Eskale Box
            </a>
            <Link
              href="/b/demo"
              className="rounded-full bg-white/10 px-7 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Voir la démo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Footer */

function Footer() {
  return (
    <footer className="bg-brand-dark text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <span className="font-display text-2xl font-extrabold text-white">
            éskale <span className="text-accent">box</span>
          </span>
          <p className="mt-4 max-w-xs text-sm">
            La boutique autonome pour voyageurs.
          </p>
        </div>

        <FooterCol
          title="Produit"
          links={[
            { label: "Fonctionnement", href: "#fonctionnement" },
            { label: "Avantages", href: "#avantages" },
            { label: "Tarifs", href: "#tarifs" },
            { label: "Démo", href: "/b/demo" },
          ]}
        />
        <FooterCol
          title="Entreprise"
          links={[
            { label: "FAQ", href: "#faq" },
            { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
          ]}
        />
        <FooterCol
          title="Légal"
          links={[
            { label: "Mentions légales", href: "#" },
            { label: "Confidentialité", href: "#" },
            { label: "CGV", href: "#" },
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-6 text-center text-sm text-white/50">
          © {new Date().getFullYear()} Eskale Box. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="font-display text-sm font-bold uppercase tracking-wide text-white">
        {title}
      </h4>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="transition hover:text-accent">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- Helpers */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  dark,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-sm font-bold uppercase tracking-wide text-accent">
        {eyebrow}
      </span>
      <h2
        className={`mt-3 font-display text-3xl font-extrabold md:text-4xl ${
          dark ? "text-white" : "text-brand"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 ${dark ? "text-white/70" : "text-brand/60"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Icons */

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconUnlock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 017.9-1" strokeLinecap="round" />
    </svg>
  );
}

function IconBag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M6 7h12l1 13H5L6 7z" strokeLinejoin="round" /><path d="M9 7a3 3 0 016 0" strokeLinecap="round" />
    </svg>
  );
}

function IconCoins() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3" strokeLinecap="round" /><ellipse cx="15" cy="14" rx="6" ry="3" /><path d="M21 14v3c0 1.7-2.7 3-6 3" strokeLinecap="round" />
    </svg>
  );
}

function IconZero() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" /><path d="M5 5l14 14" strokeLinecap="round" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function IconAuto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3a9 9 0 109 9" strokeLinecap="round" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M14.5 6a3.5 3.5 0 00-4.7 4.3L4 16.1V20h3.9l5.8-5.8A3.5 3.5 0 0018 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" strokeLinecap="round" />
    </svg>
  );
}
