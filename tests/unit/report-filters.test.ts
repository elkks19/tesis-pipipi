import { describe, expect, it } from "vitest";
import { reportDateRangeSchema, reportPeriodLabel, withinReportDates } from "@/lib/reports/report-filters";

describe("fechas de reportes", () => {
  it("incluye ambos días usando la fecha local de Bolivia", () => {
    const range = { from: "2026-09-29", to: "2026-09-29" };
    expect(withinReportDates("2026-09-29T03:59:59Z", range)).toBe(false);
    expect(withinReportDates("2026-09-29T04:00:00Z", range)).toBe(true);
    expect(withinReportDates("2026-09-30T03:59:59Z", range)).toBe(true);
    expect(withinReportDates("2026-09-30T04:00:00Z", range)).toBe(false);
  });
  it("rechaza días inexistentes y rangos invertidos", () => {
    expect(reportDateRangeSchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(reportDateRangeSchema.safeParse({ from: "2026-10-01", to: "2026-09-29" }).success).toBe(false);
    expect(reportDateRangeSchema.safeParse({ from: "2024-02-29" }).success).toBe(true);
  });
  it("permite límites abiertos y no atribuye fecha a registros sin fecha", () => {
    expect(withinReportDates("", {})).toBe(true);
    expect(withinReportDates("", { from: "2026-01-01" })).toBe(false);
    expect(withinReportDates("2026-09-29", { to: "2026-09-29" })).toBe(true);
    expect(reportPeriodLabel({ from: "2026-09-01", to: "2026-09-29" })).toBe("01/09/2026 al 29/09/2026");
  });
});
