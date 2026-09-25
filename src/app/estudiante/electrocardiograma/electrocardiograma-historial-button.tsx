"use client";

import { useState } from "react";
import { HistoryIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { HistoriaClinicalSplitViewer } from "@/components/historias/historia-clinical-summary";
import { Button } from "@/components/ui/button";

import { getElectrocardiogramaHistorial } from "./historial-actions";

type SummaryData = Awaited<ReturnType<typeof getElectrocardiogramaHistorial>>;

export function ElectrocardiogramaHistorialButton({ historiaId }: { historiaId: string }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function openHistorial() {
    if (data) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const summary = await getElectrocardiogramaHistorial(historiaId);
      setData(summary);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button disabled={loading} onClick={openHistorial} size="sm" type="button" variant="outline">
        {loading ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <HistoryIcon data-icon="inline-start" />}
        Historial
      </Button>
      {data ? (
        <HistoriaClinicalSplitViewer
          historia={data.historia}
          onOpenChange={setOpen}
          open={open}
          paciente={data.paciente}
          previousHistorias={data.previousHistorias}
          scope="complementarios"
          view="historial"
        />
      ) : null}
    </>
  );
}
