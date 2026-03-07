import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Terms",
  description: "Core platform terms for using ZoKorp software, services, and billing surfaces.",
  path: "/terms",
});

const sections = [
  {
    title: "Use of the platform",
    paragraphs: [
      "ZoKorp Platform is provided for legitimate business use related to software evaluation, purchase, service requests, and delivery operations.",
      "You are responsible for the accuracy of information you submit and for the activity that occurs under your account.",
    ],
  },
  {
    title: "Accounts and access",
    paragraphs: [
      "Business-email accounts must complete verification before platform access is activated.",
      "ZoKorp may suspend or restrict access where abuse, fraudulent activity, unauthorized access, or policy violations are detected.",
    ],
  },
  {
    title: "Billing and purchases",
    paragraphs: [
      "Pricing, subscriptions, and credit-based purchases are presented in the platform and processed through Stripe-hosted billing workflows.",
      "Access to paid software depends on successful payment, account status, and the entitlement model configured for the purchased product.",
    ],
  },
  {
    title: "Service requests",
    paragraphs: [
      "Submitting a service request does not create a guaranteed engagement or delivery commitment on its own. Scope, timing, and any paid work are finalized separately.",
    ],
  },
  {
    title: "Disclaimers",
    paragraphs: [
      "Unless otherwise agreed in writing, platform materials and tool outputs are provided on an as-is basis for operational guidance and workflow support.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Terms</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">Platform terms</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          These terms describe the core rules for using ZoKorp Platform.
        </p>
      </Card>

      <Card className="rounded-2xl p-6 md:p-8">
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-700 md:text-base">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
