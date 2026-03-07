import type { Metadata } from "next";
import Link from "next/link";
import { AccessModel, CreditTier, EntitlementStatus, PriceKind, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

import { CheckoutButton } from "@/components/checkout-button";
import { CheckoutFlashBanner } from "@/components/checkout-flash-banner";
import { ArchitectureDiagramReviewerForm } from "@/components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm";
import { LandingZoneReadinessCheckerForm } from "@/components/landing-zone-readiness/LandingZoneReadinessCheckerForm";
import { ValidatorForm } from "@/components/validator-form";
import { auth } from "@/lib/auth";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { validatorPriceTierFromAmount, validatorProfileCreditsFromTiers, validatorTierLabel } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { getProductBySlug } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/site";
import { getValidatorTargetOptions } from "@/lib/validator-library";
import type { ValidationProfile } from "@/lib/zokorp-validator-engine";

export const dynamic = "force-dynamic";

type DisplayPrice = {
  id: string;
  stripePriceId: string;
  kind: PriceKind;
  amount: number;
  currency: string;
  creditsGranted: number;
  creditTier?: CreditTier;
  active?: boolean;
};

const validatorFallbackPrices: DisplayPrice[] = [
  {
    id: "fallback-ftr",
    stripePriceId: "unconfigured-ftr",
    kind: PriceKind.CREDIT_PACK,
    amount: 5000,
    currency: "usd",
    creditsGranted: 1,
    creditTier: CreditTier.FTR,
  },
  {
    id: "fallback-sdp-srp",
    stripePriceId: "unconfigured-sdp-srp",
    kind: PriceKind.CREDIT_PACK,
    amount: 15000,
    currency: "usd",
    creditsGranted: 1,
    creditTier: CreditTier.SDP_SRP,
  },
  {
    id: "fallback-competency",
    stripePriceId: "unconfigured-competency",
    kind: PriceKind.CREDIT_PACK,
    amount: 50000,
    currency: "usd",
    creditsGranted: 1,
    creditTier: CreditTier.COMPETENCY,
  },
];

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getPriceTitle(productSlug: string, amount: number, kind: PriceKind) {
  if (productSlug !== "zokorp-validator") {
    return kind.replaceAll("_", " ");
  }

  if (amount === 5000) {
    return "FTR - Single Run";
  }

  if (amount === 15000) {
    return "SDP/SRP - Single Run";
  }

  if (amount === 50000) {
    return "Competency - Single Run";
  }

  return kind.replaceAll("_", " ");
}

type Tone = "emerald" | "amber" | "sky";

function entitlementMessage(input: {
  signedIn: boolean;
  authUnavailable: boolean;
  billingUnavailable: boolean;
  accessModel: AccessModel;
  entitlementStatus: EntitlementStatus | null;
  remainingUses: number;
  isTieredValidator?: boolean;
  requiresSignInForFree?: boolean;
  emailOnlyFreeTool?: boolean;
}): { tone: Tone; text: string } {
  if (input.authUnavailable) {
    return {
      tone: "amber",
      text: "Login setup is still in progress. Purchases and tool runs will unlock after authentication email delivery is connected.",
    };
  }

  if (input.emailOnlyFreeTool) {
    return {
      tone: input.signedIn ? "emerald" : "sky",
      text: input.signedIn
        ? "This checker is free. Results are emailed to your business address unless you change it below."
        : "This checker is free. Enter a business email and the full report will be emailed to you.",
    };
  }

  if (!input.signedIn && input.accessModel === AccessModel.FREE && input.requiresSignInForFree) {
    return {
      tone: "sky",
      text: "Sign in with your business email to run this architecture review.",
    };
  }

  if (!input.signedIn) {
    return {
      tone: "sky",
      text: "Sign in first, then purchase the correct tier to unlock this tool.",
    };
  }

  if (input.billingUnavailable) {
    return {
      tone: "amber",
      text: "You are signed in. Billing is still being finalized in test mode, so checkout is temporarily unavailable.",
    };
  }

  if (input.accessModel === AccessModel.ONE_TIME_CREDIT) {
    if (input.entitlementStatus === EntitlementStatus.ACTIVE && input.remainingUses > 0) {
      if (input.isTieredValidator) {
        return {
          tone: "emerald",
          text: "Credits are active in one or more wallet tiers. Select a validation profile below to see exact usable credits.",
        };
      }

      return {
        tone: "emerald",
        text: `Access active. You currently have ${input.remainingUses} credit${input.remainingUses === 1 ? "" : "s"} available.`,
      };
    }

    return {
      tone: "amber",
      text: "No active credits found. Purchase a tier below to run this tool.",
    };
  }

  if (input.accessModel === AccessModel.FREE) {
    if (input.requiresSignInForFree) {
      return {
        tone: input.signedIn ? "emerald" : "sky",
        text: input.signedIn
          ? "Run the architecture review and the results will be emailed to your signed-in business address."
          : "Sign in with a business email before running this architecture review.",
      };
    }

    return {
      tone: "emerald",
      text: input.signedIn
        ? "This product is free to use. Sign-in keeps usage history and future account-linked settings."
        : "This product is free to use. Sign in if you want usage history and account-linked features.",
    };
  }

  if (input.entitlementStatus === EntitlementStatus.ACTIVE) {
    return { tone: "emerald", text: "Access active for this product." };
  }

  return { tone: "amber", text: "Purchase or subscribe to unlock this product." };
}

const toneStyles = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
} satisfies Record<Tone, string>;

