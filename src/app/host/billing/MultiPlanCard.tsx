"use client";

import { useState } from "react";
import Link from "next/link";
import {
  priceCentsFor,
  boxesFor,
  MULTI_MIN_BOXES,
  MAX_BOXES,
  getPlan,
} from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import { openBillingPortal } from "../billing-actions";

export function MultiPlanCard({
  current,
  subscribed,
}: {
  current: boolean;
  subscribed: boolean;
}) {
  const plan = getPlan("multi")!;
  const [boxes, setBoxes] = useState(MULTI_MIN_BOXES);
  const price = priceCentsFor("multi", boxes);

  const dec = () => setBoxes((b) => Math.max(MULTI_MIN_BOXES, b - 1));
  const inc = () => setBoxes((b) => Math.min(MAX_BOXES, b + 1));

  return (
    <div className="relative flex flex-col rounded-3xl bg-brand p-7 text-white shadow-soft ring-2 ring-accent">
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
        Le plus choisi
      </span>
      <h3 className="font-display text-lg font-bold">{plan.name}</h3>
      <p className="mt-1 text-sm text-white/70">{plan.tagline}</p>

      {/* Sélecteur de nombre de box */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={dec}
          className="h-8 w-8 rounded-full bg-white/15 text-lg font-bold leading-none transition hover:bg-white/25"
          aria-label="Moins"
        >
          −
        </button>
        <span className="min-w-[5rem] text-center text-sm font-medium">
          {boxes} box
        </span>
        <button
          type="button"
          onClick={inc}
          className="h-8 w-8 rounded-full bg-white/15 text-lg font-bold leading-none transition hover:bg-white/25"
          aria-label="Plus"
        >
          +
        </button>
      </div>

      <div className="mt-3 flex items-end gap-1">
        <span className="font-display text-4xl font-extrabold">
          {formatPrice(price)}
        </span>
        <span className="mb-1 text-sm text-white/70">/ mois</span>
      </div>

      <ul className="mt-5 flex-1 space-y-2 text-sm text-white/90">
        {plan.features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>

      {current ? (
        <div className="mt-6 rounded-full bg-green-100 px-5 py-3 text-center text-sm font-semibold text-green-700">
          Formule actuelle
        </div>
      ) : subscribed ? (
        <form action={openBillingPortal} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-5 py-3 text-center font-semibold text-white transition hover:bg-accent-dark"
          >
            Changer pour cette formule
          </button>
        </form>
      ) : (
        <Link
          href={`/host/billing/commande?plan=multi&boxes=${boxesFor("multi", boxes)}`}
          className="mt-6 block rounded-full bg-accent px-5 py-3 text-center font-semibold text-white transition hover:bg-accent-dark"
        >
          S&apos;abonner
        </Link>
      )}
    </div>
  );
}
