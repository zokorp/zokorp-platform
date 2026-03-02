import { PriceKind } from "@prisma/client";
import { redirect } from "next/navigation";

import { createPriceAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/api/auth/signin?callbackUrl=/admin/prices");
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
      <h1 className="text-3xl font-semibold">Admin: Prices</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Price</h2>
        <form action={createPriceAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <select name="productSlug" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            {products.map((product) => (
              <option key={product.id} value={product.slug}>
                {product.name} ({product.slug})
              </option>
            ))}
          </select>
          <input
            name="stripePriceId"
            required
            placeholder="stripe price id"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="kind" className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={PriceKind.ONE_TIME}>
            {Object.values(PriceKind).map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <input
            name="amount"
            type="number"
            required
            min={1}
            placeholder="amount in cents"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="creditsGranted"
            type="number"
            required
            min={0}
            defaultValue={1}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Existing Prices</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {prices.map((price) => (
            <li key={price.id} className="rounded-md border border-slate-200 px-3 py-2">
              <span className="font-medium">{price.product.name}</span>
              <span className="ml-2 text-slate-500">{price.stripePriceId}</span>
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">{price.kind}</span>
              <span className="ml-2 text-slate-700">${(price.amount / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
