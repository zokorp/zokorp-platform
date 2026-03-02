import "server-only";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  // Avoid initializing Stripe at import-time without keys.
  // Routes calling getStripeClient() will throw a clearer error.
}

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  });

  return stripeClient;
}
