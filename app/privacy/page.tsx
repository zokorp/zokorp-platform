import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Privacy",
  description: "How ZoKorp Platform minimizes storage, delivers results by email, and handles opt-in follow-up data.",
  path: "/privacy",
});

const sections = [
  {
    title: "Default data posture",
    paragraphs: [
      "ZoKorp is designed for zero retention by default on diagnostic submissions. Tool inputs and generated reports are processed to produce the result email, then are not stored as part of the normal workflow.",
      "By default, ZoKorp stores only the account information needed to operate the platform, including your business email, verification state, password-auth credentials, billing records, support requests, and minimal audit or usage events.",
      "For free diagnostics, the default stored lead metadata is limited to the tool name, timestamp, delivery state, consent flags, and broad score or estimate bands needed to run the service and understand demand.",
    ],
  },
  {
    title: "Optional follow-up storage",
    paragraphs: [
      "Some tool forms offer an explicit opt-in to save the submission for follow-up. When you enable that option, ZoKorp stores an encrypted archive of the submission payload for up to 30 days so the work can be reviewed later.",
      "If you do not opt in, ZoKorp does not keep the detailed narrative, answers, diagrams, OCR text, or per-user report JSON after delivery processing completes.",
      "Short-lived duplicate protection may store a submission fingerprint hash for up to 15 minutes. The hash is used only to prevent accidental repeat sends and does not store the raw answers.",
    ],
  },
  {
    title: "Email, CRM, and service providers",
    paragraphs: [
      "ZoKorp uses hosted providers for application hosting, database access, authentication, billing, and email delivery. Stripe handles billing workflows, and ZoKorp does not build a custom credit-card storage layer inside this application.",
      "Diagnostic results are delivered to the verified account email used to run the tool. Operational result emails and future marketing follow-up are tracked separately in account email preferences.",
      "Optional CRM follow-up is off by default and only runs when you explicitly allow it on a submission.",
      "If you opt in to archival or CRM follow-up, the relevant workflow data may be transmitted to those providers to complete the requested operation.",
    ],
  },
  {
    title: "Forecasting beta data handling",
    paragraphs: [
      "The ZoKorp MLOps Foundation Platform is currently a forecasting beta. By default, uploaded forecasting files are processed to produce the result and supporting audit metadata, but the raw uploaded dataset is not treated as a long-term platform data warehouse.",
      "Live data connectors and broad persistent dataset storage are intentionally out of scope for the current beta launch.",
    ],
  },
  {
    title: "Retention enforcement and contact",
    paragraphs: [
      "ZoKorp runs scheduled cleanup to delete expired archives, remove duplicate-detection fingerprints, and scrub any legacy sensitive records that should no longer remain in storage.",
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
          This page summarizes how ZoKorp Platform handles account, billing, diagnostic, and optional follow-up data under a privacy-first storage policy.
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
