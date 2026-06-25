import Link from "next/link";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { deliverBoxCode } from "@/lib/orders";
import { hasPurchaseAccess } from "@/lib/purchase-cookie";
import { resendForSession } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; resent?: string }>;
}) {
  const { session_id, resent } = await searchParams;

  let paid = false;
  let amountTotal: number | null = null;
  let currency = "eur";
  let qrSlug: string | undefined;
  let customerEmail: string | null = null;
  let accessCode: string | null = null;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = session.payment_status === "paid";
      amountTotal = session.amount_total;
      currency = session.currency ?? "eur";
      qrSlug = session.metadata?.qrSlug;
      customerEmail = session.customer_details?.email ?? null;

      if (paid) {
        // Fallback delivery (works even without a configured webhook).
        await deliverBoxCode(session);
        // On ne révèle le code qu'au navigateur qui a initié l'achat — pas à
        // quiconque détiendrait l'URL (le code ouvre une box physique).
        const boxId = session.metadata?.boxId;
        if (boxId && (await hasPurchaseAccess(session_id!))) {
          const box = await prisma.box.findUnique({
            where: { id: boxId },
            select: { accessCode: true },
          });
          accessCode = box?.accessCode ?? null;
        }
      }
    } catch {
      // Invalid or expired session id — fall through to the generic message.
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
          paid ? "bg-green-100 text-green-600" : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {paid ? "✓" : "…"}
      </div>

      {paid ? (
        <>
          <h1 className="text-2xl font-bold">Merci pour votre commande !</h1>
          <p className="text-neutral-600">
            Votre paiement
            {amountTotal != null && (
              <> de {formatPrice(amountTotal, currency)}</>
            )}{" "}
            a bien été reçu.
            {customerEmail && (
              <>
                {" "}
                Un reçu a été envoyé à{" "}
                <span className="font-medium">{customerEmail}</span>.
              </>
            )}
          </p>
          {accessCode && (
            <div className="w-full rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm font-medium text-green-700">
                Code pour ouvrir la boîte
              </p>
              <p className="mt-1 text-3xl font-bold tracking-widest text-green-800">
                {accessCode}
              </p>
            </div>
          )}
          <p className="text-sm text-neutral-500">
            Récupérez votre produit dans l&apos;Eskale Box de votre logement
            {customerEmail ? " (le code vous a aussi été envoyé par email)" : ""}.
          </p>

          {resent ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              Code renvoyé ✓ Pensez à vérifier vos spams.
            </p>
          ) : (
            session_id && (
              <form action={resendForSession}>
                <input type="hidden" name="sessionId" value={session_id} />
                <button
                  type="submit"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Je n&apos;ai pas reçu le code
                </button>
              </form>
            )
          )}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Paiement en cours de traitement</h1>
          <p className="text-neutral-600">
            Nous n&apos;avons pas pu confirmer votre paiement. Si vous avez été
            débité, votre commande sera bien prise en compte.
          </p>
        </>
      )}

      <Link
        href={qrSlug ? `/b/${qrSlug}` : "/"}
        className="mt-2 text-sm font-semibold text-accent hover:underline"
      >
        ← Retour à la boutique
      </Link>
    </main>
  );
}
