import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { PrivacyStance } from "@/components/marketing/privacy-stance";
import { Reveal } from "@/components/marketing/reveal";
import { SoftwareCatalogShell } from "@/components/software-catalog-shell";
import { CatalogUnavailableError, getSoftwareCatalogCached } from "@/lib/catalog";
import { buildMarketingPageMetadata } from "@/lib/site";

export const revalidate = 300;

export const metadata = buildMarketingPageMetadata({
  title: "Software",
  description: "Public software rows, product pricing, and shorter account-access guidance for ZoKorp tools.",
  path: "/software",
});

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

  return (
    <div className="marketing-stack">
      <section className="section-band overflow-hidden px-5 py-6 md:px-6 md:py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,29rem)] lg:items-start">
          <div className="space-y-5">
            <p className="enterprise-kicker">Software</p>
            <h1 className="font-display max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-foreground">
              Public products first.
            </h1>
            <p className="marketing-section-copy max-w-[40ch] text-base leading-7 text-muted-foreground">
              Browse before sign-up. Use an account only when history, billing, or protected actions matter.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/pricing" className={buttonVariants()}>
                View pricing
              </Link>
              <Link href="/contact" className={buttonVariants({ variant: "secondary" })}>
                Request help
              </Link>
              <Link href="/services" className={buttonVariants({ variant: "ghost" })}>
                See services
              </Link>
            </div>
          </div>

          <aside className="plane-dark rounded-[2.25rem] border border-white/8 px-5 py-5 md:px-6 md:py-6">
            <div className="space-y-4">
              <p className="enterprise-kicker" style={{ color: "rgba(255, 255, 255, 0.78)" }}>
                Access model
              </p>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-4 border-t border-white/12 pt-3 text-sm leading-6 text-white/84">
                  <span>Public products</span>
                  <span className="font-semibold">{catalogUnavailable ? "Unavailable" : `${products.length}`}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/12 pt-3 text-sm leading-6 text-white/84">
                  <span>Free browsing</span>
                  <span className="font-semibold">Yes</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/12 pt-3 text-sm leading-6 text-white/84">
                  <span>Account later</span>
                  <span className="font-semibold">When useful</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {catalogUnavailable ? (
        <Alert tone="warning" className="rounded-2xl border-amber-200 bg-amber-50/70">
          <AlertTitle>Software catalog temporarily unavailable</AlertTitle>
          <AlertDescription>We could not load product data from the catalog right now. Please retry shortly.</AlertDescription>
        </Alert>
      ) : (
        <SoftwareCatalogShell products={products} />
      )}

      <Reveal variant="copy">
        <PrivacyStance />
      </Reveal>
    </div>
  );
}
