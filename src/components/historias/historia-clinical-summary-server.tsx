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
  scope:
    | "anamnesis"
    | "examenFisicoGeneral"
    | "examenFisicoSegmentario"
    | "complementarios"
    | "diagnostico";
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

  const historias: HistoriaDocument[] = [];
  const currentTime = historia.createdAt ? Date.parse(historia.createdAt) : Number.NaN;
  let bookmark: string | undefined;
  let scanned = 0;

  do {
    const result = await findTesisDocs({
      ...(bookmark ? { bookmark } : {}),
      limit: 50,
      selector: {
        pacienteId: historia.pacienteId,
        type: "historia",
      },
      use_index: "idx_historias_paciente",
    });

    for (const candidate of result.docs) {
      if (!isHistoriaDocument(candidate) || candidate._id === historia._id) continue;
      const candidateTime = candidate.createdAt ? Date.parse(candidate.createdAt) : Number.NaN;
      if (Number.isFinite(currentTime) && Number.isFinite(candidateTime) && candidateTime > currentTime) continue;
      historias.push(candidate);
    }

    scanned += result.docs.length;
    if (result.docs.length < 50 || !result.bookmark || result.bookmark === bookmark) break;
    bookmark = result.bookmark;
  } while (scanned < 1000);

  return historias
    .sort((left, right) => (Date.parse(right.createdAt ?? "") || 0) - (Date.parse(left.createdAt ?? "") || 0))
    .slice(0, 12);
}

export async function getHistoriaClinicalSummaryData(historia: HistoriaDocument) {
  const [paciente, previousHistorias] = await Promise.all([
    getPacienteById(historia.pacienteId),
    getPreviousHistorias(historia),
  ]);

  return { paciente: paciente ?? undefined, previousHistorias };
}

export async function HistoriaClinicalSummaryModal({
  historia,
  scope,
  triggerLabel,
}: HistoriaClinicalSummaryModalProps) {
  const historiaDocument = historia as HistoriaDocument;
  const { paciente, previousHistorias } = await getHistoriaClinicalSummaryData(historiaDocument);

  return (
    <ClientHistoriaClinicalSummaryModal
      historia={historia}
      paciente={paciente}
      previousHistorias={previousHistorias}
      scope={scope}
      triggerLabel={triggerLabel}
    />
  );
}
