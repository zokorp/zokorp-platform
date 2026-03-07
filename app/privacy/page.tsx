import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Privacy",
  description: "How ZoKorp Platform collects, uses, and stores customer and prospect data.",
  path: "/privacy",
});

const sections = [
  {
    title: "What data ZoKorp collects",
    paragraphs: [
      "ZoKorp collects account information you provide, including name, business email address, and password-derived credentials for sign-in.",
      "The platform also collects billing context, service-request details, audit events, and product-usage data needed to provide access and support.",
      "If you upload architecture diagrams or validation inputs, ZoKorp processes those files to generate results and may archive related artifacts for internal delivery follow-up.",
    ],
  },
  {
    title: "How the data is used",
    paragraphs: [
      "ZoKorp uses collected data to authenticate users, authorize access, process purchases, deliver tool output, handle support requests, and improve platform operations.",
      "Billing information is processed through Stripe-hosted workflows. ZoKorp does not build a custom credit-card storage layer inside this application.",
      "If traffic analytics are enabled for the site, ZoKorp may collect page-view and traffic-source information to understand site performance and customer acquisition.",
    ],
  },
  {
    title: "Storage and service providers",
    paragraphs: [
      "Platform data is processed through hosted infrastructure and service providers used for application hosting, billing, email delivery, database access, and optional lead or document workflows.",
      "Where a tool flow uses external services such as Stripe or Zoho, the relevant workflow data may be transmitted to that service to complete the requested operation.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "Questions about privacy or data handling can be sent to zkhawaja@zokorp.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Privacy</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">Privacy overview</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          This page summarizes how ZoKorp Platform handles account, billing, and uploaded-workflow data.
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
