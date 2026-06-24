import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "À propos — Eskale Box",
  description:
    "Notre histoire : d'un Airbnb à une nouvelle expérience voyageur qui génère du chiffre d'affaires additionnel pour les hôtes.",
};

export default function AProposPage() {
  return (
    <div className="bg-white text-brand">
      {/* Header */}
      <header className="border-b border-black/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/eskale-box-logo.png"
              alt="Eskale Box"
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
      <section className="bg-gradient-to-b from-brand to-brand-dark px-5 py-16 text-center text-white md:py-20">
        <span className="text-sm font-bold uppercase tracking-wide text-accent-light">
          Notre histoire
        </span>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-extrabold md:text-4xl">
          Né dans nos propres Airbnb, pour nos voyageurs
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          Eskale Box, ce n&apos;est pas une idée sortie d&apos;un bureau. C&apos;est
          la solution qu&apos;on a construite pour nous-mêmes — et qui marche.
        </p>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <div className="space-y-10">
          <Step
            num="1"
            title="Tout a commencé avec un Airbnb"
            text="Un premier logement, puis un deuxième, puis un troisième. En gérant nos locations, on a appris ce qui fait vraiment plaisir aux voyageurs — et ce qui leur manque souvent une fois sur place."
          />
          <Step
            num="2"
            title="L'envie de vente additionnelle"
            text="On cherchait un moyen simple de générer un revenu en plus à chaque séjour, sans alourdir notre gestion ni transformer nos logements en boutique."
          />
          <Step
            num="3"
            title="L'idée : une boîte, une expérience"
            text="On a imaginé une boîte autonome avec un QR code : le voyageur scanne, choisit, paie, reçoit un code et se sert. Une nouvelle expérience pour eux — et un petit plus qui change tout pour nous."
          />
          <Step
            num="✓"
            title="Aujourd'hui"
            text="Cette idée a fait grimper le chiffre d'affaires de nos propres Airbnb. Et nous ne sommes plus seuls : plusieurs hôtes nous font déjà confiance et équipent leurs logements avec Eskale Box."
            highlight
          />
        </div>

        {/* Values */}
        <div className="mt-16 grid gap-5 sm:grid-cols-3">
          <Value title="Testé par nous" text="On utilise Eskale Box dans nos propres logements, tous les jours." />
          <Value title="0% de commission" text="L'hôte garde 100% de ses ventes. On se rémunère sur l'abonnement, point." />
          <Value title="Simple, vraiment" text="Installation en 5 minutes, aucune gestion quotidienne." />
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-cream p-8 text-center md:p-12">
          <h2 className="font-display text-2xl font-extrabold text-brand">
            Rejoignez les hôtes qui nous font confiance
          </h2>
          <p className="mx-auto mt-3 max-w-md text-brand/60">
            Transformez vos séjours en chiffre d&apos;affaires, comme nous
            l&apos;avons fait.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/host/signup"
              className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
            >
              Devenir hôte
            </Link>
            <Link
              href="/"
              className="rounded-full bg-white px-6 py-3 font-semibold text-brand ring-1 ring-black/10 transition hover:bg-black/5"
            >
              Découvrir le concept
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({
  num,
  title,
  text,
  highlight,
}: {
  num: string;
  title: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-5">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold ${
          highlight ? "bg-accent text-white" : "bg-brand/5 text-brand"
        }`}
      >
        {num}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-brand">{title}</h3>
        <p className="mt-1 text-brand/70">{text}</p>
      </div>
    </div>
  );
}

function Value({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <h3 className="font-display font-bold text-brand">{title}</h3>
      <p className="mt-1 text-sm text-brand/60">{text}</p>
    </div>
  );
}
