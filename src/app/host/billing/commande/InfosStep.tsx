"use client";

import { useState } from "react";
import { saveCheckoutInfos } from "./checkout-actions";

type Defaults = {
  companyName: string;
  siret: string;
  phone: string;
  billingLine1: string;
  billingZip: string;
  billingCity: string;
  billingCountry: string;
  deliveryName: string;
  deliveryLine1: string;
  deliveryZip: string;
  deliveryCity: string;
  deliveryCountry: string;
};

export function InfosStep({
  planId,
  defaults,
}: {
  planId: string;
  defaults: Defaults;
}) {
  const [sameAsBilling, setSameAsBilling] = useState(true);

  return (
    <form
      action={saveCheckoutInfos}
      className="space-y-6 rounded-2xl border border-black/5 bg-white p-6 shadow-card"
    >
      <input type="hidden" name="planId" value={planId} />

      <div>
        <h2 className="font-display font-bold text-brand">
          Coordonnées & facturation
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="companyName" label="Nom / Raison sociale" defaultValue={defaults.companyName} required />
          <Field name="siret" label="SIRET" defaultValue={defaults.siret} optional />
          <Field name="phone" label="Téléphone" defaultValue={defaults.phone} optional />
          <div className="hidden sm:block" />
          <Field name="billingLine1" label="Adresse" defaultValue={defaults.billingLine1} required className="sm:col-span-2" />
          <Field name="billingZip" label="Code postal" defaultValue={defaults.billingZip} required />
          <Field name="billingCity" label="Ville" defaultValue={defaults.billingCity} required />
          <Field name="billingCountry" label="Pays" defaultValue={defaults.billingCountry || "France"} required />
        </div>
      </div>

      <div className="border-t border-black/5 pt-5">
        <h2 className="font-display font-bold text-brand">
          Adresse de livraison
        </h2>
        <label className="mt-2 flex items-center gap-2 text-sm text-brand/70">
          <input
            type="checkbox"
            name="sameAsBilling"
            checked={sameAsBilling}
            onChange={(e) => setSameAsBilling(e.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          Identique à l&apos;adresse de facturation
        </label>

        {!sameAsBilling && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="deliveryName" label="Nom du destinataire" defaultValue={defaults.deliveryName} className="sm:col-span-2" />
            <Field name="deliveryLine1" label="Adresse" defaultValue={defaults.deliveryLine1} className="sm:col-span-2" />
            <Field name="deliveryZip" label="Code postal" defaultValue={defaults.deliveryZip} />
            <Field name="deliveryCity" label="Ville" defaultValue={defaults.deliveryCity} />
            <Field name="deliveryCountry" label="Pays" defaultValue={defaults.deliveryCountry || "France"} />
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark"
      >
        Continuer vers la livraison →
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  optional,
  className,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-brand/80">
        {label}
        {optional && <span className="text-brand/40"> (optionnel)</span>}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </label>
  );
}
