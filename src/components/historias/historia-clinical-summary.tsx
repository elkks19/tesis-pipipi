import {
  ActivityIcon,
  ClipboardListIcon,
  FileCheck2Icon,
  FlaskConicalIcon,
  HeartPulseIcon,
  ScanLineIcon,
  StethoscopeIcon,
  WindIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Historia } from "@/lib/schema/historia";

type SummaryScope =
  | "examenFisicoGeneral"
  | "examenFisicoSegmentario"
  | "complementarios"
  | "diagnostico";

type HistoriaClinicalSummaryProps = {
  historia: Historia;
  scope: SummaryScope;
};

type SummaryItem = {
  label: string;
  value: string;
};

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "Sin registro";
  }

  return value ? "Si" : "No";
}

function formatNumber(value: number | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin registro";
  }

  return `${value}${suffix ? ` ${suffix}` : ""}`;
}

function formatText(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Sin registro";
  }

  return String(value);
}

function sectionIsVisible(section: SummaryScope, scope: SummaryScope) {
  const order: Record<SummaryScope, number> = {
    examenFisicoGeneral: 1,
    examenFisicoSegmentario: 2,
    complementarios: 3,
    diagnostico: 4,
  };

  return order[section] <= order[scope];
}

function getAnamnesisItems(historia: Historia): SummaryItem[] {
  const anamnesis = historia.anamnesis;

  if (!anamnesis) {
    return [];
  }

  return [
    { label: "Motivo", value: formatText(anamnesis.motivoConsulta) },
    {
      label: "Enfermedad actual",
      value: formatText(anamnesis.historiaEnfermedadActual),
    },
    { label: "Actividad fisica", value: formatBoolean(anamnesis.antecedentesNoPatologicos.realizaActividadFisica) },
    { label: "Tabaco", value: formatText(anamnesis.antecedentesNoPatologicos.habitoTabaquico) },
    { label: "Alcohol", value: formatText(anamnesis.antecedentesNoPatologicos.consumoAlcohol) },
    {
      label: "Antecedentes personales",
      value:
        anamnesis.antecedentesPatologicos.personales
          .map((item) => item.enfermedad.title || item.enfermedad.code)
          .filter(Boolean)
          .join(", ") || "Sin registro",
    },
    {
      label: "Antecedentes familiares",
      value:
        anamnesis.antecedentesPatologicos.familiares
          .map((item) => item.enfermedad.title || item.enfermedad.code)
          .filter(Boolean)
          .join(", ") || "Sin registro",
    },
  ];
}

function getGeneralItems(historia: Historia): SummaryItem[] {
  const examen = historia.examenFisicoGeneral;

  if (!examen) {
    return [];
  }

  return [
    {
      label: "PA derecha",
      value: `${formatNumber(examen.presionArterial.derecha.max, "mmHg")} / ${formatNumber(examen.presionArterial.derecha.min, "mmHg")}`,
    },
    {
      label: "PA izquierda",
      value: `${formatNumber(examen.presionArterial.izquierda.max, "mmHg")} / ${formatNumber(examen.presionArterial.izquierda.min, "mmHg")}`,
    },
    { label: "FC", value: formatNumber(examen.frecuenciaCardiaca, "lpm") },
    { label: "FR", value: formatNumber(examen.frecuenciaRespiratoria, "rpm") },
    { label: "Temperatura", value: formatNumber(examen.temperaturaAxilar, "C") },
    { label: "IMC", value: `${formatNumber(examen.imc)} - ${formatText(examen.diagnosticoIMC)}` },
  ];
}

function getSegmentarioItems(historia: Historia): SummaryItem[] {
  const examen = historia.examenFisicoSegmentario;

  if (!examen) {
    return [];
  }

  return [
    { label: "Cabeza", value: formatText(examen.cabeza) },
    { label: "Cuello", value: formatText(examen.cuello) },
    { label: "Respiratorio", value: formatText(examen.aparatoRespiratorio) },
    { label: "Cardiovascular", value: formatText(examen.aparatoCardiovascular) },
    { label: "Abdomen y pelvis", value: formatText(examen.abdomenPelvis) },
    { label: "Neurologico", value: formatText(examen.sistemaNerviosoCentral) },
  ];
}

