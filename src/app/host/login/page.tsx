import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";
import { login } from "../auth-actions";
import { AuthForm } from "../AuthForm";
import { GoogleButton, OAuthError } from "../GoogleButton";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // On vérifie que le compte existe vraiment (pas seulement un cookie signé) :
  // un cookie orphelin (compte supprimé) ne doit pas relancer une boucle de
  // redirection avec /host.
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
          Connexion hôte
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Accédez à votre tableau de bord.
        </p>
        <OAuthError error={error} />
        <GoogleButton label="Continuer avec Google" />
        <Divider />
        <AuthForm mode="login" action={login} />
        <p className="mt-4 text-center text-sm text-brand/50">
          Email d&apos;activation non reçu ?{" "}
          <Link href="/host/activer" className="font-medium text-accent">
            Le renvoyer
          </Link>
        </p>
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
