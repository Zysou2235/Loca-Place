import Link from "next/link";
import { logout } from "./auth-actions";

export function HostShell({
  hostName,
  children,
}: {
  hostName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link
            href="/host"
            className="font-display text-xl font-extrabold text-brand"
          >
            Escale <span className="text-accent">Box</span>
            <span className="ml-2 align-middle text-xs font-medium text-brand/40">
              espace hôte
            </span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/host" className="font-medium text-brand/70 hover:text-brand">
              Tableau de bord
            </Link>
            <Link
              href="/host/catalogue"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Catalogue
            </Link>
            <Link
              href="/host/stats"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Statistiques
            </Link>
            <Link
              href="/host/billing"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Abonnement
            </Link>
            <Link
              href="/host/profil"
              className="font-medium text-brand/70 hover:text-brand"
            >
              Mes infos
            </Link>
            <span className="hidden text-brand/40 sm:inline">·</span>
            <span className="hidden text-brand/60 sm:inline">{hostName}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-brand/70 transition hover:bg-black/5"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
