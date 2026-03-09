import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

type FreeToolAccessGateProps = {
  toolName: string;
  callbackPath: string;
  authRuntimeReady: boolean;
  signedIn: boolean;
  currentEmail?: string | null;
  sampleHref?: string;
  sampleLabel?: string;
  children: ReactNode;
};

export function FreeToolAccessGate({
  toolName,
  callbackPath,
  authRuntimeReady,
  signedIn,
  currentEmail,
  sampleHref,
  sampleLabel = "View sample output",
  children,
}: FreeToolAccessGateProps) {
  if (!authRuntimeReady) {
    return (
      <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Verified Free-Tool Access</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">{toolName}</h3>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Business-email verification is temporarily unavailable</AlertTitle>
            <AlertDescription>
              Sign-in is not configured correctly in this environment yet, so this tool is paused instead of sending results to an unverified inbox.
            </AlertDescription>
          </Alert>
        </CardContent>
        {sampleHref ? (
          <CardFooter>
            <Link href={sampleHref} className={buttonVariants({ variant: "secondary" })}>
              {sampleLabel}
            </Link>
          </CardFooter>
        ) : null}
      </Card>
    );
  }

  if (!signedIn) {
    return (
      <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Verified Free-Tool Access</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">Verified business-email account required</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="info">
            <AlertTitle>Full results are sent only to a verified account</AlertTitle>
            <AlertDescription>
              ZoKorp sends free diagnostic output only to the signed-in verified business-email account that owns the run. This prevents advisory results from being delivered to an unverified inbox and keeps account history tied to one owner.
            </AlertDescription>
          </Alert>
          {sampleHref ? (
            <p className="text-sm leading-6 text-slate-600">
              You can still review a sample report without signing in before you decide to run your own upload.
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackPath)}`} className={buttonVariants()}>
            Sign in to continue
          </Link>
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackPath)}`} className={buttonVariants({ variant: "secondary" })}>
            Create verified account
          </Link>
          {sampleHref ? (
            <Link href={sampleHref} className={buttonVariants({ variant: "secondary" })}>
              {sampleLabel}
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert tone="success">
        <AlertTitle>Verified account active</AlertTitle>
        <AlertDescription>
          Signed in as {currentEmail ?? "your verified business email"}. {toolName} will deliver results only to this verified address.
        </AlertDescription>
      </Alert>
      {children}
    </div>
  );
}
