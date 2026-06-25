import Link from "next/link";
import { RequestResetForm } from "./RequestResetForm";

export const dynamic = "force-dynamic";

export default function ResetRequestPage() {
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
          Mot de passe oublié
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Entrez votre email : nous vous enverrons un lien pour le réinitialiser.
        </p>
        <RequestResetForm />
      </div>
    </main>
  );
}
