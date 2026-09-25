import "server-only";

import { IdCardIcon, UserRoundIcon } from "lucide-react";

import { getPacienteById } from "@/app/estudiante/anamnesis/create-historia/queries";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";

export function PatientIdentityCard({
  paciente,
}: {
  paciente: PacienteSearchResult | null;
}) {
  const datos = paciente?.datosPersonales;
  const nombre = datos
    ? [datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno]
        .filter(Boolean)
        .join(" ")
    : "Paciente no disponible";

  return (
    <section aria-label="Paciente de esta atención" className="flex min-w-0 flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
        <UserRoundIcon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Paciente de esta atención</p>
        <h2 className="mt-0.5 break-words text-base font-semibold leading-snug">{nombre}</h2>
      </div>
      {datos ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-sm sm:border-l sm:border-t-0 sm:py-1 sm:pl-4">
          <span className="inline-flex items-center gap-1.5 font-medium"><IdCardIcon aria-hidden="true" className="size-4 text-muted-foreground" />{datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}</span>
          <span className="text-muted-foreground">{paciente.genero}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Revisa la historia antes de registrar datos.</p>
      )}
    </section>
  );
}

export async function PatientStationBanner({ pacienteId }: { pacienteId: string }) {
  const paciente = await getPacienteById(pacienteId);
  return <PatientIdentityCard paciente={paciente} />;
}
