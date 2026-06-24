import Link from "next/link";

export function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="font-display text-xl font-extrabold text-brand"
          >
            éskale <span className="text-accent">box</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-accent">
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-display text-3xl font-extrabold text-brand">
          {title}
        </h1>
        <p className="mt-2 text-sm text-brand/40">
          Dernière mise à jour : {updatedAt}
        </p>
        <div className="legal-content mt-8 space-y-6 text-brand/80">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-brand">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
