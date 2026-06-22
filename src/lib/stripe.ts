import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // Surfaced at call time rather than import time so the rest of the app
  // (browsing a box) keeps working without Stripe keys during local dev.
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set — checkout will fail until it is configured."
  );
}

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});
