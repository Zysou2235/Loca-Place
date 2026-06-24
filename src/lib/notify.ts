/**
 * Notifications for delivering a box access code to the traveler after payment.
 * Email via Resend, SMS via Twilio. Both degrade gracefully (log + skip) when
 * the corresponding provider isn't configured, so the app never crashes.
 */

interface CodePayload {
  code: string;
  boxName: string;
  productName: string;
  email?: string | null;
  phone?: string | null;
}

export async function sendAccessCodeEmail(p: CodePayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !p.email) {
    if (!apiKey) console.warn("[notify] RESEND_API_KEY absent — email non envoyé.");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "Eskale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Merci pour votre achat 🎉</h2>
      <p>Votre commande <strong>${escapeHtml(p.productName)}</strong> (${escapeHtml(
        p.boxName
      )}) est confirmée.</p>
      <p>Voici le code pour ouvrir la boîte&nbsp;:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#f4f4f5;padding:16px 24px;border-radius:12px;text-align:center">${escapeHtml(
        p.code
      )}</p>
      <p style="color:#666">Récupérez votre produit dans l'Eskale Box de votre logement.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: p.email,
        subject: `Votre code Eskale Box : ${p.code}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[notify] Resend error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Resend request failed", err);
    return false;
  }
}

export async function sendAccessCodeSms(p: CodePayload): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from || !p.phone) return false;

  const body = `Eskale Box — votre code pour ouvrir la boîte : ${p.code}. Bon séjour !`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: p.phone, From: from, Body: body }),
      }
    );
    if (!res.ok) {
      console.error("[notify] Twilio error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Twilio request failed", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
