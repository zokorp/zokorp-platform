import { AccessModel } from "@prisma/client";

import { createProductAction, toggleProductActiveAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function accessBadgeVariant(accessModel: AccessModel): "success" | "warning" | "info" | "brand" {
  switch (accessModel) {
    case AccessModel.FREE:
      return "success";
    case AccessModel.ONE_TIME_CREDIT:
      return "warning";
    case AccessModel.SUBSCRIPTION:
      return "info";
    case AccessModel.METERED:
      return "brand";
  }
}

export default async function AdminProductsPage() {
  await requireAdminPageAccess("/admin/products");

  const products = await db.product.findMany({
    include: {
      _count: {
        select: { prices: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Products</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Create catalog products, control access models, and activate or deactivate product visibility without changing the underlying billing logic.
            </p>
          </div>
          <AdminNav current="products" />
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Create product</h2>
        </CardHeader>
        <CardContent>
          <form action={createProductAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Slug</span>
              <Input name="slug" required placeholder="slug (e.g. zokorp-validator)" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Name</span>
              <Input name="name" required placeholder="Product name" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</span>
              <Textarea name="description" required placeholder="Description" className="min-h-28" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Access model</span>
              <Select name="accessModel" defaultValue={AccessModel.FREE}>
                {Object.values(AccessModel).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex items-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Existing products</h2>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-slate-600">No products found.</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-background-elevated/85 px-4 py-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{product.name}</span>
                      <Badge variant={accessBadgeVariant(product.accessModel)}>{product.accessModel}</Badge>
                      <Badge variant={product.active ? "success" : "warning"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">/{product.slug}</p>
                    <p className="text-xs text-slate-500">{product._count.prices} configured prices</p>
                  </div>

                  <form action={toggleProductActiveAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className={cn(
                        product.active
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                      )}
                    >
                      {product.active ? "Deactivate" : "Activate"}
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
