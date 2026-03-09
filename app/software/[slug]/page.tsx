import type { Metadata } from "next";
import Link from "next/link";
import { AccessModel, CreditTier, EntitlementStatus, PriceKind, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import { CheckoutButton } from "@/components/checkout-button";
import { CheckoutFlashBanner } from "@/components/checkout-flash-banner";
import { FreeToolAccessGate } from "@/components/free-tool-access-gate";
import { AiDeciderForm } from "@/components/ai-decider/AiDeciderForm";
import { ArchitectureDiagramReviewerForm } from "@/components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm";
import { LandingZoneReadinessCheckerForm } from "@/components/landing-zone-readiness/LandingZoneReadinessCheckerForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ToolPageLayout } from "@/components/ui/tool-page-layout";
import { ValidatorForm } from "@/components/validator-form";
import { auth } from "@/lib/auth";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { shouldHidePublicProductPricing } from "@/lib/billing-readiness";
import { CatalogUnavailableError, getProductBySlugCached } from "@/lib/catalog";
import { validatorPriceTierFromAmount, validatorProfileCreditsFromTiers, validatorTierLabel } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { buildPageMetadata } from "@/lib/site";
import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";
import { cn } from "@/lib/utils";
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
  creditTier?: CreditTier | null;
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

type Tone = "success" | "warning" | "info";

function getAccessModelLabel(accessModel: AccessModel) {
  switch (accessModel) {
    case AccessModel.FREE:
      return "Free";
    case AccessModel.ONE_TIME_CREDIT:
      return "Credit";
    case AccessModel.SUBSCRIPTION:
      return "Subscription";
    case AccessModel.METERED:
      return "Metered";
    default:
      return "Access";
  }
}

function entitlementMessage(input: {
  signedIn: boolean;
  authUnavailable: boolean;
  billingUnavailable: boolean;
  accessModel: AccessModel;
  entitlementStatus: EntitlementStatus | null;
  remainingUses: number;
  isTieredValidator?: boolean;
  requiresVerifiedFreeToolAccount?: boolean;
  publicPricingHidden?: boolean;
}): { tone: Tone; text: string } {
  if (input.authUnavailable) {
    return {
      tone: "warning",
      text: "Login setup is still in progress. Purchases and tool runs will unlock after authentication email delivery is connected.",
    };
  }

  if (input.publicPricingHidden) {
    return {
      tone: "info",
      text: "Subscription pricing for this product is still being finalized. Public checkout stays hidden until commercial terms are approved.",
    };
  }

  if (!input.signedIn && input.accessModel === AccessModel.FREE && input.requiresVerifiedFreeToolAccount) {
    return {
      tone: "info",
      text: "Sign in with your verified business email before running this diagnostic. Full consulting-style output is not sent to unverified inboxes.",
    };
  }

  if (!input.signedIn) {
    return {
      tone: "info",
      text: "Sign in first, then purchase the correct tier to unlock this tool.",
    };
  }

  if (input.billingUnavailable) {
    return {
      tone: "warning",
      text: "You are signed in. Billing is still being finalized in test mode, so checkout is temporarily unavailable.",
    };
  }

  if (input.accessModel === AccessModel.ONE_TIME_CREDIT) {
    if (input.entitlementStatus === EntitlementStatus.ACTIVE && input.remainingUses > 0) {
      if (input.isTieredValidator) {
        return {
          tone: "success",
          text: "Credits are active in one or more wallet tiers. Select a validation profile below to see exact usable credits.",
        };
      }

      return {
        tone: "success",
        text: `Access active. You currently have ${input.remainingUses} credit${input.remainingUses === 1 ? "" : "s"} available.`,
      };
    }

    return {
      tone: "warning",
      text: "No active credits found. Purchase a tier below to run this tool.",
    };
  }

  if (input.accessModel === AccessModel.FREE) {
    if (input.requiresVerifiedFreeToolAccount) {
      return {
        tone: input.signedIn ? "success" : "info",
        text: input.signedIn
          ? "This free diagnostic is active. Results are sent only to your signed-in verified business email."
          : "Sign in with your verified business email before running this diagnostic.",
      };
    }

    return {
      tone: "success",
      text: input.signedIn
        ? "This product is free to use. Sign-in keeps usage history and future account-linked settings."
        : "This product is free to use. Sign in if you want usage history and account-linked features.",
    };
  }

  if (input.entitlementStatus === EntitlementStatus.ACTIVE) {
    return { tone: "success", text: "Access active for this product." };
  }

  return { tone: "warning", text: "Purchase or subscribe to unlock this product." };
}

function accessBadgeVariant(accessModel: AccessModel): ComponentProps<typeof Badge>["variant"] {
  switch (accessModel) {
    case AccessModel.FREE:
      return "success";
    case AccessModel.ONE_TIME_CREDIT:
      return "warning";
    case AccessModel.SUBSCRIPTION:
      return "info";
    case AccessModel.METERED:
      return "brand";
    default:
      return "secondary";
  }
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
  let product = null;

  try {
    product = await getProductBySlugCached(slug);
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) {
      throw error;
    }
  }

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
  let product = null;
  let catalogUnavailable = false;

  try {
    product = await getProductBySlugCached(slug);
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      catalogUnavailable = true;
    } else {
      throw error;
    }
  }

  if (catalogUnavailable) {
    return (
      <div className="space-y-6">
        <Alert tone="warning" className="rounded-[calc(var(--radius-xl)+0.25rem)] border-amber-200 bg-amber-50/70">
          <AlertTitle>Product catalog temporarily unavailable</AlertTitle>
          <AlertDescription>
            We could not load this software product from the account catalog right now. Please retry shortly.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Link href="/software" className={buttonVariants()}>
            Return to software
          </Link>
          <Link href="/pricing" className={buttonVariants({ variant: "secondary" })}>
            View pricing
          </Link>
        </div>
      </div>
    );
  }

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
  const isAiDecider = product.slug === "ai-decider";
  const isArchitectureReviewer = product.slug === "architecture-diagram-reviewer";
  const isLandingZoneChecker = product.slug === "landing-zone-readiness-checker";
  const requiresVerifiedFreeToolAccount = isArchitectureReviewer || isAiDecider || isLandingZoneChecker;
  const productDescription = isArchitectureReviewer
    ? "Free cloud architecture diagram reviewer for PNG/SVG uploads with deterministic findings delivered to a verified business-email account."
    : isAiDecider
      ? "Free deterministic consulting diagnostic for SMB teams. Sign in with a verified business email, answer targeted follow-up questions, and receive the verdict, findings, and quote range by email."
    : isLandingZoneChecker
      ? "Free deterministic landing-zone assessment for SMB teams. Sign in with a verified business email, answer structured questions, and receive your score, top gaps, and consultation quote by email."
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
  const publicPricingHidden = shouldHidePublicProductPricing(product.accessModel);

  const authUnavailable = !authRuntimeReady;
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasRealStripePrice = displayPrices.some((price) => isCheckoutEnabledStripePriceId(price.stripePriceId));
  const billingUnavailable = publicPricingHidden || !stripeConfigured || !hasRealStripePrice;
  const requiresBilling = product.accessModel !== AccessModel.FREE;

  const message = entitlementMessage({
    signedIn,
    authUnavailable,
    billingUnavailable: requiresBilling ? billingUnavailable : false,
    accessModel: product.accessModel,
    entitlementStatus: entitlement?.status ?? null,
    remainingUses: entitlement?.remainingUses ?? 0,
    isTieredValidator: isValidator,
    requiresVerifiedFreeToolAccount,
    publicPricingHidden,
  });

  const shouldShowSignInCta =
    !signedIn &&
    !authUnavailable &&
    !publicPricingHidden &&
    (requiresBilling || requiresVerifiedFreeToolAccount);

  const checkoutState =
    query.checkout === "success" ? "success" : query.checkout === "cancelled" ? "cancelled" : null;

  const toolMeta = (
    <>
      <Badge variant={accessBadgeVariant(product.accessModel)}>{getAccessModelLabel(product.accessModel)}</Badge>
      <Badge variant="secondary">
        {signedIn
          ? "Verified account active"
          : requiresVerifiedFreeToolAccount
            ? "Verified account required"
            : "Account optional"}
      </Badge>
      {isValidator ? <Badge variant="outline">1 credit per run</Badge> : null}
      {isArchitectureReviewer ? <Badge variant="outline">Email-only review</Badge> : null}
      {isLandingZoneChecker ? <Badge variant="outline">Deterministic score</Badge> : null}
      {isAiDecider ? <Badge variant="outline">Verified delivery</Badge> : null}
      {!isValidator && !isArchitectureReviewer && !isLandingZoneChecker && !isAiDecider ? (
        <Badge variant="outline">Account-linked access</Badge>
      ) : null}
    </>
  );

  const pricingSection = (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Access Options</p>
        <h2 className="font-display text-3xl font-semibold text-slate-900">Pricing and entitlement path</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
          Choose the entitlement model for this tool, then launch it under the same account.
        </p>
      </div>

      {publicPricingHidden ? (
        <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Subscription rollout</p>
            <h3 className="font-display text-3xl font-semibold text-slate-900">Public subscription pricing is not live yet</h3>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              This product is still in pilot positioning. Public checkout is intentionally hidden until pricing, refund posture, and tax handling are approved for launch.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/services#service-request" className={buttonVariants()}>
              Request pilot access
            </Link>
            <Link href="/pricing" className={buttonVariants({ variant: "secondary" })}>
              Review approved pricing
            </Link>
          </CardFooter>
        </Card>
      ) : displayPrices.length > 0 ? (
        <div className={cn("grid gap-4", displayPrices.length === 1 ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {displayPrices.map((price) => (
            <Card key={price.id} lift className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {getPriceTitle(product.slug, price.amount, price.kind)}
                </p>
                <p className="font-display text-4xl font-semibold text-slate-900">
                  {formatAmount(price.amount, price.currency)}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  {price.kind === PriceKind.CREDIT_PACK
                    ? `Runs per purchase: ${price.creditsGranted}`
                    : "Billed through Stripe checkout"}
                </p>
                {product.slug === "zokorp-validator" && price.kind === PriceKind.CREDIT_PACK ? (
                  <p className="text-xs text-slate-500">
                    Wallet tier: {validatorTierLabel(getValidatorPriceTier(price))}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter>
                <CheckoutButton
                  productSlug={product.slug}
                  priceId={price.stripePriceId}
                  label="Checkout"
                  requiresAuth={!signedIn}
                  authUnavailable={authUnavailable}
                  billingUnavailable={
                    requiresBilling ? billingUnavailable || !isCheckoutEnabledStripePriceId(price.stripePriceId) : false
                  }
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone={product.accessModel === AccessModel.FREE ? "default" : "muted"} className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Default access</p>
            <h3 className="font-display text-3xl font-semibold text-slate-900">
              {product.accessModel === AccessModel.FREE ? "Free access" : "Pricing availability"}
            </h3>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {product.accessModel === AccessModel.FREE
                ? "No purchase is required for this product. Sign in when you want usage history and account-linked access management."
                : "Pricing for this software item is being finalized. Once Stripe prices are mapped, checkout will appear here automatically."}
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/pricing" className={buttonVariants({ variant: "secondary" })}>
              View pricing overview
            </Link>
          </CardFooter>
        </Card>
      )}
    </section>
  );

  const secondarySection = (
    <div className={cn("grid gap-4", isArchitectureReviewer ? "lg:grid-cols-[1.15fr_0.85fr]" : "md:grid-cols-2")}>
      {isArchitectureReviewer ? (
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Benchmark Library</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Compare recurring architecture patterns</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              Review anonymized provider patterns, monthly digests, and remediation snippets before submitting your own diagram.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/software/architecture-diagram-reviewer/benchmarks" className={buttonVariants()}>
              Open benchmark library
            </Link>
            <Link
              href="/software/architecture-diagram-reviewer/benchmarks/monthly"
              className={buttonVariants({ variant: "secondary" })}
            >
              View monthly digest
            </Link>
          </CardFooter>
        </Card>
      ) : null}

      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Need hands-on help?</p>
          <h2 className="font-display text-3xl font-semibold text-slate-900">Connect the tool to a scoped delivery engagement</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-slate-600">
            Use the software for quick validation or review, then move into architecture guidance, remediation, or implementation support without leaving the platform.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/services#service-request" className={buttonVariants()}>
            Request services
          </Link>
          <Link href="/support" className={buttonVariants({ variant: "secondary" })}>
            Contact support
          </Link>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <ToolPageLayout
      eyebrow="Software Tool"
      title={product.name}
      description={productDescription}
      meta={toolMeta}
      alert={
        <div className="space-y-3">
          <Alert tone={message.tone}>
            <AlertTitle>Access status</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
          <CheckoutFlashBanner state={checkoutState} />
        </div>
      }
      actions={
        <>
          {shouldShowSignInCta ? (
            <Link href={`/login?callbackUrl=/software/${product.slug}`} className={buttonVariants()}>
              Sign in to continue
            </Link>
          ) : null}
          <Link href="/account" className={buttonVariants({ variant: shouldShowSignInCta ? "secondary" : "primary" })}>
            {signedIn ? "Open account" : "View account access"}
          </Link>
        </>
      }
      pricing={pricingSection}
      bodyTitle={!isValidator && !isArchitectureReviewer && !isLandingZoneChecker && !isAiDecider ? "Tool workflow" : undefined}
      bodyDescription={
        !isValidator && !isArchitectureReviewer && !isLandingZoneChecker && !isAiDecider
          ? product.accessModel === AccessModel.FREE
            ? "This product is free to use today and can later connect to account-linked history and access controls."
            : "This product is configured for account-based access. Sign in, purchase access, then launch it from your account context."
          : undefined
      }
      secondary={secondarySection}
    >
      {isValidator ? (
        <ValidatorForm
          requiresAuth={!signedIn}
          authUnavailable={authUnavailable}
          validationTargets={validatorTargets}
          profileCredits={validatorProfileCredits}
        />
      ) : isArchitectureReviewer ? (
        <FreeToolAccessGate
          toolName="Architecture Diagram Reviewer"
          callbackPath={`/software/${product.slug}`}
          authRuntimeReady={authRuntimeReady}
          signedIn={signedIn}
          currentEmail={currentEmail}
          sampleHref="/software/architecture-diagram-reviewer/sample-report"
          sampleLabel="View sample report"
        >
          <ArchitectureDiagramReviewerForm />
        </FreeToolAccessGate>
      ) : isAiDecider ? (
        <FreeToolAccessGate
          toolName="AI Decider"
          callbackPath={`/software/${product.slug}`}
          authRuntimeReady={authRuntimeReady}
          signedIn={signedIn}
          currentEmail={currentEmail}
        >
          <AiDeciderForm
            initialEmail={currentEmail ?? ""}
            initialName={session?.user?.name ?? ""}
            lockedEmail={currentEmail ?? ""}
          />
        </FreeToolAccessGate>
      ) : isLandingZoneChecker ? (
        <FreeToolAccessGate
          toolName="Landing Zone Readiness Checker"
          callbackPath={`/software/${product.slug}`}
          authRuntimeReady={authRuntimeReady}
          signedIn={signedIn}
          currentEmail={currentEmail}
        >
          <LandingZoneReadinessCheckerForm
            initialEmail={currentEmail ?? ""}
            initialName={session?.user?.name ?? ""}
            lockedEmail={currentEmail ?? ""}
          />
        </FreeToolAccessGate>
      ) : (
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product workflow</p>
            <h3 className="font-display text-3xl font-semibold text-slate-900">Account-based launch path</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              {product.accessModel === AccessModel.FREE
                ? "This product is free. Sign in to keep usage history and access updates as the feature set expands."
                : "This product is configured for account-based access. Sign in, purchase access, then launch it from your account context."}
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/account" className={buttonVariants()}>
              Open account
            </Link>
          </CardFooter>
        </Card>
      )}
    </ToolPageLayout>
  );
}
