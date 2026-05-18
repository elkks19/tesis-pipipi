import "server-only";

import { getPacienteById } from "@/app/estudiante/anamnesis/create-historia/queries";
import {
  HistoriaClinicalSummaryModal as ClientHistoriaClinicalSummaryModal,
} from "@/components/historias/historia-clinical-summary";
import type { Historia } from "@/lib/schema/historia";

type HistoriaClinicalSummaryModalProps = {
  historia: Historia;
  scope: "examenFisicoGeneral" | "examenFisicoSegmentario" | "complementarios" | "diagnostico";
  triggerLabel?: string;
};

export async function HistoriaClinicalSummaryModal({
  historia,
  scope,
  triggerLabel,
}: HistoriaClinicalSummaryModalProps) {
  const paciente = await getPacienteById(historia.pacienteId);

  return (
    <ClientHistoriaClinicalSummaryModal
      historia={historia}
      paciente={paciente ?? undefined}
      scope={scope}
      triggerLabel={triggerLabel}
    />
  );
}
