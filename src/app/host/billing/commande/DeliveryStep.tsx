"use client";

import { useState } from "react";
import { saveCheckoutDelivery } from "./checkout-actions";

type Carrier = "mondial_relay" | "dpd" | "chronopost";

const OPTIONS: {
  id: Carrier;
  name: string;
  desc: string;
  badge?: string;
}[] = [
  {
    id: "mondial_relay",
    name: "Mondial Relay",
    desc: "Livraison en Point Relais près de chez vous",
    badge: "Économique",
  },
  { id: "dpd", name: "DPD", desc: "Livraison à domicile" },
  { id: "chronopost", name: "Chronopost", desc: "Livraison express à domicile" },
];

export function DeliveryStep({
  planId,
  boxes,
  defaults,
  error,
}: {
  planId: string;
  boxes: number;
  defaults: { carrier: Carrier | ""; relayId: string; relayLabel: string };
  error?: string;
}) {
  const [carrier, setCarrier] = useState<Carrier | "">(defaults.carrier);

  return (
    <form
      action={saveCheckoutDelivery}
      className="space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-card"
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="boxes" value={boxes} />

      <h2 className="font-display font-bold text-brand">
        Choisissez votre transporteur
      </h2>

      {error === "carrier" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Veuillez choisir un transporteur.
        </p>
      )}

      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
              carrier === o.id
                ? "border-accent ring-2 ring-accent/30"
                : "border-black/10 hover:bg-black/5"
            }`}
          >
            <input
              type="radio"
              name="carrier"
              value={o.id}
              checked={carrier === o.id}
              onChange={() => setCarrier(o.id)}
              className="h-4 w-4"
            />
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold text-brand">
                {o.name}
                {o.badge && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    {o.badge}
                  </span>
                )}
              </span>
              <span className="block text-sm text-brand/60">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Point Relais — uniquement pour Mondial Relay */}
      {carrier === "mondial_relay" && (
        <div className="rounded-2xl border border-black/5 bg-cream p-4">
          <p className="text-sm text-brand/70">
            Indiquez votre Point Relais.{" "}
            <a
              href="https://www.mondialrelay.fr/trouver-le-point-relais-le-plus-proche/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              Trouver un Point Relais
            </a>
          </p>
          {error === "relay" && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Indiquez votre Point Relais pour Mondial Relay.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              name="relayId"
              defaultValue={defaults.relayId}
              placeholder="N° du Point Relais (ex. 012345)"
              className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <input
              name="relayLabel"
              defaultValue={defaults.relayLabel}
              placeholder="Nom / ville du relais (optionnel)"
              className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <a
          href={`/host/billing/commande?plan=${encodeURIComponent(planId)}&boxes=${boxes}&step=infos`}
          className="text-sm font-medium text-brand/60 hover:text-brand"
        >
          ← Retour
        </a>
        <button
          type="submit"
          disabled={!carrier}
          className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-50"
        >
          Continuer vers le paiement →
        </button>
      </div>
    </form>
  );
}
