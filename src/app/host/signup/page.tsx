import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionHostId } from "@/lib/auth";
import { signup } from "../auth-actions";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionHostId()) redirect("/host");

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
          Créer mon espace hôte
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Lancez votre boutique autonome en quelques minutes.
        </p>
        <AuthForm mode="signup" action={signup} />
      </div>
    </main>
  );
}
