import Link from "next/link";

import { SiteHeaderShell } from "@/components/site-header-shell";
import { isPasswordAuthEnabled } from "@/lib/auth-config";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/software", label: "Software" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/account", label: "Account" },
];

const secondaryLinks = [
  { href: "/case-studies", label: "Case Studies" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);

  return (
    <header className="sticky top-0 z-40 border-b border-white/55 bg-white/76 shadow-[0_10px_24px_rgba(8,31,61,0.04)] backdrop-blur-2xl">
      <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(6,24,44,0.96),rgba(15,58,103,0.96),rgba(15,142,169,0.96))] px-4 py-1.5 text-center text-xs text-slate-100">
        Server-validated tools, account-linked billing, and AWS delivery workflows in one platform.
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-5">
        <div className="relative flex items-center justify-between gap-4">
          <Link href="/" className="font-display inline-flex min-w-0 items-center gap-3 text-slate-900">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/65 bg-[linear-gradient(160deg,rgba(247,251,255,0.95),rgba(223,236,251,0.92))] shadow-[0_1px_0_rgba(255,255,255,0.78)_inset,0_14px_28px_rgba(8,31,61,0.08)]">
              <span className="size-2.5 rounded-full bg-brand-accent shadow-[0_0_0_7px_rgba(15,142,169,0.12)]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-tight sm:text-xl">ZoKorp Platform</span>
              <span className="hidden text-xs uppercase tracking-[0.16em] text-slate-500 sm:block">
                AWS delivery and validation workspace
              </span>
            </span>
          </Link>

          <SiteHeaderShell
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
            isAdmin={false}
            userEmail={null}
            authRuntimeReady={authRuntimeReady}
          />
        </div>
      </div>
    </header>
  );
}
