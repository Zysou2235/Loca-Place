import * as Sentry from "@sentry/nextjs";
import { sendSlackAlert } from "@/lib/notify";

/**
 * Alerte l'équipe (email + Slack + Sentry) qu'une erreur serveur vient de se
 * produire. Best effort : ne lève jamais, ne bloque jamais l'appelant.
 */
export async function reportServerError(context: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[error-report] ${context}:`, error);

  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    tags: { context },
  });

  const text = [
    `🔴 Erreur serveur — ${context}`,
    message,
    stack ? stack.split("\n").slice(0, 4).join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await Promise.allSettled([
      sendSlackAlert(text),
      sendErrorAlertEmail(context, message, stack),
    ]);
  } catch {
    // best-effort
  }
}

async function sendErrorAlertEmail(
  context: string,
  message: string,
  stack: string | undefined
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) return false;

  const from = process.env.RESEND_FROM ?? "Escale Box <onboarding@resend.dev>";
  const html = `
    <div style="font-family:monospace;max-width:600px;margin:auto">
      <h2>🔴 Erreur serveur</h2>
      <p><strong>${escapeHtml(context)}</strong></p>
      <p>${escapeHtml(message)}</p>
      ${stack ? `<pre style="white-space:pre-wrap;font-size:12px;color:#666">${escapeHtml(stack.split("\n").slice(0, 8).join("\n"))}</pre>` : ""}
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
        subject: `🔴 Erreur — ${context}`,
        html,
      }),
    });
    return res.ok;
  } catch {
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
