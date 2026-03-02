import { notFound } from "next/navigation";

import { CheckoutButton } from "@/components/checkout-button";
import { ValidatorForm } from "@/components/validator-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default async function SoftwareDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      prices: {
        where: { active: true },
        orderBy: { amount: "asc" },
      },
    },
  });

  if (!product || !product.active) {
    notFound();
  }

  const session = await auth();
  const currentEmail = session?.user?.email;

  const entitlement = currentEmail
    ? await db.entitlement.findFirst({
        where: {
          user: { email: currentEmail },
          productId: product.id,
        },
      })
    : null;

  const isValidator = product.slug === "zokorp-validator";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-slate-600">{product.description}</p>

        {entitlement ? (
          <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Access active. Remaining uses: {entitlement.remainingUses}
          </div>
        ) : (
          <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Purchase required to unlock this tool.
          </div>
        )}
      </section>

      {product.prices.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-3">
          {product.prices.map((price) => (
            <article key={price.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{price.kind}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatAmount(price.amount, price.currency)}
              </p>
              <p className="mt-1 text-sm text-slate-600">Credits granted: {price.creditsGranted}</p>
              <div className="mt-4">
                <CheckoutButton
                  productSlug={product.slug}
                  priceId={price.stripePriceId}
                  label="Checkout"
                />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {isValidator ? <ValidatorForm /> : null}
    </div>
  );
}
