import Link from "next/link";
import { ConfirmResetForm } from "../ConfirmResetForm";

export const dynamic = "force-dynamic";

export default async function ResetConfirmPage({
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
        éskale <span className="text-accent">box</span>
      </Link>
      <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-card">
        <h1 className="font-display text-2xl font-bold text-brand">
          Nouveau mot de passe
        </h1>
        {token ? (
          <>
            <p className="mb-6 mt-1 text-sm text-brand/60">
              Choisissez un nouveau mot de passe pour votre compte.
            </p>
            <ConfirmResetForm token={token} />
          </>
        ) : (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Lien invalide. Refaites une demande depuis la page{" "}
            <Link href="/host/reset" className="font-semibold underline">
              mot de passe oublié
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
