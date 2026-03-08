const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;

const BLOCKED_PRICE_ID_FRAGMENTS = ["placeholder", "unconfigured"];

export function isCheckoutEnabledStripePriceId(value: string) {
  const normalized = value.trim();
  if (!STRIPE_PRICE_ID_PATTERN.test(normalized)) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  return !BLOCKED_PRICE_ID_FRAGMENTS.some((fragment) => lowered.includes(fragment));
}
