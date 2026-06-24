import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";
import { login } from "../auth-actions";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // On vérifie que le compte existe vraiment (pas seulement un cookie signé) :
  // un cookie orphelin (compte supprimé) ne doit pas relancer une boucle de
  // redirection avec /host.
  if (await getCurrentHost()) redirect("/host");

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
          Connexion hôte
        </h1>
        <p className="mb-6 mt-1 text-sm text-brand/60">
          Accédez à votre tableau de bord.
        </p>
        <AuthForm mode="login" action={login} />
      </div>
    </main>
  );
}
