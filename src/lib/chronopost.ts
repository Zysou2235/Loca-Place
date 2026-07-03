import type { ShipmentInput, ShipmentResult } from "./mondial-relay";

/**
 * Client Chronopost — création d'étiquette (webservice SOAP ShippingServiceWS).
 *
 * ⚠️ Squelette prêt à brancher : Chronopost expose classiquement un webservice
 *    SOAP d'expédition authentifié par n° de compte + mot de passe. Les noms
 *    de champs exacts (skybill, produit, service) doivent être vérifiés
 *    contre le WSDL fourni avec VOTRE contrat avant le premier envoi réel —
 *    comme pour Mondial Relay. Une fois les identifiants et le WSDL en main,
 *    ajustez le corps de la requête ci-dessous ; le reste (config, dispatch,
 *    bouton admin) est déjà branché.
 *
 * Variables requises (Railway) :
 *   CHRONOPOST_API_URL (URL du endpoint SOAP fourni par Chronopost)
 *   CHRONOPOST_ACCOUNT_NUMBER, CHRONOPOST_PASSWORD
 *   EXPED_NOM, EXPED_ADRESSE, EXPED_CP, EXPED_VILLE, EXPED_PAYS (def FR), EXPED_TEL
 */

export function isChronopostConfigured(): boolean {
  return Boolean(
    process.env.CHRONOPOST_API_URL &&
      process.env.CHRONOPOST_ACCOUNT_NUMBER &&
      process.env.CHRONOPOST_PASSWORD &&
      process.env.EXPED_NOM &&
      process.env.EXPED_ADRESSE &&
      process.env.EXPED_CP &&
      process.env.EXPED_VILLE
  );
}

function clean(v: string | undefined | null, max: number): string {
  return (v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

export async function createChronopostLabel(
  input: ShipmentInput
): Promise<ShipmentResult> {
  if (!isChronopostConfigured()) {
    throw new Error(
      "Chronopost non configuré : ajoutez CHRONOPOST_API_URL, CHRONOPOST_ACCOUNT_NUMBER, CHRONOPOST_PASSWORD et l'adresse d'expédition (EXPED_*) dans les variables."
    );
  }

  const accountNumber = process.env.CHRONOPOST_ACCOUNT_NUMBER!.trim();
  const password = process.env.CHRONOPOST_PASSWORD!.trim();

  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><shipping xmlns="http://www.chronopost.fr/ws/ShippingService">` +
    `<shipperType>` +
    `<shipperAdress1>${escapeXml(clean(process.env.EXPED_ADRESSE, 35))}</shipperAdress1>` +
    `<shipperCity>${escapeXml(clean(process.env.EXPED_VILLE, 35))}</shipperCity>` +
    `<shipperZipCode>${escapeXml(clean(process.env.EXPED_CP, 10))}</shipperZipCode>` +
    `<shipperCountry>${escapeXml(clean(process.env.EXPED_PAYS || "FR", 2))}</shipperCountry>` +
    `<shipperName>${escapeXml(clean(process.env.EXPED_NOM, 35))}</shipperName>` +
    `<shipperPhone>${escapeXml(clean(process.env.EXPED_TEL, 20))}</shipperPhone>` +
    `</shipperType>` +
    `<customerType>` +
    `<customerAccountNumber>${escapeXml(accountNumber)}</customerAccountNumber>` +
    `</customerType>` +
    `<recipientType>` +
    `<recipientAdress1>${escapeXml(clean(input.destAddress, 35))}</recipientAdress1>` +
    `<recipientCity>${escapeXml(clean(input.destCity, 35))}</recipientCity>` +
    `<recipientZipCode>${escapeXml(clean(input.destZip, 10))}</recipientZipCode>` +
    `<recipientCountry>${escapeXml(clean(input.destCountry || "FR", 2))}</recipientCountry>` +
    `<recipientName>${escapeXml(clean(input.destName, 35))}</recipientName>` +
    `<recipientPhone>${escapeXml(clean(input.destPhone, 20))}</recipientPhone>` +
    `<recipientMail>${escapeXml(clean(input.destEmail, 70))}</recipientMail>` +
    `</recipientType>` +
    `<skybillType>` +
    `<weight>${(input.weightGrams ?? 2000) / 1000}</weight>` +
    `<reference1>${escapeXml(clean(input.ref, 35))}</reference1>` +
    `</skybillType>` +
    `<password>${escapeXml(password)}</password>` +
    `</shipping></soap:Body></soap:Envelope>`;

  const res = await fetch(process.env.CHRONOPOST_API_URL!, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body,
  });
  const xml = await res.text();
  if (!res.ok) {
    throw new Error(`Chronopost: HTTP ${res.status}`);
  }

  const errorCode = pick(xml, "errorCode");
  if (errorCode && errorCode !== "0") {
    const errorMessage = pick(xml, "errorMessage") || "";
    throw new Error(`Chronopost: erreur ${errorCode} ${errorMessage}`);
  }

  const expeditionNumber = pick(xml, "skybillNumber") || "";
  const labelUrl = pick(xml, "labelUrl") || "";
  if (!expeditionNumber || !labelUrl) {
    throw new Error(
      "Chronopost: réponse inattendue (à ajuster dans createChronopostLabel selon le WSDL réel de votre compte)."
    );
  }

  return { expeditionNumber, labelUrl };
}
