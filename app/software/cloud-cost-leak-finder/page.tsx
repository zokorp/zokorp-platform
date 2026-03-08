import { type Metadata } from "next";
import Link from "next/link";

import { CloudCostLeakFinderForm } from "@/components/cloud-cost-leak-finder/CloudCostLeakFinderForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ToolPageLayout } from "@/components/ui/tool-page-layout";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { buildPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Cloud Cost Leak Finder",
  description:
    "Free deterministic cloud cost diagnostic for SMB teams with emailed findings, likely savings range, and a consulting quote.",
  path: "/software/cloud-cost-leak-finder",
});

export default function CloudCostLeakFinderPage() {
  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);

  return (
    <ToolPageLayout
      eyebrow="Software Tool"
      title="Cloud Cost Leak Finder"
      description="Free deterministic cloud cost diagnostic for SMB teams with emailed findings, likely savings range, and a consulting quote."
      meta={
        <>
          <Badge variant="success">Free</Badge>
          <Badge variant="secondary">Business email delivery</Badge>
          <Badge variant="outline">Deterministic memo</Badge>
          <Badge variant="outline">Results by email</Badge>
        </>
      }
      alert={
        <Alert tone="info">
          <AlertTitle>Delivery model</AlertTitle>
          <AlertDescription>
            This checker is free. Enter a business email below, or sign in first to reuse your account details.
          </AlertDescription>
        </Alert>
      }
      actions={
        <>
          {authRuntimeReady ? (
            <Link href="/login?callbackUrl=/software/cloud-cost-leak-finder" className={buttonVariants()}>
              Sign in with business email
            </Link>
          ) : null}
          <Link href="/services#service-request" className={buttonVariants({ variant: authRuntimeReady ? "secondary" : "primary" })}>
            Request cost optimization help
          </Link>
        </>
      }
      pricing={
        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Access Options</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Free diagnostic, account-linked follow-up</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Run the diagnostic without payment, then move into consulting support if the memo surfaces savings worth pursuing.
            </p>
          </div>

          <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:max-w-xl">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Included today</p>
              <p className="font-display text-4xl font-semibold text-slate-900">$0</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                One guided diagnostic flow, deterministic scoring, savings range, and a scoped consulting quote delivered by email.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="#cloud-cost-tool" className={buttonVariants()}>
                Start diagnostic
              </Link>
            </CardFooter>
          </Card>
        </section>
      }
      secondary={
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What happens next</p>
              <h2 className="font-display text-3xl font-semibold text-slate-900">Use the memo to prioritize the first savings moves</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                The emailed output is designed to help you decide whether the waste is operational, architectural, or ownership-related before you commit to remediation.
              </p>
            </CardContent>
          </Card>

          <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Need a deeper review?</p>
              <h2 className="font-display text-3xl font-semibold text-slate-900">Turn findings into a scoped savings plan</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                If the memo shows meaningful savings potential, move into a scoped optimization engagement without re-entering your account context.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/services#service-request" className={buttonVariants()}>
                Book consultation
              </Link>
              <Link href="/support" className={buttonVariants({ variant: "secondary" })}>
                Contact support
              </Link>
            </CardFooter>
          </Card>
        </div>
      }
    >
      <div id="cloud-cost-tool">
        <CloudCostLeakFinderForm />
      </div>
    </ToolPageLayout>
  );
}
