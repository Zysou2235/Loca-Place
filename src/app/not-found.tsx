import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Page introuvable — Escale Box",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cream px-6 text-center">
      <Image
        src="/escale-box-logo.png"
        alt="Escale Box"
        width={140}
        height={140}
        className="h-16 w-auto"
      />
      <div>
        <h1 className="font-display text-3xl font-extrabold text-brand">
          404 · Box vide 📦
        </h1>
        <p className="mt-2 max-w-sm text-brand/60">
          On a scanné partout, cette page n&apos;a rien à l&apos;intérieur.
          Quelqu&apos;un a dû tout vendre avant vous.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
      >
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}
