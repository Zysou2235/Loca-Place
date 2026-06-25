import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";
import { signup } from "../auth-actions";
import { AuthForm } from "../AuthForm";
import { GoogleButton, OAuthError } from "../GoogleButton";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Vérifie que le compte existe réellement (cookie orphelin -> pas de boucle).
  if (await getCurrentHost()) redirect("/host");

  const { error } = await searchParams;

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
          Créer mon espace hôte
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Lancez votre boutique autonome en quelques minutes.
        </p>
        <OAuthError error={error} />
        <GoogleButton label="S'inscrire avec Google" />
        <Divider />
        <AuthForm mode="signup" action={signup} />
      </div>
    </main>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-brand/40">
      <span className="h-px flex-1 bg-black/10" />
      ou
      <span className="h-px flex-1 bg-black/10" />
    </div>
  );
}
