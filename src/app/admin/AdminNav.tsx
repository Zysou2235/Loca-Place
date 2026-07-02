import Link from "next/link";
import { logout } from "../host/auth-actions";

const TABS = [
  { href: "/admin", label: "Comptes & box" },
  { href: "/admin/orders", label: "Ventes" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/data", label: "Données" },
  { href: "/admin/stats", label: "Statistiques" },
  { href: "/admin/test", label: "Tests MVP" },
] as const;

/** En-tête commun de l'espace admin (onglets + déconnexion). */
export function AdminNav({ current }: { current: string }) {
  return (
    <header className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <span className="font-display text-xl font-extrabold text-brand">
          Escale <span className="text-accent">Box</span>
          <span className="ml-2 align-middle text-xs font-medium text-red-500">
            admin
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/host"
            className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-brand/70 transition hover:bg-black/5"
          >
            ← Espace hôte
          </Link>
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={
                current === t.href
                  ? "font-semibold text-brand"
                  : "font-medium text-brand/70 hover:text-brand"
              }
            >
              {t.label}
            </Link>
          ))}
          <form action={logout}>
            <button className="rounded-full border border-black/10 px-3 py-1.5 font-medium text-brand/70 transition hover:bg-black/5">
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
