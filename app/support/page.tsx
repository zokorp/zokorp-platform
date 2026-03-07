import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Support",
  description: "How to get support for account access, billing, and ZoKorp platform usage.",
  path: "/support",
});

const supportTopics = [
  {
    title: "Account access",
    detail: "Use support for sign-in issues, verification problems, or account access questions.",
  },
  {
    title: "Billing",
    detail: "Use support for checkout issues, invoice questions, or subscription management follow-up.",
  },
  {
    title: "Tool usage",
    detail: "Use support for upload problems, entitlement questions, or unexpected product behavior.",
  },
  {
    title: "Security concerns",
    detail: "Use support immediately for suspected account compromise or unexpected access behavior.",
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-8">
      <section className="hero-surface animate-fade-up px-6 py-9 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Support</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Support lives with the platform</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
          ZoKorp support covers account access, billing context, and product usage questions tied to the platform.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {supportTopics.map((topic) => (
          <article key={topic.title} className="surface lift-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{topic.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{topic.detail}</p>
          </article>
        ))}
      </section>

      <Card tone="glass" className="rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">How to contact support</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Email <span className="font-medium text-slate-900">zkhawaja@zokorp.com</span> with the product name,
          your account email, and a short description of the issue. For billing issues, include the product and
          purchase context. For security issues, mark the subject line as urgent.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/security" className={buttonVariants({ variant: "secondary" })}>
            Security overview
          </Link>
          <Link href="/contact" className={buttonVariants()}>
            Contact page
          </Link>
        </div>
      </Card>
    </div>
  );
}
