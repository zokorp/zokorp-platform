import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <Card className="w-full rounded-[calc(var(--radius-xl)+0.25rem)] p-6 sm:p-8">
        <CardHeader className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">403 Forbidden</p>
          <h1 className="font-display text-4xl font-semibold text-slate-900">Admin access required</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            This workspace is limited to ZoKorp admin accounts listed in <span className="font-mono">ZOKORP_ADMIN_EMAILS</span>.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background-elevated px-4 py-2 font-medium text-slate-700 transition hover:bg-white"
          >
            Return home
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
          >
            Open account
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
