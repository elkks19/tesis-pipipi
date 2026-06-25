"use client";

import { useState } from "react";
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  EyeIcon,
  FileCheck2Icon,
  FileTextIcon,
  FlaskConicalIcon,
  HeartPulseIcon,
  ImageIcon,
  PaperclipIcon,
  ScanLineIcon,
  StethoscopeIcon,
  UserRoundIcon,
  WindIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia } from "@/lib/schema/historia";

type SummaryScope =
  | "examenFisicoGeneral"
  | "examenFisicoSegmentario"
  | "complementarios"
  | "diagnostico";

type HistoriaClinicalSummaryProps = {
  historia?: Historia;
  paciente?: PacienteSearchResult;
  scope: SummaryScope;
  triggerLabel?: string;
};

type SummaryItem = {
  label: string;
  value: string;
};

type SummaryFile = {
  href?: string;
  meta: string;
  name: string;
};

type ComplementaryExam = {
  details: SummaryItem[];
  files: SummaryFile[];
  icon: ReactNode;
  registered: boolean;
  requested: boolean;
  title: string;
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

function formatFileSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Tamano sin registro";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getStoredFileHref(key: string | undefined) {
  if (!key) {
    return undefined;
  }

  return `/archivos/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
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

function getPacienteName(paciente: PacienteSearchResult | undefined) {
  if (!paciente) {
    return "Paciente no registrado";
  }

  const datos = paciente.datosPersonales;

  return [
    datos.nombres,
    datos.apellidoPaterno,
    datos.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function getPacienteItems(paciente: PacienteSearchResult | undefined): SummaryItem[] {
  if (!paciente) {
    return [];
  }

  const datos = paciente.datosPersonales;

  return [
    { label: "Nombre completo", value: getPacienteName(paciente) },
    {
      label: "Documento",
      value: `${datos.documentoIdentidad} ${datos.numeroDocumentoIdentidad}`,
    },
    { label: "Fecha de nacimiento", value: formatText(datos.fechaNacimiento) },
    { label: "Genero", value: formatText(paciente.genero) },
    { label: "Nacionalidad", value: formatText(paciente.nacionalidad) },
    {
      label: "Lugar de nacimiento",
      value: [
        paciente.lugarNacimiento.distrito,
        paciente.lugarNacimiento.departamento,
        paciente.lugarNacimiento.pais,
      ]
        .filter(Boolean)
        .join(", "),
    },
    { label: "Etnia", value: formatText(paciente.etnia) },
    {
      label: "Padres o responsables",
      value:
        paciente.padres
          ?.map((padre) =>
            [
              padre.datosPersonales.nombres,
              padre.datosPersonales.apellidoPaterno,
              padre.datosPersonales.apellidoMaterno,
              padre.relacion ? `(${padre.relacion})` : "",
            ]
              .filter(Boolean)
              .join(" "),
          )
          .filter(Boolean)
          .join(", ") || "Sin registro",
    },
  ];
}

function getAnamnesisItems(historia: Historia | undefined): SummaryItem[] {
  const anamnesis = historia?.anamnesis;

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

function getGeneralItems(historia: Historia | undefined): SummaryItem[] {
  const examen = historia?.examenFisicoGeneral;

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

function getSegmentarioItems(historia: Historia | undefined): SummaryItem[] {
  const examen = historia?.examenFisicoSegmentario;

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

function getEcografiaFiles(historia: Historia | undefined): SummaryFile[] {
  const imagen = historia?.ecografia?.imagen;

  if (!imagen) {
    return [];
  }

  return [
    {
      href: imagen.data
        ? `data:${imagen.tipo};base64,${imagen.data}`
        : imagen.url ?? getStoredFileHref(imagen.key),
      meta: [imagen.tipo, formatFileSize(imagen.tamano)]
        .filter(Boolean)
        .join(" - "),
      name: imagen.nombre || "Imagen de ecografia",
    },
  ];
}

function getComplementaryExams(historia: Historia | undefined): ComplementaryExam[] {
  const solicitudes = historia?.examenesComplementariosSolicitados;

  return [
    {
      details: [
        {
          label: "Higado",
          value: formatText(historia?.ecografia?.higado.diagnostico),
        },
        {
          label: "Vesicula biliar",
          value: formatText(historia?.ecografia?.vesiculaBiliar.diagnostico),
        },
        {
          label: "Rinones",
          value: formatText(historia?.ecografia?.riñones.diagnostico),
        },
      ],
      files: getEcografiaFiles(historia),
      icon: <ImageIcon />,
      registered: Boolean(historia?.ecografia),
      requested: Boolean(solicitudes?.ecografia),
      title: "Ecografia",
    },
    {
      details: [
        {
          label: "Grupo sanguineo",
          value: formatText(historia?.laboratorios?.grupoSanguineo),
        },
        {
          label: "Glicemia capilar",
          value: formatText(historia?.laboratorios?.glicemiaCapilar),
        },
        {
          label: "Otros estudios",
          value:
            historia?.laboratorios?.otrosEstudios
              ?.map((item) => `${item.nombre}: ${item.resultado}`)
              .join(" | ") || "Sin registro",
        },
      ],
      files: [],
      icon: <FlaskConicalIcon />,
      registered: Boolean(historia?.laboratorios),
      requested: Boolean(solicitudes?.laboratorios),
      title: "Laboratorios",
    },
    {
      details: [
        {
          label: "Diagnostico",
          value: formatText(historia?.espirometria?.diagnostico),
        },
        {
          label: "FEV1",
          value: formatNumber(historia?.espirometria?.FEV1),
        },
        {
          label: "FEV1/FVC",
          value: formatNumber(historia?.espirometria?.FEV1FVC),
        },
      ],
      files: [],
      icon: <WindIcon />,
      registered: Boolean(historia?.espirometria),
      requested: Boolean(solicitudes?.espirometria),
      title: "Espirometria",
    },
    {
      details: [
        {
          label: "Diagnostico",
          value: formatText(historia?.electrocardiograma?.diagnostico),
        },
        {
          label: "Ritmo",
          value: formatText(historia?.electrocardiograma?.ritmo),
        },
        {
          label: "FC",
          value: formatNumber(historia?.electrocardiograma?.frecuenciaCardiaca),
        },
      ],
      files: [],
      icon: <HeartPulseIcon />,
      registered: Boolean(historia?.electrocardiograma),
      requested: Boolean(solicitudes?.electrocardiograma),
      title: "Electrocardiograma",
    },
  ];
}

function getDiagnosticoItems(historia: Historia | undefined): SummaryItem[] {
  const diagnostico = historia?.diagnostico;

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

function ComplementaryExamCard({ exam }: { exam: ComplementaryExam }) {
  const status = exam.registered
    ? "Registrado"
    : exam.requested
      ? "Solicitado"
      : "No solicitado";

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-2xl bg-muted">
            {exam.icon}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold">{exam.title}</h4>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
        </div>
        <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
          {exam.files.length} archivo{exam.files.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-2">
        {exam.details.map((item) => (
          <div className="rounded-2xl bg-muted/40 p-2.5" key={item.label}>
            <span className="text-xs font-medium text-muted-foreground">
              {item.label}
            </span>
            <p className="line-clamp-2 text-sm leading-relaxed">
              {item.value || "Sin registro"}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-dashed p-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <PaperclipIcon />
          Archivos incluidos
        </div>
        {exam.files.length > 0 ? (
          <div className="flex flex-col gap-2">
            {exam.files.map((file) => (
              <div
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2"
                key={file.name}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileTextIcon />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.meta}
                    </p>
                  </div>
                </div>
                {file.href ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={file.href} rel="noreferrer" target="_blank">
                      Abrir
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin archivos adjuntos registrados.
          </p>
        )}
      </div>
    </article>
  );
}

function ComplementarySummarySection({ historia }: { historia?: Historia }) {
  const registeredExams = getComplementaryExams(historia).filter(
    (exam) => exam.registered,
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-2xl bg-muted">
          <ScanLineIcon />
        </div>
        <h3 className="text-sm font-semibold">Examenes complementarios</h3>
      </div>
      {registeredExams.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {registeredExams.map((exam) => (
            <ComplementaryExamCard exam={exam} key={exam.title} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          Aun no hay examenes complementarios registrados.
        </p>
      )}
    </section>
  );
}

function HistoriaClinicalSummaryContent({
  historia,
  paciente,
  scope,
}: HistoriaClinicalSummaryProps) {
  return (
    <div className="flex flex-col gap-5">
      <SummarySection
        emptyText="Aun no hay informacion de paciente cargada para esta historia."
        icon={<UserRoundIcon />}
        items={getPacienteItems(paciente)}
        title="Paciente"
      />

      <Separator />

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
          <ComplementarySummarySection historia={historia} />
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
                historia?.electrocardiograma
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
                historia?.espirometria
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
                historia?.laboratorios
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
    </div>
  );
}

export function HistoriaClinicalSummary({
  historia,
  paciente,
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
        <HistoriaClinicalSummaryContent
          historia={historia}
          paciente={paciente}
          scope={scope}
        />
      </CardContent>
    </Card>
  );
}

export function HistoriaClinicalSummaryModal({
  historia,
  paciente,
  scope,
  triggerLabel = "Ver resumen",
}: HistoriaClinicalSummaryProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-fit" size="sm" variant="outline">
          <EyeIcon data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-h-[760px] sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>Resumen de la historia</DialogTitle>
          <DialogDescription>
            Contexto registrado en estaciones previas para completar esta parte
            sin perder continuidad clinica.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-5 sm:max-h-[648px] sm:px-6">
          <HistoriaClinicalSummaryContent
            historia={historia}
            paciente={paciente}
            scope={scope}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
