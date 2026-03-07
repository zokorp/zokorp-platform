import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Contact",
  description: "Contact ZoKorp for software, support, billing, or delivery conversations.",
  path: "/contact",
});

const contactPaths = [
  {
    title: "Software questions",
    detail: "Use this path for pricing, access, and product-fit questions before you buy.",
  },
  {
    title: "Service requests",
    detail: "Use this path when you need consulting, readiness support, or scoped delivery help.",
  },
  {
    title: "Billing or support",
    detail: "Use this path for account access issues, purchase questions, and follow-up support.",
  },
];

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <section className="glass-surface animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contact</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">Start the right conversation</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          ZoKorp uses one platform for software, billing, and service follow-up. The fastest contact path is still
          email, especially for scoped delivery or account questions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {contactPaths.map((item) => (
          <article key={item.title} className="surface lift-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="surface soft-grid rounded-2xl p-6 md:p-8">
        <h2 className="font-display text-3xl font-semibold text-slate-900">Primary contact</h2>
        <p className="mt-3 text-lg font-medium text-slate-900">zkhawaja@zokorp.com</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Include the product name, your company, and whether the message is about pricing, support, or delivery.
          That reduces back-and-forth and makes follow-up faster.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/services#service-request" className={buttonVariants()}>
            Request services
          </Link>
          <Link href="/software" className={buttonVariants({ variant: "secondary" })}>
            Browse software
          </Link>
        </div>
      </section>
    </div>
  );
}
