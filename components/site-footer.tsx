import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const platformLinks = [
  { href: "/software", label: "Software" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" },
];

const resourceLinks = [
  { href: "/case-studies", label: "Case Studies" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-border/80 bg-white/72 backdrop-blur">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] md:px-6">
        <Card tone="glass" className="rounded-[1.4rem] p-6">
          <p className="font-display text-2xl font-semibold text-slate-900">ZoKorp</p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">
            AWS-focused AI delivery, validation software, and account-linked billing workflows for teams that need measurable execution.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="brand" className="normal-case tracking-normal">
              Houston-based
            </Badge>
            <Badge variant="secondary" className="normal-case tracking-normal">
              Serving U.S. teams
            </Badge>
          </div>
        </Card>

        <section className="space-y-3 rounded-[1.4rem] border border-border/80 bg-white/80 p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {platformLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-slate-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-[1.4rem] border border-border/80 bg-white/80 p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resources</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {resourceLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-slate-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-[1.4rem] border border-border/80 bg-white/80 p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trust and Support</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-slate-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-sm font-medium text-slate-700">zkhawaja@zokorp.com</p>
        </section>
      </div>
      <div className="section-divider mx-auto w-full max-w-7xl" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
        <p>ZoKorp Platform</p>
        <p>(C) {new Date().getFullYear()} ZoKorp. All rights reserved.</p>
      </div>
    </footer>
  );
}