function getComplementaryItems(historia: Historia): SummaryItem[] {
  const solicitudes = historia.examenesComplementariosSolicitados;

  return [
    {
      label: "Ecografia",
      value: [
        solicitudes?.ecografia ? "Solicitada" : "No solicitada",
        historia.ecografia?.higado.diagnostico
          ? `higado: ${historia.ecografia.higado.diagnostico}`
          : historia.ecografia
            ? "registrada"
            : "",
      ]
        .filter(Boolean)
        .join(" - "),
    },
    {
      label: "Laboratorios",
      value: [
        solicitudes?.laboratorios ? "Solicitados" : "No solicitados",
        historia.laboratorios
          ? `${historia.laboratorios.grupoSanguineo}, glicemia ${historia.laboratorios.glicemiaCapilar}`
          : "",
      ]
        .filter(Boolean)
        .join(" - "),
    },
    {
      label: "Espirometria",
      value: [
        solicitudes?.espirometria ? "Solicitada" : "No solicitada",
        historia.espirometria?.diagnostico ?? "",
      ]
        .filter(Boolean)
        .join(" - "),
    },
    {
      label: "Electrocardiograma",
      value: [
        solicitudes?.electrocardiograma ? "Solicitado" : "No solicitado",
        historia.electrocardiograma?.diagnostico ?? "",
      ]
        .filter(Boolean)
        .join(" - "),
    },
  ];
}

function getDiagnosticoItems(historia: Historia): SummaryItem[] {
  const diagnostico = historia.diagnostico;

  if (!diagnostico) {
    return [];
  }

  return [
    {
      label: "Principal",
      value: diagnostico.principal.title || diagnostico.principal.code,
    },
    {
      label: "Secundarios",
      value:
        diagnostico.secundarios
          .map((item) => item.title || item.code)
          .filter(Boolean)
          .join(", ") || "Sin registro",
    },
    { label: "Plan de trabajo", value: diagnostico.planTrabajo },
  ];
}

function SummarySection({
  emptyText,
  icon,
  items,
  title,
}: {
  emptyText: string;
  icon: ReactNode;
  items: SummaryItem[];
  title: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-2xl bg-muted">
          {icon}
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-muted/40 p-3" key={item.label}>
              <span className="text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
              <p className="line-clamp-3 text-sm leading-relaxed">
                {item.value || "Sin registro"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export function HistoriaClinicalSummary({
  historia,
  scope,
}: HistoriaClinicalSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
            <FileCheck2Icon />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Resumen de la historia</CardTitle>
            <CardDescription>
              Contexto registrado en estaciones previas para completar esta
              parte sin perder continuidad clinica.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SummarySection
          emptyText="Aun no hay anamnesis registrada para esta historia."
          icon={<ClipboardListIcon />}
          items={getAnamnesisItems(historia)}
          title="Anamnesis"
        />

        {sectionIsVisible("examenFisicoSegmentario", scope) ? (
          <>
            <Separator />
            <SummarySection
              emptyText="Aun no hay examen fisico general registrado."
              icon={<ActivityIcon />}
              items={getGeneralItems(historia)}
              title="Examen fisico general"
            />
          </>
        ) : null}

        {sectionIsVisible("complementarios", scope) ? (
          <>
            <Separator />
            <SummarySection
              emptyText="Aun no hay examen fisico segmentario registrado."
              icon={<StethoscopeIcon />}
              items={getSegmentarioItems(historia)}
              title="Examen fisico segmentario"
            />
            <Separator />
            <SummarySection
              emptyText="Aun no hay examenes complementarios registrados."
              icon={<ScanLineIcon />}
              items={getComplementaryItems(historia)}
              title="Examenes complementarios"
            />
          </>
        ) : null}

        {sectionIsVisible("diagnostico", scope) ? (
          <>
            <Separator />
            <div className="grid gap-3 md:grid-cols-3">
              <SummarySection
                emptyText="Sin electrocardiograma registrado."
                icon={<HeartPulseIcon />}
                items={
                  historia.electrocardiograma
                    ? [
                        {
                          label: "Diagnostico",
                          value: historia.electrocardiograma.diagnostico,
                        },
                        {
                          label: "Ritmo",
                          value: historia.electrocardiograma.ritmo,
                        },
                      ]
                    : []
                }
                title="Electrocardiograma"
              />
              <SummarySection
                emptyText="Sin espirometria registrada."
                icon={<WindIcon />}
                items={
                  historia.espirometria
                    ? [
                        {
                          label: "Diagnostico",
                          value: historia.espirometria.diagnostico,
                        },
                        {
                          label: "FEV1/FVC",
                          value: formatNumber(historia.espirometria.FEV1FVC),
                        },
                      ]
                    : []
                }
                title="Espirometria"
              />
              <SummarySection
                emptyText="Sin laboratorios registrados."
                icon={<FlaskConicalIcon />}
                items={
                  historia.laboratorios
                    ? [
                        {
                          label: "Grupo sanguineo",
                          value: historia.laboratorios.grupoSanguineo,
                        },
                        {
                          label: "Glicemia capilar",
                          value: historia.laboratorios.glicemiaCapilar,
                        },
                      ]
                    : []
                }
                title="Laboratorios"
              />
            </div>
            <Separator />
            <SummarySection
              emptyText="El diagnostico se registrara al finalizar esta estacion."
              icon={<FileCheck2Icon />}
              items={getDiagnosticoItems(historia)}
              title="Diagnostico"
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
