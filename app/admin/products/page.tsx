import { AccessModel } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProductAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/api/auth/signin?callbackUrl=/admin/products");
  }

  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Admin: Products</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Product</h2>
        <form action={createProductAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="slug"
            required
            placeholder="slug (e.g. zokorp-validator)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="name"
            required
            placeholder="Product name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            required
            placeholder="Description"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            name="accessModel"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={AccessModel.FREE}
          >
            {Object.values(AccessModel).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Existing Products</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {products.map((product) => (
            <li key={product.id} className="rounded-md border border-slate-200 px-3 py-2">
              <span className="font-medium">{product.name}</span>
              <span className="ml-2 text-slate-500">/{product.slug}</span>
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">{product.accessModel}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
