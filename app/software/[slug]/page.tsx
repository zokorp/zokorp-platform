import type { Metadata } from "next";
import Link from "next/link";
import { AccessModel, CreditTier, EntitlementStatus, PriceKind, Prisma, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import { CheckoutButton } from "@/components/checkout-button";
import { CheckoutFlashBanner } from "@/components/checkout-flash-banner";
import { FreeToolAccessGate } from "@/components/free-tool-access-gate";
import { ArchitectureDiagramReviewerForm } from "@/components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm";
import { ForecastingWorkspace } from "@/components/mlops/ForecastingWorkspace";
import { ToolEngagementGuide } from "@/components/software/tool-engagement-guide";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ToolPageLayout } from "@/components/ui/tool-page-layout";
import { ValidatorForm } from "@/components/validator/ValidatorForm";
import { auth } from "@/lib/auth";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { shouldHidePublicProductPricing } from "@/lib/billing-readiness";
import { CatalogUnavailableError, getProductBySlugCached } from "@/lib/catalog";
import { validatorPriceTierFromAmount, validatorProfileCreditsFromTiers, validatorTierLabel } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { buildMarketingPageMetadata, toMarketingSiteUrl } from "@/lib/site";
import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";
import { getToolDefinition } from "@/lib/tool-registry";
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
  adminBypass?: boolean;
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

  if (input.adminBypass) {
    return {
      tone: "success",
      text:
        input.accessModel === AccessModel.ONE_TIME_CREDIT
          ? "Admin testing override active. This allowlisted verified account can run the paid tool without consuming credits."
          : "Admin access is active for this account.",
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

function buildToolEngagementGuide(input: {
  isArchitectureReviewer: boolean;
  isValidator: boolean;
  isMLOpsPlatform: boolean;
}) {
  if (input.isArchitectureReviewer) {
    return {
      title: "How it fits",
      deliveryTitle: "Results stay tied to a verified account",
      deliveryDescription:
        "Standard runs send the report to the signed-in verified business email. Privacy mode keeps files local first.",
      deliveryDetail:
        "Use the sample report first. Detailed results do not go to unverified inboxes.",
      serviceDescription:
        "Use this as the entry point. If the review shows a clear next step, move into scoped remediation or advisory.",
    };
  }

  if (input.isValidator) {
    return {
      title: "How it fits",
      deliveryTitle: "Validation results stay account-linked",
      deliveryDescription:
        "Validator runs return results on screen and keep the output tied to the account that used the credit.",
      deliveryDetail:
        "Public launch stays FTR-first. Deeper tracks stay gated.",
      serviceDescription:
        "Use findings to decide whether you need readiness work, a review, or a small implementation task.",
    };
  }

  if (input.isMLOpsPlatform) {
    return {
      title: "How it fits",
      deliveryTitle: "Forecasts are browser-first",
      deliveryDescription:
        "Forecasting beta runs return results in-browser first and log the run to account history.",
      deliveryDetail:
        "Use the workspace for repeat runs, then move to advisory only if a deeper question appears.",
      serviceDescription:
        "This stays a narrow beta. Move to advisory only when the result exposes a real infrastructure or planning question.",
    };
  }

  return {
    title: "How it fits",
    deliveryTitle: "Account-linked access",
    deliveryDescription:
      "This product keeps access, history, and follow-through tied to the same account.",
    deliveryDetail:
      "Use the software path first, then move into services only when the work is concrete enough to estimate.",
    serviceDescription:
      "ZoKorp uses software to narrow the work before selling human delivery.",
  };
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
    return buildMarketingPageMetadata({
      title: "Software",
      description: "Browse ZoKorp software products, pricing models, and account-linked access paths.",
      path: "/software",
    });
  }

  const toolDefinition = getToolDefinition(product.slug);

  return buildMarketingPageMetadata({
    title: toolDefinition?.displayName ?? product.name,
    description: toolDefinition?.productDescription ?? product.description,
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
          <Link href={toMarketingSiteUrl("/pricing")} className={buttonVariants({ variant: "secondary" })}>
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
  const isAdminTester = session?.user?.role === Role.ADMIN;
  const toolDefinition = getToolDefinition(product.slug);
  const isValidator = toolDefinition?.variant === "validator";
  const isArchitectureReviewer = toolDefinition?.variant === "architecture-reviewer";
  const isMLOpsPlatform = toolDefinition?.variant === "mlops-forecast-beta";
  const productDisplayName = toolDefinition?.displayName ?? product.name;
  const requiresVerifiedFreeToolAccount = toolDefinition?.requiresVerifiedFreeToolAccount ?? false;
  const productDescription = toolDefinition?.productDescription ?? product.description;
  const validatorTargets = isValidator
    ? getValidatorTargetOptions().filter((target) => isAdminTester || target.profile === "FTR")
    : [];
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
  const displayPrices = (
    pricesFromDb.length > 0 ? pricesFromDb : isValidator ? validatorFallbackPrices : []
  ).filter((price) => !isValidator || isAdminTester || getValidatorPriceTier(price) === CreditTier.FTR);
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
    adminBypass: isAdminTester && product.accessModel !== AccessModel.FREE,
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
        {isAdminTester
          ? "Admin override active"
          : signedIn
          ? "Verified account active"
          : requiresVerifiedFreeToolAccount
            ? "Verified account required"
            : "Account optional"}
      </Badge>
      {isValidator ? <Badge variant="outline">1 credit per run</Badge> : null}
      {isValidator && !isAdminTester ? <Badge variant="outline">FTR public launch</Badge> : null}
      {isArchitectureReviewer ? <Badge variant="outline">Email + privacy modes</Badge> : null}
      {isMLOpsPlatform ? <Badge variant="outline">Forecasting beta only</Badge> : null}
      {!isValidator && !isArchitectureReviewer && !isMLOpsPlatform ? (
        <Badge variant="outline">Account-linked access</Badge>
      ) : null}
    </>
  );
  const engagementGuide = buildToolEngagementGuide({
    isArchitectureReviewer,
    isValidator,
    isMLOpsPlatform,
  });

  const pricingSection = (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Access Options</p>
        <h2 className="font-display text-3xl font-semibold text-slate-900">Pricing</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
          Pick access, then run it.
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
              This product is still in pilot positioning. Public checkout stays hidden until launch terms are approved.
            </p>
          </CardContent>
          <CardFooter>
            <Link href={toMarketingSiteUrl("/contact")} className={buttonVariants()}>
              Request pilot access
            </Link>
            <Link href={toMarketingSiteUrl("/pricing")} className={buttonVariants({ variant: "secondary" })}>
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
                    : "Stripe checkout"}
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
              {product.accessModel === AccessModel.FREE ? "Free access" : "Launching soon"}
            </h3>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {product.accessModel === AccessModel.FREE
                ? "No purchase required. Sign in when you want history and account-linked access."
                : "We're finalizing pricing for this product. Leave a note and we'll email you when checkout opens."}
            </p>
          </CardContent>
          <CardFooter>
            {product.accessModel === AccessModel.FREE ? (
              <Link href={toMarketingSiteUrl("/pricing")} className={buttonVariants({ variant: "secondary" })}>
                View pricing overview
              </Link>
            ) : (
              <Link
                href={toMarketingSiteUrl(`/contact?topic=early-access&product=${product.slug}`)}
                className={buttonVariants()}
              >
                Notify me when this launches
              </Link>
            )}
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
              Review anonymized provider patterns, monthly digests, and remediation snippets before submitting your own diagram. The live scoring engine stays narrower than the full benchmark library until each provider rule set is fully calibrated.
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

      <ToolEngagementGuide
        title={engagementGuide.title}
        deliveryTitle={engagementGuide.deliveryTitle}
        deliveryDescription={engagementGuide.deliveryDescription}
        deliveryDetail={engagementGuide.deliveryDetail}
        serviceDescription={engagementGuide.serviceDescription}
        requestHref={toMarketingSiteUrl("/contact")}
        supportHref={toMarketingSiteUrl("/support")}
      />
    </div>
  );

  return (
    <ToolPageLayout
      eyebrow="Software Tool"
      title={productDisplayName}
      description={productDescription}
      descriptionAccent={
        isArchitectureReviewer ? (
          <>
            If the findings point to deeper gaps, a{" "}
            <Link
              href={toMarketingSiteUrl("/services#architecture-review")}
              className="underline decoration-slate-300 underline-offset-4 transition hover:text-brand"
            >
              full Architecture Review
            </Link>{" "}
            (written, $249) covers your actual infrastructure — not just a diagram.
          </>
        ) : undefined
      }
      meta={toolMeta}
      alert={
        <div className="space-y-3">
          <Alert tone={message.tone}>
            <AlertTitle>Access status</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
          {isValidator && !isAdminTester ? (
            <Alert tone="info">
              <AlertTitle>Public launch is FTR-first</AlertTitle>
              <AlertDescription>
                SDP, SRP, and Competency remain internal calibration tracks until their rulepacks, estimate logic, and customer output meet the same launch bar.
              </AlertDescription>
            </Alert>
          ) : null}
          <CheckoutFlashBanner state={checkoutState} />
        </div>
      }
      actions={
        <>
          {shouldShowSignInCta ? (
            <Link
              href={`/login?callbackUrl=/software/${product.slug}`}
              prefetch={false}
              className={buttonVariants()}
            >
              Sign in to continue
            </Link>
          ) : null}
          <Link
            href="/account"
            prefetch={false}
            className={buttonVariants({ variant: shouldShowSignInCta ? "secondary" : "primary" })}
          >
            {signedIn ? "Open account" : "View account access"}
          </Link>
        </>
      }
      pricing={pricingSection}
      bodyTitle={!isValidator && !isArchitectureReviewer && !isMLOpsPlatform ? "Tool workflow" : undefined}
      bodyDescription={
        !isValidator && !isArchitectureReviewer && !isMLOpsPlatform
          ? product.accessModel === AccessModel.FREE
            ? "This product is free to use today."
            : "This product uses account-based access."
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
          adminBypass={isAdminTester}
          allowExperimentalProfiles={isAdminTester}
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
          <ArchitectureDiagramReviewerForm accountEmail={currentEmail ?? null} />
        </FreeToolAccessGate>
      ) : isMLOpsPlatform ? (
        <ForecastingWorkspace
          signedIn={signedIn}
          currentEmail={currentEmail ?? null}
          hasAccess={entitlement?.status === EntitlementStatus.ACTIVE}
        />
      ) : (
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product workflow</p>
            <h3 className="font-display text-3xl font-semibold text-slate-900">Account-based launch path</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              {product.accessModel === AccessModel.FREE
                ? "This product is free. Sign in to keep history."
                : "Sign in, purchase access, then launch it from your account."}
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/account" prefetch={false} className={buttonVariants()}>
              Open account
            </Link>
          </CardFooter>
        </Card>
      )}
    </ToolPageLayout>
  );
}
