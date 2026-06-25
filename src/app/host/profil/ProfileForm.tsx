"use client";

import { useActionState, useState } from "react";
import { updateHostProfile, type ProfileState } from "../profile-actions";

type Defaults = {
  phone: string;
  companyName: string;
  siret: string;
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

export function ProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateHostProfile,
    {}
  );
  const [sameAsBilling, setSameAsBilling] = useState(false);

  return (
    <form action={action} className="space-y-8">
      {/* Facturation / légal */}
      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h2 className="font-display font-bold text-brand">
          Facturation &amp; informations légales
        </h2>
        <p className="mt-1 text-sm text-brand/50">
          Utilisées pour votre facture d&apos;abonnement et nos obligations
          légales.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input name="companyName" label="Nom / Raison sociale" defaultValue={defaults.companyName} />
          <Input name="siret" label="SIRET (si professionnel)" defaultValue={defaults.siret} optional />
          <Input name="phone" label="Téléphone" defaultValue={defaults.phone} optional />
          <div className="hidden sm:block" />
          <Input name="billingLine1" label="Adresse" defaultValue={defaults.billingLine1} className="sm:col-span-2" />
          <Input name="billingZip" label="Code postal" defaultValue={defaults.billingZip} />
          <Input name="billingCity" label="Ville" defaultValue={defaults.billingCity} />
          <Input name="billingCountry" label="Pays" defaultValue={defaults.billingCountry || "France"} />
        </div>
      </section>

      {/* Livraison */}
      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <h2 className="font-display font-bold text-brand">
          Adresse de livraison de la box
        </h2>
        <p className="mt-1 text-sm text-brand/50">
          C&apos;est là que nous expédions votre box Escale Box.
        </p>

        <label className="mt-3 flex items-center gap-2 text-sm text-brand/70">
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
            <Input name="deliveryName" label="Nom du destinataire" defaultValue={defaults.deliveryName} className="sm:col-span-2" />
            <Input name="deliveryLine1" label="Adresse" defaultValue={defaults.deliveryLine1} className="sm:col-span-2" />
            <Input name="deliveryZip" label="Code postal" defaultValue={defaults.deliveryZip} />
            <Input name="deliveryCity" label="Ville" defaultValue={defaults.deliveryCity} />
            <Input name="deliveryCountry" label="Pays" defaultValue={defaults.deliveryCountry || "France"} />
          </div>
        )}
      </section>

      {state.ok && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Vos informations ont été enregistrées.
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-accent-dark disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer mes informations"}
      </button>
    </form>
  );
}

function Input({
  name,
  label,
  defaultValue,
  optional,
  className,
}: {
  name: string;
  label: string;
  defaultValue: string;
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
        className="rounded-xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </label>
  );
}
