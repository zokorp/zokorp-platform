import Link from "next/link";

import { type Organization, type OrganizationMember, type OrganizationRole } from "@prisma/client";

type MembershipWithOrg = OrganizationMember & {
  organization: Organization;
};

const navItems = [
  { href: "/mlops", label: "Overview" },
  { href: "/mlops/projects", label: "Projects" },
  { href: "/mlops/runs", label: "Runs" },
  { href: "/mlops/models", label: "Registry" },
  { href: "/mlops/deployments", label: "Deployments" },
  { href: "/mlops/monitoring", label: "Monitoring" },
  { href: "/mlops/settings/billing", label: "Billing" },
  { href: "/mlops/settings/organization", label: "Organization" },
];

function roleBadge(role: OrganizationRole) {
  if (role === "OWNER") {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (role === "ADMIN") {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  if (role === "MEMBER") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function withOrg(href: string, slug: string) {
  return `${href}?org=${encodeURIComponent(slug)}`;
}

export function MlopsShell(props: {
  activeHref: string;
  title: string;
  description: string;
  organization: Organization;
  membership: OrganizationMember;
  memberships: MembershipWithOrg[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { organization, memberships, membership } = props;

  return (
    <div className="space-y-6">
      <section className="hero-surface animate-fade-up rounded-3xl px-6 py-6 text-white md:px-8 md:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">ZoKorp MLOps</p>
            <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-white md:text-5xl">
              {props.title}
            </h1>
            <p className="mt-3 text-sm text-sky-50/95 md:text-base">{props.description}</p>
          </div>
          {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-semibold">
            Org: {organization.name}
          </span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-semibold">
            Persona: {membership.workspacePersona.replaceAll("_", " ")}
          </span>
          <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-semibold">
            Onboarding: {organization.onboardingMode.replaceAll("_", " ")}
          </span>
        </div>
      </section>

      <section className="glass-surface animate-fade-up delay-1 rounded-2xl p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {memberships.map((entry) => {
            const active = entry.organization.id === organization.id;
            return (
              <Link
                key={entry.id}
                href={withOrg("/mlops", entry.organization.slug)}
                className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {entry.organization.name}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${roleBadge(entry.role)}`}>
                  {entry.role}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <nav className="surface animate-fade-up delay-2 rounded-2xl p-2">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = props.activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={withOrg(item.href, organization.slug)}
                className={`focus-ring rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {props.children}
    </div>
  );
}
