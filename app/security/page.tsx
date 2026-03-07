import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Security",
  description: "Current security posture and operational controls for ZoKorp Platform.",
  path: "/security",
});

const controls = [
  {
    title: "Verified account access",
    detail: "Business-email accounts must verify email ownership before sign-in or privileged access is enabled.",
  },
  {
    title: "Server-side authorization",
    detail: "Paid features, admin surfaces, and entitlement checks are enforced on the server rather than trusted to the client.",
  },
  {
    title: "Hosted billing",
    detail: "Checkout and billing management flow through Stripe-hosted surfaces instead of custom card handling inside the app.",
  },
  {
    title: "Input validation and upload controls",
    detail: "Untrusted input is validated with schemas and upload flows apply file-type, size, and route-specific checks.",
  },
  {
    title: "Audit visibility",
    detail: "Authentication, billing, and tool usage events are recorded in the platform audit trail for operational review.",
  },
  {
    title: "Security headers",
    detail: "The platform uses baseline browser protections including frame, content-type, referrer, and permissions controls.",
  },
];

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Security</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">Current platform security posture</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          ZoKorp focuses on practical controls that protect account access, billing actions, and uploaded inputs.
          This page describes the platform as it is implemented today, not a certification claim.
        </p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {controls.map((control) => (
          <article key={control.title} className="surface lift-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{control.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{control.detail}</p>
          </article>
        ))}
      </section>

      <Card className="soft-grid rounded-2xl p-6 md:p-8">
        <h2 className="font-display text-3xl font-semibold text-slate-900">Security contact</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Report suspected account abuse, access issues, or security concerns to
          <span className="font-medium text-slate-900"> zkhawaja@zokorp.com</span>. Include the affected account email,
          the product involved, and the behavior you observed.
        </p>
      </Card>
    </div>
  );
}
