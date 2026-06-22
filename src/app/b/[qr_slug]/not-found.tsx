import Link from "next/link";

export default function BoxNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Boîte introuvable</h1>
      <p className="text-neutral-600">
        Cette Staybox n&apos;existe pas ou n&apos;est plus active. Vérifiez le QR
        code scanné.
      </p>
      <Link href="/" className="text-sm font-semibold text-blue-600 hover:underline">
        ← Accueil
      </Link>
    </main>
  );
}
