import "server-only";

import type { AdminAuditCategory, AdminAuditRow } from "@/lib/admin-audit";
import {
  addInstitutionalHeader,
  addPaginatedPdfTable,
  addPdfText,
  buildSimplePdf,
  createSimplePdfPage,
  type SimplePdfPage,
} from "@/lib/reports/simple-pdf";

const categoryLabels: Record<AdminAuditCategory, string> = {
  access: "Accesos",
  agent: "Agente inteligente",
  error: "Errores",
  sync: "Sincronización",
};

export function renderAuditReportPdf({
  category,
  filters,
  requestedBy,
  rows,
}: {
  category: AdminAuditCategory;
  filters: string;
  requestedBy: string;
  rows: AdminAuditRow[];
}) {
  const pages: SimplePdfPage[] = [];
  addPaginatedPdfTable(
    ["Fecha", "Evento", "Usuario", "Componente", "Detalle"],
    [86, 93, 92, 86, 154],
    rows.length
      ? rows.map((row) => [
          new Date(row.createdAt).toLocaleString("es-BO"),
          `${row.action} / ${row.status}`,
          row.actorName ?? row.actorEmail ?? row.actorId ?? "Sistema",
          `${row.component} / ${row.nodeId}`,
          row.message,
        ])
      : [["Sin eventos", "", "", "", "No existen registros para los filtros seleccionados."]],
    () => {
      const page = createSimplePdfPage();
      pages.push(page);
      let y = addInstitutionalHeader(page, `Auditoría · ${categoryLabels[category]}`);
      addPdfText(page, `Generado por: ${requestedBy}`, 42, y, 9);
      y -= 13;
      addPdfText(page, `Filtros: ${filters || "Sin filtros adicionales"}`, 42, y, 8, "0.35 0.38 0.42");
      y -= 18;
      return { page, y };
    },
  );
  return buildSimplePdf(pages);
}
