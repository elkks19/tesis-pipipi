import "server-only";

import { getPacienteById } from "@/app/estudiante/anamnesis/create-historia/queries";
import {
  HistoriaClinicalSummaryModal as ClientHistoriaClinicalSummaryModal,
} from "@/components/historias/historia-clinical-summary";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Historia } from "@/lib/schema/historia";

type HistoriaClinicalSummaryModalProps = {
  historia: Historia;
  scope: "examenFisicoGeneral" | "examenFisicoSegmentario" | "complementarios" | "diagnostico";
  triggerLabel?: string;
};

type HistoriaDocument = Historia & {
  _id?: string;
};

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

async function getPreviousHistorias(
  historia: HistoriaDocument,
): Promise<HistoriaDocument[]> {
  if (!historia.pacienteId) {
    return [];
  }

  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 25,
    selector: {
      pacienteId: historia.pacienteId,
      type: "historia",
    },
    use_index: "idx_historias_paciente",
  });

  const historias: HistoriaDocument[] = [];

  for (const candidate of result.docs) {
    if (isHistoriaDocument(candidate) && candidate._id !== historia._id) {
      historias.push(candidate);
    }
  }

  return historias.slice(0, 12);
}

export async function HistoriaClinicalSummaryModal({
  historia,
  scope,
  triggerLabel,
}: HistoriaClinicalSummaryModalProps) {
  const historiaDocument = historia as HistoriaDocument;
  const [paciente, previousHistorias] = await Promise.all([
    getPacienteById(historia.pacienteId),
    getPreviousHistorias(historiaDocument),
  ]);

  return (
    <ClientHistoriaClinicalSummaryModal
      historia={historia}
      paciente={paciente ?? undefined}
      previousHistorias={previousHistorias}
      scope={scope}
      triggerLabel={triggerLabel}
    />
  );
}
