import Link from "next/link";
import { AccessModel, EntitlementStatus, PriceKind } from "@prisma/client";
import { notFound } from "next/navigation";

import { CheckoutButton } from "@/components/checkout-button";
import { ValidatorForm } from "@/components/validator-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProductBySlug } from "@/lib/catalog";

export const dynamic = "force-dynamic";

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
  accessModel: AccessModel;
  entitlementStatus: EntitlementStatus | null;
  remainingUses: number;
}): { tone: Tone; text: string } {
  if (input.authUnavailable) {
    return {
      tone: "amber",
      text: "Login setup is still in progress. Purchases and tool runs will unlock after authentication email delivery is connected.",
    };
  }

  if (!input.signedIn) {
    return {
      tone: "sky",
      text: "Sign in first, then purchase the correct tier to unlock this tool.",
    };
  }

  if (input.accessModel === AccessModel.ONE_TIME_CREDIT) {
    if (input.entitlementStatus === EntitlementStatus.ACTIVE && input.remainingUses > 0) {
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

export default async function SoftwareDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active) {
    notFound();
  }

  const emailAuthConfigured =
    Boolean(process.env.EMAIL_SERVER_HOST) &&
    Boolean(process.env.EMAIL_SERVER_PORT) &&
    Boolean(process.env.EMAIL_SERVER_USER) &&
    Boolean(process.env.EMAIL_SERVER_PASSWORD) &&
    Boolean(process.env.EMAIL_FROM);

  const session = await auth();
  const currentEmail = session?.user?.email;
  const signedIn = Boolean(currentEmail);

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

  const authUnavailable = !emailAuthConfigured;
  const isValidator = product.slug === "zokorp-validator";
  const message = entitlementMessage({
    signedIn,
    authUnavailable,
    accessModel: product.accessModel,
    entitlementStatus: entitlement?.status ?? null,
    remainingUses: entitlement?.remainingUses ?? 0,
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Software Tool</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">{product.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{product.description}</p>

        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${toneStyles[message.tone]}`}>
          {message.text}
        </div>

        {!signedIn && !authUnavailable ? (
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

      {product.prices.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {product.prices.map((price) => (
            <article key={price.id} className="surface rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {getPriceTitle(product.slug, price.amount, price.kind)}
              </p>
              <p className="mt-2 font-display text-4xl font-semibold text-slate-900">
                {formatAmount(price.amount, price.currency)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {price.kind === PriceKind.CREDIT_PACK
                  ? `Credits granted: ${price.creditsGranted}`
                  : "Billed through Stripe checkout"}
              </p>
              <div className="mt-4">
                <CheckoutButton
                  productSlug={product.slug}
                  priceId={price.stripePriceId}
                  label="Checkout"
                  requiresAuth={!signedIn}
                  authUnavailable={authUnavailable}
                />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {isValidator ? (
        <ValidatorForm requiresAuth={!signedIn} authUnavailable={authUnavailable} />
      ) : (
        <section className="surface rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Product workflow</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This product is configured for account-based access. Sign in, purchase access, then launch
            it from your account context.
          </p>
        </section>
      )}
    </div>
  );
}
