import Image from "next/image";
import Link from "next/link";

import { SiteHeaderShell } from "@/components/site-header-shell";
import { auth } from "@/lib/auth";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { getConsultationCta } from "@/lib/marketing-cta";
import { PUBLIC_LAUNCH_FOUNDER_PROFILE } from "@/lib/public-launch-contract";
import { getAppSiteUrl } from "@/lib/site";

const primaryLinks = [
  { href: "/services", label: "Services" },
  { href: "/software", label: "Software" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/contact", label: "Contact" },
];

const secondaryLinks = [
  { href: "/media", label: "Insights" },
  { href: "/support", label: "Support" },
  { href: `${getAppSiteUrl()}/account`, label: "Account" },
];

export async function SiteHeader() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);
  const appSiteUrl = getAppSiteUrl();
  const primaryCta = getConsultationCta({
    signedIn,
    utmMedium: "header",
  });

  return (
    <header className="sticky top-0 z-50 isolate border-b border-[rgb(var(--z-border)/0.28)] bg-[rgba(247,250,253,0.82)] backdrop-blur-xl">
      <div className="marketing-container px-4 py-4 md:px-6 xl:px-8">
        <div className="relative z-10 flex items-center justify-between gap-4 border-b border-border/70 py-3">
          <Link href="/" className="font-display inline-flex min-w-0 items-center gap-3 text-[rgb(var(--z-ink))]">
            <span className="flex items-center">
              <Image
                src={PUBLIC_LAUNCH_FOUNDER_PROFILE.logoPath}
                alt="ZoKorp"
                width={983}
                height={316}
                className="h-12 w-auto"
                sizes="(max-width: 768px) 128px, 160px"
                priority
              />
            </span>
          </Link>

          <SiteHeaderShell
            primaryLinks={primaryLinks}
            secondaryLinks={secondaryLinks}
            authRuntimeReady={authRuntimeReady}
            primaryCtaHref={primaryCta.href}
            primaryCtaLabel={primaryCta.label}
            primaryCtaExternal={primaryCta.external}
            loginHref={`${appSiteUrl}/login?callbackUrl=/software`}
            registerHref={`${appSiteUrl}/register`}
            signedIn={signedIn}
          />
        </div>
      </div>
    </header>
  );
}
