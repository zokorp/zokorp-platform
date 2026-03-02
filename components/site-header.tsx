import Link from "next/link";

import { auth } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/media", label: "Media" },
  { href: "/software", label: "Software" },
  { href: "/account", label: "Account" },
];

export async function SiteHeader() {
  const emailAuthConfigured =
    Boolean(process.env.EMAIL_SERVER_HOST) &&
    Boolean(process.env.EMAIL_SERVER_PORT) &&
    Boolean(process.env.EMAIL_SERVER_USER) &&
    Boolean(process.env.EMAIL_SERVER_PASSWORD) &&
    Boolean(process.env.EMAIL_FROM);

  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  return (
    <header className="border-b border-slate-300 bg-white/90 backdrop-blur">
      <div className="border-b border-slate-200 bg-slate-900 px-4 py-1.5 text-center text-xs text-slate-200">
        Building at app.zokorp.com while the main zokorp.com site stays live on Squarespace.
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:gap-8">
            <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              ZoKorp Platform
            </Link>

            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring rounded-full border border-transparent px-3 py-1.5 font-medium transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="text-sm text-slate-700">
            {session?.user?.email ? (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {session.user.email}
                </span>
                <Link
                  href="/api/auth/signout?callbackUrl=/"
                  className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Sign out
                </Link>
              </div>
            ) : emailAuthConfigured ? (
              <Link
                href="/login"
                className="focus-ring inline-flex rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white transition hover:bg-slate-800"
              >
                Sign in
              </Link>
            ) : (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-900">
                Login setup pending
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
