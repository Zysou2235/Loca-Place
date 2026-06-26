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

          {/* Menu déroulant (natif <details>, se ferme à la navigation) */}
          <details className="group relative [&_summary]:list-none">
            <summary className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-brand/70 transition hover:bg-black/5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Menu
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="transition group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>

            <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white p-2 shadow-card">
              <div className="truncate px-3 py-2 text-xs font-medium uppercase tracking-wide text-brand/40">
                {hostName}
              </div>
              <MenuLink href="/host">Tableau de bord</MenuLink>
              <MenuLink href="/host/catalogue">Catalogue</MenuLink>
              <MenuLink href="/host/stats">Statistiques</MenuLink>
              <MenuLink href="/host/billing">Abonnement</MenuLink>
              <MenuLink href="/host/profil">Mes infos</MenuLink>

              <div className="my-1 border-t border-black/5" />

              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-brand/80 transition hover:bg-black/5 hover:text-brand"
    >
      {children}
    </Link>
  );
}
