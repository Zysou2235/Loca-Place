import Link from "next/link";
import { confirmEmail } from "./actions";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-8 text-center font-display text-2xl font-extrabold text-brand"
      >
        Escale <span className="text-accent">Box</span>
      </Link>
      <div className="rounded-3xl border border-black/5 bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-bold text-brand">
          Activation du compte
        </h1>
        {token ? (
          <>
            <p className="mb-6 mt-2 text-sm text-brand/60">
              Cliquez ci-dessous pour confirmer votre adresse et accéder à votre
              espace.
            </p>
            <form action={confirmEmail}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
              >
                Activer mon compte
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Lien invalide ou expiré. Réinscrivez-vous ou utilisez «{" "}
            <Link href="/host/reset" className="font-semibold underline">
              Mot de passe oublié
            </Link>{" "}
            ».
          </p>
        )}
      </div>
    </main>
  );
}
