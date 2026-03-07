import { ServiceRequestStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { updateServiceRequestStatusAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TimelineCard } from "@/components/ui/timeline-card";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import {
  SERVICE_REQUEST_STATUS_LABEL,
  SERVICE_REQUEST_STATUS_STYLE,
  SERVICE_REQUEST_TYPE_LABEL,
} from "@/lib/service-requests";

export const dynamic = "force-dynamic";

async function getServiceRequests() {
  return db.serviceRequest.findMany({
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 80,
  });
}

export default async function AdminServiceRequestsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login?callbackUrl=/admin/service-requests");
    }

    return (
      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <h1 className="font-display text-3xl font-semibold text-slate-900">Admin access required</h1>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Restricted page</AlertTitle>
            <AlertDescription>
              This page is restricted to ZoKorp admin accounts listed in <span className="font-mono">ZOKORP_ADMIN_EMAILS</span>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  let requests: Awaited<ReturnType<typeof getServiceRequests>> | null = null;

  try {
    requests = await getServiceRequests();
  } catch (error) {
    if (!isSchemaDriftError(error)) {
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Service Requests</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Review the delivery queue, update customer-visible status, and keep request notes current inside user accounts.
            </p>
          </div>
          <AdminNav current="service-requests" />
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Request queue</h2>
          <p className="text-sm text-slate-600">Update request status and latest note shown in user accounts.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!requests ? (
            <Alert tone="warning">
              <AlertTitle>Schema not ready</AlertTitle>
              <AlertDescription>
                Service request schema is not migrated yet in this environment.
              </AlertDescription>
            </Alert>
          ) : null}

          {!requests || requests.length === 0 ? (
            <p className="text-sm text-slate-600">No service requests found.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <TimelineCard
                  key={request.id}
                  title={request.title}
                  meta={`${request.trackingCode} · ${SERVICE_REQUEST_TYPE_LABEL[request.type]} · ${request.user.email || "no-email"}`}
                  badge={
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SERVICE_REQUEST_STATUS_STYLE[request.status]}`}
                    >
                      {SERVICE_REQUEST_STATUS_LABEL[request.status]}
                    </span>
                  }
                  summary={request.summary}
                  footer={
                    <form action={updateServiceRequestStatusAction} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Select name="status" defaultValue={request.status}>
                        {Object.values(ServiceRequestStatus).map((status) => (
                          <option key={status} value={status}>
                            {SERVICE_REQUEST_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </Select>
                      <Input
                        name="latestNote"
                        defaultValue={request.latestNote || ""}
                        maxLength={240}
                        placeholder="Latest customer-visible update"
                      />
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                    </form>
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
