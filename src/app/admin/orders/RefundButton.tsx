"use client";

import { refundOrder } from "../actions";

export function RefundButton({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  return (
    <form
      action={refundOrder}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Rembourser intégralement cette commande (${amountLabel}) ? Action irréversible côté Stripe.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
      >
        Rembourser
      </button>
    </form>
  );
}
