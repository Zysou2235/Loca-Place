import Link from "next/link";
import { ResendActivationForm } from "./ResendActivationForm";

export const dynamic = "force-dynamic";

export default function ActivationResendPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-8 text-center font-display text-2xl font-extrabold text-brand"
      >
        Escale <span className="text-accent">Box</span>
      </Link>
      <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-card">
        <h1 className="font-display text-2xl font-bold text-brand">
          Renvoyer l&apos;email d&apos;activation
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Vous n&apos;avez pas reçu le lien pour activer votre compte&nbsp;?
          Indiquez votre email, nous vous en renvoyons un.
        </p>
        <ResendActivationForm />
      </div>
    </main>
  );
}
