import Link from "next/link";

import { auth } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
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
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            ZoKorp Platform
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-slate-700 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-950">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="text-sm text-slate-700">
          {session?.user?.email ? (
            <div className="flex items-center gap-3">
              <span className="hidden md:block">{session.user.email}</span>
              <Link
                href="/api/auth/signout?callbackUrl=/"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </Link>
            </div>
          ) : emailAuthConfigured ? (
            <Link
              href="/api/auth/signin"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
            >
              Sign in
            </Link>
          ) : (
            <span className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-500">
              Login setup pending
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
