import { headers } from "next/headers";

import { auditQuerySchema } from "@/app/api/admin/audit/route";
import { fetchAdminAuditExport, type AdminAuditFilters } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";
import { renderAuditReportPdf } from "@/lib/reports/audit-report-pdf";
import { canAccessAdmin, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ message: "No autenticado." }, { status: 401 });
  if (!canAccessAdmin(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = auditQuerySchema.omit({ cursor: true, limit: true }).safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ message: "Filtros inválidos." }, { status: 400 });
  const filters = parsed.data as AdminAuditFilters;
  const rows = await fetchAdminAuditExport(filters);
  const filterLabel = [...url.searchParams.entries()]
    .filter(([key]) => key !== "category")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  const pdf = renderAuditReportPdf({
    category: filters.category,
    filters: filterLabel,
    requestedBy: session.user.name || session.user.email,
    rows,
  });
  return new Response(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="auditoria-${filters.category}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
