import Link from "next/link";

import { SoftwareCatalogShell } from "@/components/software-catalog-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CatalogUnavailableError, getSoftwareCatalogCached } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/site";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const metadata = buildPageMetadata({
  title: "Software",
  description: "Browse ZoKorp software products, pricing models, and account-linked access paths.",
  path: "/software",
});

const roadmapItems = [
  {
    title: "MLOps Foundation Platform",
    status: "Planned SaaS",
    summary:
      "A subdomain product for SMB teams that need practical MLOps workflows, governance checks, and lightweight deployment operations.",
    cta: "Track roadmap",
    href: "/account",
  },
  {
    title: "Architecture Diagram Reviewer",
    status: "Free tool",
    summary:
      "Upload a cloud architecture PNG or SVG and receive structured feedback on reliability, security, and operational readiness.",
    cta: "Open in catalog",
    href: "/software/architecture-diagram-reviewer",
  },
];

export default async function SoftwarePage() {
  let products: Awaited<ReturnType<typeof getSoftwareCatalogCached>> = [];
  let catalogUnavailable = false;

  try {
    products = await getSoftwareCatalogCached();
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      catalogUnavailable = true;
    } else {
      throw error;
    }
  }
  const activeProductBadge = catalogUnavailable ? "Catalog unavailable" : `${products.length} active products`;

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="hero-surface animate-fade-up overflow-hidden px-6 py-8 text-white md:px-8 md:py-10">
        <div className="pointer-events-none absolute -right-16 top-6 h-44 w-44 rounded-full border border-white/15 bg-white/10 blur-lg" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-teal-300/20 blur-3xl" />

        <Badge variant="brand" className="border-white/15 bg-white/12 text-white shadow-none">
          Software Hub
        </Badge>
        <h1 className="font-display mt-4 max-w-4xl text-balance text-4xl font-semibold md:text-5xl">
          Products, access, and billing in one place
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
          Purchase software, run tools, manage subscriptions, and track usage through a single account
          and Stripe-backed billing experience.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge className="bg-white/90 text-slate-800">{activeProductBadge}</Badge>
          <Badge className="bg-white/90 text-slate-800">Hosted checkout + portal</Badge>
          <Badge className="bg-white/90 text-slate-800">Entitlement-protected access</Badge>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "bg-white text-slate-950 hover:bg-slate-100")}>
            Review pricing
          </Link>
          <Link
            href="/services#service-request"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "border border-white/35 text-white hover:bg-white/10",
            )}
          >
            Request services
          </Link>
        </div>
      </section>

      {catalogUnavailable ? (
        <Alert tone="warning" className="rounded-2xl border-amber-200 bg-amber-50/70">
          <AlertTitle>Software catalog temporarily unavailable</AlertTitle>
          <AlertDescription>
            We could not load product data from the account catalog right now. Please retry shortly.
          </AlertDescription>
        </Alert>
      ) : (
        <SoftwareCatalogShell products={products} />
      )}

      <section className="surface soft-grid rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Roadmap</p>
            <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">Upcoming product surfaces</h2>
          </div>
          <Link href="/services#service-request" className={buttonVariants({ variant: "link" })}>
            Request priority access
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {roadmapItems.map((item) => (
            <Card key={item.title} lift className="rounded-3xl border border-slate-200 bg-white p-5">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.status}</p>
                <h3 className="font-display text-2xl font-semibold text-slate-900">{item.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">{item.summary}</p>
              </CardContent>
              <CardFooter>
                <Link href={item.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {item.cta}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
