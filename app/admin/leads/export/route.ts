import { requireAdmin } from "@/lib/auth";
import { getLeadDirectory, renderLeadDirectoryCsv } from "@/lib/admin-leads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return new Response("Unauthorized", {
        status: error.message === "UNAUTHORIZED" ? 401 : 403,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    throw error;
  }

  const url = new URL(request.url);
  const directory = await getLeadDirectory(Object.fromEntries(url.searchParams.entries()));
  const csv = renderLeadDirectoryCsv(directory.entries);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zokorp-leads-${dateStamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
