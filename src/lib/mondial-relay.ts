import crypto from "crypto";

/**
 * Client Mondial Relay — création d'étiquette prépayée (API WSI SOAP).
 * Opération : WSI2_CreationEtiquette (crée l'expédition et renvoie l'URL du PDF).
 *
 * ⚠️ La sécurité MR repose sur un hash MD5 de la concaténation des paramètres
 *    (dans un ordre précis) + clé privée. L'ordre/format doivent correspondre à
 *    la doc WSI2_CreationEtiquette de TON compte ; à valider au 1er test réel.
 *
 * Variables requises (Railway) :
 *   MONDIAL_RELAY_ENSEIGNE, MONDIAL_RELAY_PRIVATE_KEY
 *   EXPED_NOM, EXPED_ADRESSE, EXPED_CP, EXPED_VILLE, EXPED_PAYS (def FR), EXPED_TEL
 */

const WSI_URL = "https://api.mondialrelay.com/Web_Services.asmx";
const SOAP_ACTION =
  "http://www.mondialrelay.fr/webservice/WSI2_CreationEtiquette";

export function isMondialRelayConfigured(): boolean {
  return Boolean(
    process.env.MONDIAL_RELAY_ENSEIGNE &&
      process.env.MONDIAL_RELAY_PRIVATE_KEY &&
      process.env.EXPED_NOM &&
      process.env.EXPED_ADRESSE &&
      process.env.EXPED_CP &&
      process.env.EXPED_VILLE
  );
}

export type ShipmentInput = {
  // Destinataire (hôte)
  destName: string;
  destAddress: string;
  destZip: string;
  destCity: string;
  destCountry?: string; // "FR"
  destPhone?: string;
  destEmail?: string;
  weightGrams?: number; // défaut 2000 g
  // Point Relais (livraison 24R) — si absent, livraison à domicile (HOM)
  relayId?: string | null; // numéro du relais, ex "012345"
  ref?: string; // référence dossier (ex. id de la box)
};

export type ShipmentResult = {
  expeditionNumber: string;
  labelUrl: string; // URL absolue du PDF d'étiquette
};

function clean(v: string | undefined | null, max: number): string {
  return (v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

/** Numéro de relais sur 6 chiffres (MR attend "LIV_Rel" = 6 caractères). */
function relayCode(relayId?: string | null): string {
  if (!relayId) return "";
  const digits = relayId.replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
}

export async function createMondialRelayLabel(
  input: ShipmentInput
): Promise<ShipmentResult> {
  if (!isMondialRelayConfigured()) {
    throw new Error(
      "Mondial Relay non configuré : ajoutez MONDIAL_RELAY_ENSEIGNE, MONDIAL_RELAY_PRIVATE_KEY et l'adresse d'expédition (EXPED_*) dans les variables."
    );
  }

  const enseigne = process.env.MONDIAL_RELAY_ENSEIGNE!.trim();
  const privateKey = process.env.MONDIAL_RELAY_PRIVATE_KEY!.trim();

  const relay = relayCode(input.relayId);
  const modeLiv = relay ? "24R" : "HOM"; // 24R = Point Relais, HOM = domicile
  const livRelPays = relay ? "FR" : "";
  const destCountry = (input.destCountry || "FR").toUpperCase();

  // Paramètres dans l'ORDRE attendu par WSI2_CreationEtiquette.
  // (clé = nom XML ; l'ordre de ce tableau sert aussi au calcul du hash)
  const p: [string, string][] = [
    ["Enseigne", enseigne],
    ["ModeCol", "CCC"], // dépôt en point relais par l'expéditeur
    ["ModeLiv", modeLiv],
    ["NDossier", clean(input.ref, 15)],
    ["NClient", ""],
    ["Expe_Langage", "FR"],
    ["Expe_Ad1", clean(process.env.EXPED_NOM, 32)],
    ["Expe_Ad2", ""],
    ["Expe_Ad3", clean(process.env.EXPED_ADRESSE, 32)],
    ["Expe_Ad4", ""],
    ["Expe_Ville", clean(process.env.EXPED_VILLE, 26)],
    ["Expe_CP", clean(process.env.EXPED_CP, 9)],
    ["Expe_Pays", clean(process.env.EXPED_PAYS || "FR", 2)],
    ["Expe_Tel1", clean(process.env.EXPED_TEL, 13)],
    ["Expe_Tel2", ""],
    ["Expe_Mail", ""],
    ["Dest_Langage", "FR"],
    ["Dest_Ad1", clean(input.destName, 32)],
    ["Dest_Ad2", ""],
    ["Dest_Ad3", clean(input.destAddress, 32)],
    ["Dest_Ad4", ""],
    ["Dest_Ville", clean(input.destCity, 26)],
    ["Dest_CP", clean(input.destZip, 9)],
    ["Dest_Pays", destCountry],
    ["Dest_Tel1", clean(input.destPhone, 13)],
    ["Dest_Tel2", ""],
    ["Dest_Mail", clean(input.destEmail, 70)],
    ["Poids", String(input.weightGrams ?? 2000)],
    ["Longueur", ""],
    ["Taille", ""],
    ["NbColis", "1"],
    ["CRT_Valeur", "0"],
    ["CRT_Devise", ""],
    ["Exp_Valeur", "0"],
    ["Exp_Devise", ""],
    ["COL_Rel_Pays", ""],
    ["COL_Rel", ""],
    ["LIV_Rel_Pays", livRelPays],
    ["LIV_Rel", relay],
    ["TAvisage", ""],
    ["TReprise", ""],
    ["Montage", ""],
    ["TInformeColis", ""],
  ];

  // Hash de sécurité = MD5( concat(valeurs) + clé privée ), en MAJUSCULES.
  const concat = p.map(([, v]) => v).join("") + privateKey;
  const security = crypto
    .createHash("md5")
    .update(concat, "latin1")
    .digest("hex")
    .toUpperCase();

  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><WSI2_CreationEtiquette xmlns="http://www.mondialrelay.fr/webservice/">` +
    p.map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`).join("") +
    `<Security>${security}</Security>` +
    `</WSI2_CreationEtiquette></soap:Body></soap:Envelope>`;

  const res = await fetch(WSI_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: SOAP_ACTION },
    body,
  });
  const xml = await res.text();
  if (!res.ok) {
    throw new Error(`Mondial Relay: HTTP ${res.status}`);
  }

  const stat = pick(xml, "STAT");
  if (stat && stat !== "0") {
    throw new Error(`Mondial Relay: erreur STAT ${stat} (voir doc codes WSI).`);
  }

  const expeditionNumber = pick(xml, "ExpeditionNum") || "";
  const labelRel = pick(xml, "URL_Etiquette") || "";
  if (!expeditionNumber || !labelRel) {
    throw new Error("Mondial Relay: réponse incomplète (pas d'étiquette).");
  }

  const labelUrl = labelRel.startsWith("http")
    ? labelRel
    : `https://www.mondialrelay.com${labelRel}`;

  return { expeditionNumber, labelUrl };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}
