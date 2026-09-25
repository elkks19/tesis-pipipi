"use client";

import { useState } from "react";
import { EyeIcon, HistoryIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { HistoriaClinicalSplitViewer } from "@/components/historias/historia-clinical-summary";
import { Button } from "@/components/ui/button";

import { getDiagnosticoHistorial } from "./historial-actions";

type SummaryData = Awaited<ReturnType<typeof getDiagnosticoHistorial>>;
type View = "historial" | "clinico";

export function DiagnosticoHistorialButton({ hasClinicalDetail = false, historiaId }: {
  hasClinicalDetail?: boolean;
  historiaId: string;
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
      const summary = await getDiagnosticoHistorial(historiaId);
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
      {data ? (
        <HistoriaClinicalSplitViewer
          historia={data.historia}
          onOpenChange={setOpen}
          open={open}
          paciente={data.paciente}
          previousHistorias={data.previousHistorias}
          scope="diagnostico"
          view={view}
        />
      ) : null}
    </>
  );
}