function isRealStripePriceId(priceId: string) {
  return priceId.startsWith("price_");
}

function isSchemaDriftError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === "P2021" || error.code === "P2022";
}

function getValidatorPriceTier(price: DisplayPrice): CreditTier {
  if (price.creditTier) {
    return price.creditTier;
  }

  return validatorPriceTierFromAmount(price.amount);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return buildPageMetadata({
      title: "Software",
      description: "Browse ZoKorp software products, pricing models, and account-linked access paths.",
      path: "/software",
    });
  }

  return buildPageMetadata({
    title: product.name,
    description: product.description,
    path: `/software/${product.slug}`,
  });
}

export default async function SoftwareDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const product = await getProductBySlug(slug);

  if (!product || !product.active) {
    notFound();
  }

  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);
  let session = null;
  if (authRuntimeReady) {
    try {
      session = await auth();
    } catch {
      session = null;
    }
  }
  const currentEmail = session?.user?.email;
  const signedIn = Boolean(currentEmail);
  const isValidator = product.slug === "zokorp-validator";
  const isArchitectureReviewer = product.slug === "architecture-diagram-reviewer";
  const isLandingZoneChecker = product.slug === "landing-zone-readiness-checker";
  const productDescription = isArchitectureReviewer
    ? "Free cloud architecture diagram reviewer for PNG/SVG uploads with deterministic findings delivered by email."
    : isLandingZoneChecker
      ? "Free deterministic landing-zone assessment for SMB teams. Answer structured questions and receive your score, top gaps, and consultation quote by email."
    : product.description;
  const validatorTargets = isValidator ? getValidatorTargetOptions() : [];
  let validatorProfileCredits: Record<ValidationProfile, number> = {
    FTR: 0,
    SDP: 0,
    SRP: 0,
    COMPETENCY: 0,
  };

  let entitlement: { status: EntitlementStatus; remainingUses: number } | null = null;
  if (currentEmail) {
    try {
      entitlement = await db.entitlement.findFirst({
        where: {
          user: { email: currentEmail },
          productId: product.id,
        },
        select: {
          status: true,
          remainingUses: true,
        },
      });
    } catch {
      entitlement = null;
    }
  }

  if (isValidator && currentEmail) {
    try {
      const balances = await db.creditBalance.findMany({
        where: {
          user: { email: currentEmail },
          productId: product.id,
          status: EntitlementStatus.ACTIVE,
          tier: {
            in: [CreditTier.FTR, CreditTier.SDP_SRP, CreditTier.COMPETENCY, CreditTier.GENERAL],
          },
        },
        select: {
          tier: true,
          remainingUses: true,
        },
      });

      const totalsByTier: Partial<Record<CreditTier, number>> = {};
      for (const balance of balances) {
        totalsByTier[balance.tier] = (totalsByTier[balance.tier] ?? 0) + balance.remainingUses;
      }

      const profileCredits = validatorProfileCreditsFromTiers(totalsByTier);
      const general = totalsByTier[CreditTier.GENERAL] ?? 0;

      validatorProfileCredits = {
        FTR: profileCredits.FTR + general,
        SDP: profileCredits.SDP + general,
        SRP: profileCredits.SRP + general,
        COMPETENCY: profileCredits.COMPETENCY + general,
      };
    } catch (error) {
      if (!isSchemaDriftError(error)) {
        throw error;
      }

      const fallback = entitlement?.remainingUses ?? 0;
      validatorProfileCredits = {
        FTR: fallback,
        SDP: fallback,
        SRP: fallback,
        COMPETENCY: fallback,
      };
    }
  }

  const pricesFromDb = product.prices.filter((price) => price.active !== false);
  const displayPrices =
    pricesFromDb.length > 0 ? pricesFromDb : isValidator ? validatorFallbackPrices : [];

  const authUnavailable = !isPasswordAuthEnabled();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasRealStripePrice = displayPrices.some((price) => isRealStripePriceId(price.stripePriceId));
  const billingUnavailable = !stripeConfigured || !hasRealStripePrice;
  const requiresBilling = product.accessModel !== AccessModel.FREE;

  const message = entitlementMessage({
    signedIn,
    authUnavailable,
    billingUnavailable: requiresBilling ? billingUnavailable : false,
    accessModel: product.accessModel,
    entitlementStatus: entitlement?.status ?? null,
    remainingUses: entitlement?.remainingUses ?? 0,
    isTieredValidator: isValidator,
    requiresSignInForFree: isArchitectureReviewer,
    emailOnlyFreeTool: isLandingZoneChecker,
  });

  const shouldShowSignInCta =
    !signedIn &&
    !authUnavailable &&
    (requiresBilling || isArchitectureReviewer);

  const checkoutState =
    query.checkout === "success" ? "success" : query.checkout === "cancelled" ? "cancelled" : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="glass-surface animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Software Tool</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">{product.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{productDescription}</p>

        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${toneStyles[message.tone]}`}>
          {message.text}
        </div>

        <CheckoutFlashBanner state={checkoutState} />

        {shouldShowSignInCta ? (
          <div className="mt-4">
            <Link
              href={`/login?callbackUrl=/software/${product.slug}`}
              className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in to continue
            </Link>
          </div>
        ) : null}
      </section>

      {displayPrices.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {displayPrices.map((price) => (
            <article key={price.id} className="surface lift-card rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {getPriceTitle(product.slug, price.amount, price.kind)}
              </p>
              <p className="mt-2 font-display text-4xl font-semibold text-slate-900">
                {formatAmount(price.amount, price.currency)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {price.kind === PriceKind.CREDIT_PACK
                  ? `Runs per purchase: ${price.creditsGranted}`
                  : "Billed through Stripe checkout"}
              </p>
              {product.slug === "zokorp-validator" && price.kind === PriceKind.CREDIT_PACK ? (
                <p className="mt-1 text-xs text-slate-500">
                  Wallet tier: {validatorTierLabel(getValidatorPriceTier(price))}
                </p>
              ) : null}
              <div className="mt-4">
                <CheckoutButton
                  productSlug={product.slug}
                  priceId={price.stripePriceId}
                  label="Checkout"
                  requiresAuth={!signedIn}
                  authUnavailable={authUnavailable}
                  billingUnavailable={
                    requiresBilling
                      ? billingUnavailable || !isRealStripePriceId(price.stripePriceId)
                      : false
                  }
                />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="surface-muted rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Pricing availability</h2>
          {product.accessModel === AccessModel.FREE ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              No purchase is required for this product. Sign in for account-linked usage history and
              access management as this tool evolves.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Pricing for this software item is being finalized. Once Stripe prices are mapped, checkout
              will appear here automatically.
            </p>
          )}
        </section>
      )}

      {isValidator ? (
        <ValidatorForm
          requiresAuth={!signedIn}
          authUnavailable={authUnavailable}
          validationTargets={validatorTargets}
          profileCredits={validatorProfileCredits}
        />
      ) : isArchitectureReviewer ? (
        <ArchitectureDiagramReviewerForm requiresAuth={!signedIn} authUnavailable={authUnavailable} />
      ) : isLandingZoneChecker ? (
        <LandingZoneReadinessCheckerForm initialEmail={currentEmail ?? ""} initialName={session?.user?.name ?? ""} />
      ) : (
        <section className="surface lift-card rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Product workflow</h2>
          {product.accessModel === AccessModel.FREE ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This product is free. Sign in to keep usage history and access updates as the feature set
              expands.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This product is configured for account-based access. Sign in, purchase access, then launch
              it from your account context.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
