import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Eskale Box — Générez du CA additionnel dans vos locations",
  description:
    "La boutique autonome qui transforme vos gîtes et locations en source de revenus. Abonnez-vous, installez en 5 minutes, encaissez sur chaque séjour. 0% de commission sur vos ventes.",
};

// Adresse de contact à personnaliser.
const CONTACT_EMAIL = "contact@eskalebox.fr";

export default function Home() {
  return (
    <div className="bg-white text-brand">
      <Header />
      <main>
        <Hero />
        <Stats />
        <Audience />
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
            href="/host/login"
            className="hidden text-sm font-semibold text-brand hover:text-accent sm:inline"
          >
            Connexion
          </Link>
          <Link
            href="/host/signup"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark"
          >
            Équiper mes logements
          </Link>
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
            La solution revenus des hôtes & loueurs
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight md:text-5xl">
            Un{" "}
            <span className="text-accent-light">chiffre d&apos;affaires en plus</span>{" "}
            dans chacune de vos locations.
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/80">
            Eskale Box équipe vos gîtes et logements d&apos;une boutique
            autonome. Vos voyageurs achètent en autonomie, vous encaissez sur
            chaque séjour —{" "}
            <strong className="text-white">sans rien gérer au quotidien</strong>.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/host/signup"
              className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark"
            >
              Équiper mes logements
            </Link>
            <Link
              href="/b/demo"
              className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Voir la démo voyageur →
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
            <span className="flex items-center gap-2">
              <Check /> 0% de commission sur vos ventes
            </span>
            <span className="flex items-center gap-2">
              <Check /> Installation en 5 min
            </span>
            <span className="flex items-center gap-2">
              <Check /> Sans engagement
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

/* ----------------------------------------------------------------- Stats */

function Stats() {
  const stats = [
    { value: "jusqu'à 150€", label: "de CA additionnel / mois / logement" },
    { value: "1 voyageur sur 3", label: "achète pendant son séjour" },
    { value: "14€", label: "de panier moyen" },
    { value: "5 min", label: "pour installer la box" },
  ];

  return (
    <section className="border-b border-black/5 bg-cream">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-12 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-2xl font-extrabold text-brand md:text-3xl">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-brand/60">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Audience */

function Audience() {
  const targets = [
    { icon: <IconHome />, label: "Gîtes & meublés" },
    { icon: <IconKey />, label: "Locations Airbnb / Booking" },
    { icon: <IconBed />, label: "Chambres d'hôtes" },
    { icon: <IconBuilding />, label: "Conciergeries & hôtels" },
  ];

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Pour qui ?"
          title="Pensé pour les professionnels de l'hébergement"
          subtitle="Que vous gériez un seul gîte ou une flotte de logements, Eskale Box s'intègre à votre activité."
        />

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {targets.map((t) => (
            <div
              key={t.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-cream p-6 text-center shadow-card"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/5 text-brand">
                {t.icon}
              </div>
              <span className="text-sm font-semibold text-brand/80">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- HowItWorks */

function HowItWorks() {
  const hostSteps = [
    {
      icon: <IconWrench />,
      title: "Abonnez-vous & installez",
      text: "Choisissez votre formule, recevez votre box et son QR code. Posée en 5 minutes.",
    },
    {
      icon: <IconBox />,
      title: "Garnissez votre boutique",
      text: "Ajoutez vos produits depuis votre espace : prix, photos, stock. En quelques clics.",
    },
    {
      icon: <IconCoins />,
      title: "Vos voyageurs achètent",
      text: "Ils scannent, paient et se servent en autonomie, 24h/24, sans aucune intervention.",
    },
    {
      icon: <IconBolt />,
      title: "Vous encaissez",
      text: "L'argent arrive directement sur votre compte. 0% de commission sur vos ventes.",
    },
  ];

  return (
    <section id="fonctionnement" className="bg-brand py-20 text-white md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          dark
          eyebrow="Comment ça marche"
          title="De l'abonnement à l'encaissement"
          subtitle="Vous mettez en place une fois. La box génère du revenu à chaque séjour."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {hostSteps.map((step, i) => (
            <div
              key={step.title}
              className="group relative rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-white/10"
            >
              <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-white/5">
                {i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
                {step.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-white/70">{step.text}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-white/60">
          Côté voyageur, l&apos;expérience est instantanée :{" "}
          <span className="font-semibold text-white">
            Scannez · Payez · Ouvrez · Profitez
          </span>{" "}
          — sans application, sans compte.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Benefits */

function Benefits() {
  const items = [
    {
      icon: <IconCoins />,
      title: "Une nouvelle source de revenus",
      text: "Rentabilisez chaque séjour avec un CA additionnel récurrent, sans augmenter vos nuitées.",
    },
    {
      icon: <IconZero />,
      title: "0% de commission",
      text: "Vous gardez l'intégralité de vos ventes. Eskale Box, c'est un abonnement simple, point.",
    },
    {
      icon: <IconBolt />,
      title: "Versement direct",
      text: "Encaissement sécurisé via Stripe, viré directement sur votre compte d'hôte.",
    },
    {
      icon: <IconAuto />,
      title: "Zéro gestion au quotidien",
      text: "Pas de check-in produit, pas de logistique d'accueil. La box travaille seule.",
    },
    {
      icon: <IconLayers />,
      title: "Multi-logements",
      text: "Pilotez tous vos gîtes depuis un seul tableau de bord. Idéal pour les conciergeries.",
    },
    {
      icon: <IconChart />,
      title: "Pilotage des ventes",
      text: "Suivez votre CA, vos best-sellers et réapprovisionnez au bon moment.",
    },
  ];

  return (
    <section id="avantages" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Pourquoi Eskale Box"
          title="Plus de revenus, moins de gestion"
          subtitle="Un levier de rentabilité pensé pour les professionnels de la location courte durée."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-black/5 bg-cream p-6 shadow-card transition hover:shadow-soft"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                {item.icon}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-brand/60">{item.text}</p>
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
      text: "Forte marge, valeur perçue élevée, parfait pour l'apéro du soir.",
    },
    {
      img: "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80",
      title: "Produits du terroir",
      text: "Fromages, charcuterie, spécialités : vous valorisez votre région.",
    },
    {
      img: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
      title: "Kits petit-déjeuner",
      text: "Un service premium très demandé, vendu sans contrainte d'horaire.",
    },
    {
      img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80",
      title: "Essentiels & dépannage",
      text: "Chargeurs, hygiène, dépannage : achats d'impulsion réguliers.",
    },
  ];

  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Idées de produits"
          title="Composez la boutique la plus rentable"
          subtitle="Vous choisissez vos produits et vos marges selon votre logement et votre clientèle."
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
  const plans = [
    {
      name: "Essentiel",
      price: "19€",
      period: "/ mois",
      tagline: "Pour un logement",
      features: [
        "1 logement équipé",
        "Box + QR code dédié",
        "Catalogue de produits illimité",
        "0% de commission sur vos ventes",
        "Versement direct (Stripe)",
        "Suivi des ventes",
      ],
      cta: "Démarrer",
      highlighted: false,
    },
    {
      name: "Duo",
      price: "29,90€",
      period: "/ mois",
      tagline: "Pour deux logements",
      features: [
        "2 logements équipés (2 box)",
        "Tout le plan Essentiel",
        "Tableau de bord multi-sites",
        "Suivi des ventes consolidé",
      ],
      cta: "Choisir Duo",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "49€",
      period: "/ mois",
      tagline: "Pour les multi-propriétaires",
      features: [
        "Jusqu'à 5 logements",
        "Tout le plan Essentiel",
        "Tableau de bord multi-sites",
        "Statistiques avancées",
        "Support prioritaire",
      ],
      cta: "Choisir Pro",
      highlighted: true,
    },
    {
      name: "Conciergerie",
      price: "Sur devis",
      period: "",
      tagline: "Pour les flottes & hôtels",
      features: [
        "Logements illimités",
        "Account manager dédié",
        "Intégrations (PMS, channel manager)",
        "Facturation centralisée",
        "Accompagnement déploiement",
      ],
      cta: "Nous contacter",
      highlighted: false,
    },
  ];

  return (
    <section id="tarifs" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Tarifs"
          title="Un abonnement, sans commission"
          subtitle="Vous gardez 100% de vos ventes. Sans engagement, résiliable à tout moment."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-3xl p-8 ${
                plan.highlighted
                  ? "bg-brand text-white shadow-soft ring-2 ring-accent"
                  : "border border-black/5 bg-cream text-brand shadow-card"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Le plus choisi
                </span>
              )}
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <p
                className={`mt-1 text-sm ${
                  plan.highlighted ? "text-white/70" : "text-brand/60"
                }`}
              >
                {plan.tagline}
              </p>
              <div className="mt-5 flex items-end gap-1">
                <span className="font-display text-4xl font-extrabold">
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    className={`mb-1 text-sm ${
                      plan.highlighted ? "text-white/70" : "text-brand/60"
                    }`}
                  >
                    {plan.period}
                  </span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-0.5 text-accent">
                      <Check />
                    </span>
                    <span
                      className={
                        plan.highlighted ? "text-white/90" : "text-brand/80"
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.name === "Conciergerie" ? (
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Eskale Box - Conciergerie`}
                  className={`mt-8 block rounded-full px-6 py-3 text-center font-semibold transition ${
                    plan.highlighted
                      ? "bg-accent text-white hover:bg-accent-dark"
                      : "bg-brand text-white hover:bg-brand-dark"
                  }`}
                >
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href="/host/signup"
                  className={`mt-8 block rounded-full px-6 py-3 text-center font-semibold transition ${
                    plan.highlighted
                      ? "bg-accent text-white hover:bg-accent-dark"
                      : "bg-brand text-white hover:bg-brand-dark"
                  }`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand/50">
          Essai sans risque · Box fournie · Seuls les frais de transaction Stripe
          standards s&apos;appliquent à vos ventes.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- Testimonials */

function Testimonials() {
  const quotes = [
    {
      quote:
        "120€ de CA en plus par mois sur mon gîte, sans rien faire de plus. L'abonnement est rentabilisé dès la première semaine.",
      name: "Marie L.",
      role: "Gîte à Lyon",
    },
    {
      quote:
        "Je gère 8 logements. Le tableau de bord multi-sites me fait gagner un temps fou et les voyageurs adorent.",
      name: "Thomas R.",
      role: "Conciergerie en Provence",
    },
    {
      quote:
        "0% de commission et versement direct : un modèle clair et rentable. Je l'ai déployé sur tous mes appartements.",
      name: "Sophie M.",
      role: "Loueuse à Bordeaux",
    },
  ];

  return (
    <section className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Ils nous font confiance"
          title="Des hôtes déjà rentables"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-card"
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
      q: "Combien puis-je espérer gagner ?",
      a: "Cela dépend de votre taux d'occupation et de votre offre, mais nos hôtes constatent fréquemment plusieurs dizaines à plus de 150€ de CA additionnel par mois et par logement.",
    },
    {
      q: "Quelle commission prenez-vous sur mes ventes ?",
      a: "0%. Vous payez uniquement votre abonnement. L'intégralité de vos ventes est versée directement sur votre compte (hors frais de transaction Stripe standards).",
    },
    {
      q: "Y a-t-il un engagement ?",
      a: "Non, l'abonnement est sans engagement et résiliable à tout moment depuis votre espace.",
    },
    {
      q: "Je gère plusieurs logements, est-ce adapté ?",
      a: "Oui. Les formules Pro et Conciergerie permettent de piloter plusieurs logements depuis un tableau de bord unique, idéal pour les multi-propriétaires et conciergeries.",
    },
    {
      q: "Comment mes voyageurs paient-ils ?",
      a: "Ils scannent le QR code de la box, choisissent leurs produits et paient en invité via Stripe — sans application ni création de compte.",
    },
    {
      q: "L'installation est-elle compliquée ?",
      a: "Non. Vous posez la box, collez le QR code fourni et ajoutez vos produits depuis votre espace. Comptez environ 5 minutes.",
    },
  ];

  return (
    <section id="faq" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHeading eyebrow="FAQ" title="Vous avez des questions" />

        <div className="mt-12 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-black/5 bg-cream p-5 shadow-card [&_summary]:list-none"
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
    <section className="bg-cream py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark px-8 py-14 text-center text-white shadow-soft md:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <h2 className="relative font-display text-3xl font-extrabold md:text-4xl">
            Transformez vos séjours en chiffre d&apos;affaires
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/80">
            Rejoignez les hôtes et conciergeries qui génèrent un revenu
            additionnel grâce à Eskale Box.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/host/signup"
              className="rounded-full bg-accent px-7 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark"
            >
              Créer mon espace hôte
            </Link>
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
            La boutique autonome qui génère du revenu dans vos locations.
          </p>
        </div>

        <FooterCol
          title="Produit"
          links={[
            { label: "Fonctionnement", href: "#fonctionnement" },
            { label: "Avantages", href: "#avantages" },
            { label: "Tarifs", href: "#tarifs" },
            { label: "Démo voyageur", href: "/b/demo" },
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

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" strokeLinejoin="round" /><path d="M3 7v10l9 4 9-4V7M12 11v10" strokeLinejoin="round" />
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

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" /><path d="M3 13l9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M4 11l8-7 8 7M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <circle cx="8" cy="8" r="4" /><path d="M11 11l9 9M17 17l2-2M15 19l2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBed() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7v12M3 13h18v6M21 13v-2a3 3 0 00-3-3H9v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h0M12 7h0M15 7h0M9 11h0M12 11h0M15 11h0M10 21v-4h4v4" strokeLinecap="round" />
    </svg>
  );
}
