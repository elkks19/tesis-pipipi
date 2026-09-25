"use client";

import { useState } from "react";
import { DownloadIcon, EyeIcon, HistoryIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { HistoriaClinicalSplitViewer } from "@/components/historias/historia-clinical-summary";
import { Button } from "@/components/ui/button";

import { getExamenSegmentarioSummary } from "./summary-actions";

type SummaryData = Awaited<ReturnType<typeof getExamenSegmentarioSummary>>;
type View = "historial" | "clinico";

export function ExamenSegmentarioQuickActions({
  hasClinicalDetail,
  historiaId,
  showPdf = false,
}: {
  hasClinicalDetail: boolean;
  historiaId: string;
  showPdf?: boolean;
}) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [view, setView] = useState<View>("historial");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<View | null>(null);

  async function openView(nextView: View) {
    if (data) {
      setView(nextView);
      setOpen(true);
      return;
    }

    setLoading(nextView);
    try {
      const summary = await getExamenSegmentarioSummary(historiaId);
      setData(summary);
      setView(nextView);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la historia.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={loading !== null} onClick={() => openView("historial")} size="sm" type="button" variant="outline">
          {loading === "historial" ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <HistoryIcon data-icon="inline-start" />}
          Historial
        </Button>
        {hasClinicalDetail ? (
          <Button disabled={loading !== null} onClick={() => openView("clinico")} size="sm" type="button" variant="outline">
            {loading === "clinico" ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
            Detalle clínico
          </Button>
        ) : null}
        {showPdf ? (
          <Button asChild size="sm" variant="outline">
            <a href={`/reportes/historias/${encodeURIComponent(historiaId)}?download=1`}>
              <DownloadIcon data-icon="inline-start" />Descargar PDF
            </a>
          </Button>
        ) : null}
      </div>
      {data ? (
        <HistoriaClinicalSplitViewer
          historia={data.historia}
          onOpenChange={setOpen}
          open={open}
          paciente={data.paciente}
          previousHistorias={data.previousHistorias}
          scope="examenFisicoSegmentario"
          view={view}
        />
      ) : null}
    </>
  );
}

