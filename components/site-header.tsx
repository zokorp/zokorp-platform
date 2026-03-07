import Link from "next/link";

import { SiteHeaderShell } from "@/components/site-header-shell";
import { auth } from "@/lib/auth";
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

export async function SiteHeader() {
  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);

  let session = null;
  if (authRuntimeReady) {
    try {
      session = await auth();
    } catch {
      session = null;
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/84 backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-brand-strong via-brand to-brand-accent px-4 py-1.5 text-center text-xs text-slate-100">
        Server-validated tools, account-linked billing, and AWS delivery workflows in one platform.
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6">
        <div className="relative flex items-center justify-between gap-4">
          <Link href="/" className="font-display inline-flex min-w-0 items-center gap-3 text-slate-900">
            <span className="inline-flex size-10 items-center justify-center rounded-xl border border-brand/15 bg-brand-soft shadow-[var(--shadow-soft)]">
              <span className="size-2.5 rounded-full bg-brand-accent shadow-[0_0_0_6px_rgba(15,142,169,0.14)]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-tight sm:text-xl">ZoKorp Platform</span>
              <span className="hidden text-xs uppercase tracking-[0.16em] text-slate-500 sm:block">AWS delivery and validation workspace</span>
            </span>
          </Link>

          <SiteHeaderShell
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
            isAdmin={session?.user?.role === "ADMIN"}
            userEmail={session?.user?.email ?? null}
            authRuntimeReady={authRuntimeReady}
          />
        </div>
      </div>
    </header>
  );
}
