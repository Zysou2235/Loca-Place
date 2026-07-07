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

  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
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
      <p style="color:#666">Récupérez votre produit dans l'Escale Box de votre logement.</p>
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
        subject: `Votre code Escale Box : ${p.code}`,
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

interface SalePayload {
  hostEmail: string;
  hostName?: string | null;
  boxName: string;
  productName: string;
  amountCents: number;
  currency: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

/** Prévient l'hôte qu'un voyageur vient d'acheter dans l'une de ses box. */
export async function sendHostSaleEmail(p: SalePayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !p.hostEmail) {
    if (!apiKey) console.warn("[notify] RESEND_API_KEY absent — email hôte non envoyé.");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const amount = (p.amountCents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: (p.currency || "eur").toUpperCase(),
  });
  const contact =
    p.customerEmail || p.customerPhone
      ? `<p style="color:#666">Contact voyageur : ${escapeHtml(
          p.customerEmail ?? p.customerPhone ?? ""
        )}</p>`
      : "";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Nouvelle vente 🎉</h2>
      <p>Bonjour ${escapeHtml(p.hostName ?? "")},</p>
      <p>Un voyageur vient d'acheter <strong>${escapeHtml(
        p.productName
      )}</strong> dans votre box <strong>${escapeHtml(p.boxName)}</strong>.</p>
      <p style="font-size:22px;font-weight:bold">${escapeHtml(amount)}</p>
      ${contact}
      <p style="color:#666">Retrouvez le détail dans votre tableau de bord Escale Box.</p>
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
        to: p.hostEmail,
        subject: `Nouvelle vente : ${p.productName} (${amount})`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[notify] Resend (hôte) error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Resend (hôte) request failed", err);
    return false;
  }
}

interface LandingVisitPayload {
  country?: string | null;
  city?: string | null;
  referer?: string | null;
  path: string;
  /** Qui est ce visiteur : "Hôte connecté (email)", "Visiteur connu (email)",
   *  "Visiteur récurrent (anonyme)" ou "Nouveau visiteur". */
  identity: string;
}

/** Alerte l'équipe qu'un visiteur vient d'arriver sur la landing page —
 *  temps réel, sur tous les canaux configurés (email, Slack). Chaque canal
 *  est indépendant et no-op silencieusement s'il n'a pas ses variables d'env
 *  — jamais d'erreur remontée à l'appelant. */
export async function sendLandingVisitAlert(p: LandingVisitPayload): Promise<void> {
  const location =
    p.city || p.country
      ? [p.city, p.country].filter(Boolean).join(", ")
      : "Localisation inconnue";

  await Promise.allSettled([
    sendLandingVisitEmail(p, location),
    sendSlackAlert(landingVisitText(p, location)),
  ]);
}

function landingVisitText(p: LandingVisitPayload, location: string): string {
  const lines = [
    `👀 Visite landing page`,
    `Localisation : ${location}`,
    `Qui : ${p.identity}`,
    `Page : ${p.path}`,
  ];
  if (p.referer) lines.push(`Provenance : ${p.referer}`);
  return lines.join("\n");
}

async function sendLandingVisitEmail(
  p: LandingVisitPayload,
  location: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) {
    if (!apiKey) console.warn("[notify] RESEND_API_KEY absent — alerte visite non envoyée.");
    return false;
  }

  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>👀 Visite sur la landing page</h2>
      <p style="color:#666">Localisation (approximative)</p>
      <p style="font-size:18px;font-weight:bold">${escapeHtml(location)}</p>
      <p style="color:#666">Qui : ${escapeHtml(p.identity)}</p>
      <p style="color:#666">Page : ${escapeHtml(p.path)}</p>
      ${p.referer ? `<p style="color:#666">Provenance : ${escapeHtml(p.referer)}</p>` : ""}
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
        to,
        subject: `👀 Visite landing page — ${location}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[notify] Resend (visite landing) error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Resend (visite landing) request failed", err);
    return false;
  }
}

/** Extrait une URL de webhook Slack propre à partir de la variable d'env —
 *  tolère les erreurs de copier-coller courantes (guillemets autour de la
 *  valeur, espaces, ou collage de la commande curl entière au lieu de la
 *  seule URL). Renvoie null si rien d'exploitable n'est trouvé. */
function parseSlackWebhookUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/https:\/\/hooks\.slack\.com\/services\/\S+/);
  if (!match) {
    console.warn(
      "[notify] SLACK_WEBHOOK_URL présente mais ne ressemble pas à une URL de webhook Slack — vérifiez qu'elle commence par https://hooks.slack.com/services/ sans guillemets ni texte autour."
    );
    return null;
  }
  return match[0].replace(/["'.,;]+$/, "");
}

/** Envoie un message texte via un Incoming Webhook Slack.
 *  Variable requise : SLACK_WEBHOOK_URL (Slack → Apps → Incoming Webhooks). */
export async function sendSlackAlert(text: string): Promise<boolean> {
  const url = parseSlackWebhookUrl(process.env.SLACK_WEBHOOK_URL);
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("[notify] Slack error", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Slack request failed", err);
    return false;
  }
}

/** Envoie le lien de réinitialisation du mot de passe à l'hôte. */
export async function sendPasswordResetEmail(
  email: string,
  link: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notify] RESEND_API_KEY absent — email reset non envoyé.");
    return false;
  }
  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Choisissez votre mot de passe</h2>
      <p>Cliquez sur le bouton ci-dessous pour définir votre mot de passe
      (première connexion ou changement). Ce lien expire dans 1 heure.</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:bold">Choisir mon mot de passe</a></p>
      <p style="color:#666">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
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
        to: email,
        subject: "Choisissez votre mot de passe Escale Box",
        html,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[notify] Resend (reset) request failed", err);
    return false;
  }
}

/** Email de vérification à l'inscription par mot de passe. */
export async function sendVerificationEmail(
  email: string,
  link: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notify] RESEND_API_KEY absent — email de vérification non envoyé.");
    return false;
  }
  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Confirmez votre adresse email</h2>
      <p>Bienvenue sur Escale Box ! Cliquez ci-dessous pour activer votre compte.
      Ce lien expire dans 24 heures.</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9999px;font-weight:bold">Activer mon compte</a></p>
      <p style="color:#666">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
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
        to: email,
        subject: "Confirmez votre adresse — Escale Box",
        html,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[notify] Resend (verify) request failed", err);
    return false;
  }
}

/** Heads-up envoyé quand quelqu'un tente de re-créer un compte existant. */
export async function sendExistingAccountEmail(email: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Vous avez déjà un compte</h2>
      <p>Une tentative de création de compte vient d'avoir lieu avec cette adresse.
      Vous possédez déjà un compte Escale Box : connectez-vous, ou réinitialisez
      votre mot de passe si vous l'avez oublié.</p>
      <p style="color:#666">Si ce n'était pas vous, aucune action n'est requise.</p>
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
        to: email,
        subject: "Tentative d'inscription — vous avez déjà un compte",
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendAccessCodeSms(p: CodePayload): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from || !p.phone) return false;

  const body = `Escale Box — votre code pour ouvrir la boîte : ${p.code}. Bon séjour !`;
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
