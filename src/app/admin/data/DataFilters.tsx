"use client";

import { useRouter } from "next/navigation";

type HostOpt = { id: string; name: string; email: string; isTest: boolean };
type BoxOpt = { id: string; name: string; hostId: string; hostName: string };

/**
 * Barre de filtres de la page Données : par hôte et par box.
 * Navigation par query params (?host=…&box=…) — la page serveur refait
 * tous les calculs sur le périmètre choisi.
 */
export function DataFilters({
  hosts,
  boxes,
  currentHost,
  currentBox,
}: {
  hosts: HostOpt[];
  boxes: BoxOpt[];
  currentHost: string;
  currentBox: string;
}) {
  const router = useRouter();

  const visibleBoxes = currentHost
    ? boxes.filter((b) => b.hostId === currentHost)
    : boxes;

  const go = (host: string, box: string) => {
    const q = new URLSearchParams();
    if (host) q.set("host", host);
    if (box) q.set("box", box);
    router.push(`/admin/data${q.size ? `?${q}` : ""}`);
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-brand/60">Hôte</span>
        <select
          value={currentHost}
          onChange={(e) => go(e.target.value, "")}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-brand outline-none focus:border-accent"
        >
          <option value="">Tous les hôtes</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.email}){h.isTest ? " — test" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-brand/60">Box</span>
        <select
          value={currentBox}
          onChange={(e) => {
            const boxId = e.target.value;
            const box = boxes.find((b) => b.id === boxId);
            go(box?.hostId ?? currentHost, boxId);
          }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-brand outline-none focus:border-accent"
        >
          <option value="">Toutes les box</option>
          {visibleBoxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.hostName}
            </option>
          ))}
        </select>
      </label>

      {(currentHost || currentBox) && (
        <button
          type="button"
          onClick={() => go("", "")}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand/60 transition hover:bg-black/5"
        >
          ✕ Réinitialiser
        </button>
      )}
    </div>
  );
}
