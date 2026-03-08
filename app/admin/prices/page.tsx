import { PriceKind } from "@prisma/client";
import { redirect } from "next/navigation";

import { createPriceAction, togglePriceActiveAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login?callbackUrl=/admin/prices");
    }

    return (
      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <h1 className="font-display text-3xl font-semibold text-slate-900">Admin access required</h1>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Restricted page</AlertTitle>
            <AlertDescription>
              This page is restricted to ZoKorp admin accounts listed in <span className="font-mono">ZOKORP_ADMIN_EMAILS</span>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const [prices, products] = await Promise.all([
    db.price.findMany({
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Prices</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Attach Stripe price IDs to products, keep amount metadata tidy, and toggle price availability without touching checkout routes.
            </p>
          </div>
          <AdminNav current="prices" />
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Create price</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="info">
            <AlertTitle>Use real Stripe test-mode IDs</AlertTitle>
            <AlertDescription>
              Use the real Stripe <span className="font-mono">price_...</span> identifier from test mode.
            </AlertDescription>
          </Alert>

          <form action={createPriceAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Product</span>
              <Select name="productSlug" required>
                {products.map((product) => (
                  <option key={product.id} value={product.slug}>
                    {product.name} ({product.slug})
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stripe price ID</span>
              <Input name="stripePriceId" required placeholder="price_123..." />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Kind</span>
              <Select name="kind" defaultValue={PriceKind.CREDIT_PACK}>
                {Object.values(PriceKind).map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Amount (cents)</span>
              <Input name="amount" type="number" required min={1} placeholder="5000" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Credits granted</span>
              <Input name="creditsGranted" type="number" required min={0} defaultValue={1} />
            </label>
            <div className="flex items-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Existing prices</h2>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <p className="text-sm text-slate-600">No prices found.</p>
          ) : (
            <div className="space-y-3">
              {prices.map((price) => (
                <div
                  key={price.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-background-elevated/85 px-4 py-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{price.product.name}</span>
                      <Badge variant="secondary">{price.kind}</Badge>
                      <Badge variant={price.active ? "success" : "warning"}>
                        {price.active ? "Active" : "Inactive"}
                      </Badge>
                      {!isCheckoutEnabledStripePriceId(price.stripePriceId) ? (
                        <Badge variant="warning">Placeholder ID</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-700">${(price.amount / 100).toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{price.stripePriceId}</p>
                  </div>

                  <form action={togglePriceActiveAction}>
                    <input type="hidden" name="priceId" value={price.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className={cn(
                        price.active
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                      )}
                    >
                      {price.active ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
