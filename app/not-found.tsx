import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card tone="glass" className="rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">404</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">This page is not here.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          The link may be outdated, or the page may have moved as the platform structure evolves.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/software" className={buttonVariants()}>
            Browse software
          </Link>
          <Link href="/services" className={buttonVariants({ variant: "secondary" })}>
            Browse services
          </Link>
        </div>
      </Card>
    </div>
  );
}
