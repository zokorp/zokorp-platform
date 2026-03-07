import { type Metadata } from "next";

import { CloudCostLeakFinderForm } from "@/components/cloud-cost-leak-finder/CloudCostLeakFinderForm";
import { auth } from "@/lib/auth";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { buildPageMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Cloud Cost Leak Finder",
  description:
    "Free deterministic cloud cost diagnostic for SMB teams with emailed findings, likely savings range, and a consulting quote.",
  path: "/software/cloud-cost-leak-finder",
});

export default async function CloudCostLeakFinderPage() {
  const authRuntimeReady = isPasswordAuthEnabled() && Boolean(process.env.NEXTAUTH_SECRET);
  let session = null;

  if (authRuntimeReady) {
    try {
      session = await auth();
    } catch {
      session = null;
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <CloudCostLeakFinderForm initialEmail={session?.user?.email ?? ""} initialName={session?.user?.name ?? ""} />
    </div>
  );
}
