import type { ShipmentInput, ShipmentResult } from "./mondial-relay";

/**
 * Client DPD — création d'étiquette (DPD Shipping REST API / myDPD).
 *
 * ⚠️ Squelette prêt à brancher : reste à vérifier contre la doc DPD fournie
 *    avec VOTRE contrat (URL exacte, code produit, format de la requête) —
 *    l'API DPD varie selon le pays/dépôt et le type de compte. Une fois les
 *    identifiants et la doc en main, ajustez `buildRequest` / `parseResponse`
 *    ci-dessous ; le reste (config, dispatch, bouton admin) est déjà branché.
 *
 * Variables requises (Railway) :
 *   DPD_API_URL (URL du endpoint fourni par DPD pour votre compte)
 *   DPD_API_KEY, DPD_DEPOT_NUMBER
 *   EXPED_NOM, EXPED_ADRESSE, EXPED_CP, EXPED_VILLE, EXPED_PAYS (def FR), EXPED_TEL
 */

export function isDpdConfigured(): boolean {
  return Boolean(
    process.env.DPD_API_URL &&
      process.env.DPD_API_KEY &&
      process.env.DPD_DEPOT_NUMBER &&
      process.env.EXPED_NOM &&
      process.env.EXPED_ADRESSE &&
      process.env.EXPED_CP &&
      process.env.EXPED_VILLE
  );
}

function clean(v: string | undefined | null, max: number): string {
  return (v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

export async function createDpdLabel(
  input: ShipmentInput
): Promise<ShipmentResult> {
  if (!isDpdConfigured()) {
    throw new Error(
      "DPD non configuré : ajoutez DPD_API_URL, DPD_API_KEY, DPD_DEPOT_NUMBER et l'adresse d'expédition (EXPED_*) dans les variables."
    );
  }

  const body = {
    depot: process.env.DPD_DEPOT_NUMBER,
    reference: clean(input.ref, 35),
    weightKg: (input.weightGrams ?? 2000) / 1000,
    shipper: {
      name: clean(process.env.EXPED_NOM, 35),
      address: clean(process.env.EXPED_ADRESSE, 35),
      zipCode: clean(process.env.EXPED_CP, 10),
      city: clean(process.env.EXPED_VILLE, 35),
      country: clean(process.env.EXPED_PAYS || "FR", 2),
      phone: clean(process.env.EXPED_TEL, 20),
    },
    receiver: {
      name: clean(input.destName, 35),
      address: clean(input.destAddress, 35),
      zipCode: clean(input.destZip, 10),
      city: clean(input.destCity, 35),
      country: clean(input.destCountry || "FR", 2),
      phone: clean(input.destPhone, 20),
      email: clean(input.destEmail, 70),
    },
  };

  const res = await fetch(process.env.DPD_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DPD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`DPD: HTTP ${res.status} — ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    parcelNumber?: string;
    trackingNumber?: string;
    labelUrl?: string;
    label?: string;
  };

  const expeditionNumber = data.parcelNumber || data.trackingNumber || "";
  const labelUrl = data.labelUrl || "";
  if (!expeditionNumber || !labelUrl) {
    throw new Error(
      "DPD: réponse inattendue (à ajuster dans createDpdLabel selon le format réel de votre compte)."
    );
  }

  return { expeditionNumber, labelUrl };
}
