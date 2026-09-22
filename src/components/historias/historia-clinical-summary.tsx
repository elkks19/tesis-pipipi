"use client";

import { useMemo, useState } from "react";
import {
  ActivityIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  EyeIcon,
  FileCheck2Icon,
  FileTextIcon,
  FlaskConicalIcon,
  HeartPulseIcon,
  HistoryIcon,
  ImageIcon,
  PaperclipIcon,
  ScanLineIcon,
  StethoscopeIcon,
  UserRoundIcon,
  WindIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia } from "@/lib/schema/historia";

type SummaryScope =
  | "anamnesis"
  | "examenFisicoGeneral"
  | "examenFisicoSegmentario"
  | "complementarios"
  | "diagnostico";

type HistoriaWithId = Historia & {
  _id?: string;
};

type HistoriaClinicalSummaryModalProps = {
  historia: HistoriaWithId;
  paciente?: PacienteSearchResult;
  previousHistorias?: HistoriaWithId[];
  scope: SummaryScope;
  triggerLabel?: string;
};

type SummaryItem = {
  label: string;
  value: ReactNode;
};

type SummarySection = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  items: SummaryItem[];
  completed: boolean;
  highlight?: boolean;
};

const scopeLabels: Record<SummaryScope, string> = {
  anamnesis: "Anamnesis",
  complementarios: "Complementarios",
  diagnostico: "Diagnostico",
  examenFisicoGeneral: "Examen fisico general",
  examenFisicoSegmentario: "Examen fisico segmentario",
};

export function HistoriaClinicalSummaryModal({
  historia,
  paciente,
  previousHistorias = [],
  scope,
  triggerLabel = "Ver resumen clinico",
}: HistoriaClinicalSummaryModalProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <EyeIcon className="size-4" />
        {triggerLabel}
      </Button>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Resumen de la historia</SheetTitle>
              <SheetDescription>
                Vista rapida para {scopeLabels[scope].toLowerCase()}.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4">
              <HistoriaSummaryBody
                historia={historia}
                paciente={paciente}
                previousHistorias={previousHistorias}
                scope={scope}
                showPrevious
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[104rem] overflow-y-auto p-0 sm:max-w-[104rem]">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Resumen de la historia</DialogTitle>
              <DialogDescription>
                Vista rapida para {scopeLabels[scope].toLowerCase()}.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">
              <HistoriaSummaryBody
                historia={historia}
                paciente={paciente}
                previousHistorias={previousHistorias}
                scope={scope}
                showPrevious
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function PacienteClinicalSummaryModal({
  paciente,
  previousHistorias = [],
  triggerLabel = "Ver resumen clinico",
}: {
  paciente: PacienteSearchResult;
  previousHistorias?: HistoriaWithId[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <EyeIcon className="size-4" />
        {triggerLabel}
      </Button>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Resumen clinico del paciente</SheetTitle>
              <SheetDescription>
                Datos del paciente e historias anteriores disponibles.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4">
              <PacienteSummaryBody
                paciente={paciente}
                previousHistorias={previousHistorias}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[104rem] overflow-y-auto p-0 sm:max-w-[104rem]">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Resumen clinico del paciente</DialogTitle>
              <DialogDescription>
                Datos del paciente e historias anteriores disponibles.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">
              <PacienteSummaryBody
                paciente={paciente}
                previousHistorias={previousHistorias}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function PacienteClinicalSummaryPreview({
  paciente,
  previousHistorias = [],
}: {
  paciente: PacienteSearchResult;
  previousHistorias?: HistoriaWithId[];
}) {
  const completedBlocks = previousHistorias.reduce((total, historia) => {
    return total + buildSections(historia, "anamnesis").filter((section) => section.completed).length;
  }, 0);
  const latestDiagnosis = previousHistorias[0]
    ? getPrimaryDiagnosis(previousHistorias[0])
    : "Sin historias previas";

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Resumen clinico</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {previousHistorias.length > 0
              ? `${previousHistorias.length} historias anteriores · ${completedBlocks} bloques con datos`
              : "Sin historias anteriores registradas."}
          </p>
          <p className="mt-2 truncate text-sm">
            <span className="text-muted-foreground">Ultimo diagnostico: </span>
            {latestDiagnosis}
          </p>
        </div>
        <PacienteClinicalSummaryModal
          paciente={paciente}
          previousHistorias={previousHistorias}
        />
      </div>
    </section>
  );
}

function PacienteSummaryBody({
  paciente,
  previousHistorias,
}: {
  paciente: PacienteSearchResult;
  previousHistorias: HistoriaWithId[];
}) {
  return (
    <div className="space-y-5">
      <PatientIdentityPanel paciente={paciente} />
      <PreviousHistoriesPanel
        paciente={paciente}
        previousHistorias={previousHistorias}
        scope="anamnesis"
      />
    </div>
  );
}

function HistoriaSummaryBody({
  historia,
  paciente,
  previousHistorias = [],
  scope,
  showPrevious,
}: {
  historia: HistoriaWithId;
  paciente?: PacienteSearchResult;
  previousHistorias?: HistoriaWithId[];
  scope: SummaryScope;
  showPrevious?: boolean;
}) {
  const sections = useMemo(() => buildSections(historia, scope), [historia, scope]);
  const visibleSections = sections.filter((section) => section.highlight || section.completed);

  return (
    <div className="space-y-5">
      <PatientIdentityPanel
        fallbackPacienteId={historia.pacienteId}
        paciente={paciente}
      />

      {showPrevious ? (
        <PreviousHistoriesPanel
          paciente={paciente}
          previousHistorias={previousHistorias}
          scope={scope}
        />
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        {visibleSections.length > 0 ? (
          visibleSections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Todavia no hay datos clinicos registrados en esta historia.
          </div>
        )}
      </section>
    </div>
  );
}

function PatientIdentityPanel({
  fallbackPacienteId,
  paciente,
}: {
  fallbackPacienteId?: string;
  paciente?: PacienteSearchResult;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-background">
      <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b bg-muted/35 p-4 md:border-b-0 md:border-r md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UserRoundIcon className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paciente
              </p>
              <h3 className="break-words text-lg font-semibold leading-tight">
                {getPacienteName(paciente)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {paciente
                  ? `${paciente.datosPersonales.documentoIdentidad}: ${paciente.datosPersonales.numeroDocumentoIdentidad}`
                  : `Paciente ${fallbackPacienteId ?? "sin identificador"}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <MetaItem label="Genero" value={paciente?.genero ?? "Sin dato"} />
            <MetaItem
              label="Nacimiento"
              value={formatDate(paciente?.datosPersonales.fechaNacimiento)}
            />
            <MetaItem
              label="Lugar"
              value={
                paciente
                  ? [paciente.lugarNacimiento.departamento, paciente.lugarNacimiento.pais]
                      .filter(Boolean)
                      .join(", ")
                  : "Sin dato"
              }
            />
            <MetaItem label="Nacionalidad" value={paciente?.nacionalidad ?? "Sin dato"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviousHistoriesPanel({
  paciente,
  previousHistorias,
  scope,
}: {
  paciente?: PacienteSearchResult;
  previousHistorias: HistoriaWithId[];
  scope: SummaryScope;
}) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Historias anteriores del paciente</p>
            <p className="text-xs text-muted-foreground">
              Revisalas sin salir del formulario actual.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {previousHistorias.length}
        </span>
      </div>

      {previousHistorias.length > 0 ? (
        <div className="divide-y">
          {previousHistorias.map((previous, index) => (
            <PreviousHistoryRow
              key={previous._id ?? `${previous.pacienteId}-${index}`}
              historia={previous}
              index={index}
              paciente={paciente}
              scope={scope}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-muted-foreground">
          No hay historias anteriores registradas para este paciente.
        </div>
      )}
    </section>
  );
}

function PreviousHistoryRow({
  historia,
  index,
  paciente,
  scope,
}: {
  historia: HistoriaWithId;
  index: number;
  paciente?: PacienteSearchResult;
  scope: SummaryScope;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const sections = useMemo(() => buildSections(historia, scope), [historia, scope]);
  const completedCount = sections.filter((section) => section.completed).length;
  const diagnosis = getPrimaryDiagnosis(historia);

  const summary = (
    <HistoriaSummaryBody
      historia={historia}
      paciente={paciente}
      scope={scope}
      showPrevious={false}
    />
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {historia.viajeId ? `Viaje ${historia.viajeId}` : "Historia sin viaje asociado"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {diagnosis} · {completedCount} bloques con datos
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => setOpen(true)}
      >
        Ver
        <ChevronRightIcon className="size-4" />
      </Button>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Historia anterior</SheetTitle>
              <SheetDescription>{diagnosis}</SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4">{summary}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[92rem] overflow-y-auto p-0 sm:max-w-[92rem]">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Historia anterior</DialogTitle>
              <DialogDescription>{diagnosis}</DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">{summary}</div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SectionBlock({ section }: { section: SummarySection }) {
  const Icon = section.icon;

  return (
    <article
      className={[
        "rounded-lg border bg-background p-4",
        section.highlight ? "border-primary/50 shadow-sm" : "",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
      </div>

      {section.items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {section.items.map((item) => (
            <MetaItem key={item.label} label={item.label} value={item.value} boxed />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavia no hay datos registrados en esta estacion.
        </p>
      )}
    </article>
  );
}

function MetaItem({
  boxed,
  label,
  value,
}: {
  boxed?: boolean;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={boxed ? "min-w-0 rounded-md bg-muted/35 p-3" : "min-w-0"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm">{value}</div>
    </div>
  );
}

function buildSections(historia: HistoriaWithId, scope: SummaryScope): SummarySection[] {
  const anamnesis = historia.anamnesis;
  const examenFisicoGeneral = historia.examenFisicoGeneral;
  const examenFisicoSegmentario = historia.examenFisicoSegmentario;
  const electrocardiograma = historia.electrocardiograma;
  const espirometria = historia.espirometria;
  const ecografia = historia.ecografia;
  const laboratorios = historia.laboratorios;
  const diagnostico = historia.diagnostico;

  return [
    {
      id: "anamnesis",
      title: "Anamnesis",
      description: "Motivo de consulta y antecedentes principales.",
      icon: ClipboardListIcon,
      completed: Boolean(anamnesis),
      highlight: scope === "anamnesis",
      items: anamnesis
        ? [
            { label: "Motivo de consulta", value: anamnesis.motivoConsulta || "Sin dato" },
            {
              label: "Enfermedad actual",
              value: anamnesis.historiaEnfermedadActual || "Sin dato",
            },
            { label: "Estado civil", value: anamnesis.estadoCivil || "Sin dato" },
            { label: "Nivel educativo", value: anamnesis.nivelEducativo || "Sin dato" },
            {
              label: "Actividad fisica",
              value: formatBoolean(
                anamnesis.antecedentesNoPatologicos?.realizaActividadFisica,
              ),
            },
            {
              label: "Tabaquismo",
              value: anamnesis.antecedentesNoPatologicos?.habitoTabaquico ?? "Sin dato",
            },
          ]
        : [],
    },
    {
      id: "examenFisicoGeneral",
      title: "Examen general",
      description: "Signos vitales y medidas antropometricas.",
      icon: HeartPulseIcon,
      completed: Boolean(examenFisicoGeneral),
      highlight: scope === "examenFisicoGeneral",
      items: examenFisicoGeneral
        ? [
            {
              label: "Presion derecha",
              value: formatBloodPressure(examenFisicoGeneral.presionArterial?.derecha),
            },
            {
              label: "Presion izquierda",
              value: formatBloodPressure(examenFisicoGeneral.presionArterial?.izquierda),
            },
            {
              label: "Frecuencia cardiaca",
              value: formatUnit(examenFisicoGeneral.frecuenciaCardiaca, "lpm"),
            },
            {
              label: "Frecuencia respiratoria",
              value: formatUnit(examenFisicoGeneral.frecuenciaRespiratoria, "rpm"),
            },
            {
              label: "Temperatura",
              value: formatUnit(examenFisicoGeneral.temperaturaAxilar, "C"),
            },
            {
              label: "IMC",
              value: `${formatValue(examenFisicoGeneral.imc)} - ${
                examenFisicoGeneral.diagnosticoIMC || "Sin diagnostico"
              }`,
            },
          ]
        : [],
    },
    {
      id: "examenFisicoSegmentario",
      title: "Examen segmentario",
      description: "Revision por sistemas.",
      icon: StethoscopeIcon,
      completed: Boolean(examenFisicoSegmentario),
      highlight: scope === "examenFisicoSegmentario",
      items: examenFisicoSegmentario
        ? [
            { label: "Cabeza", value: examenFisicoSegmentario.cabeza || "Sin dato" },
            { label: "Cuello", value: examenFisicoSegmentario.cuello || "Sin dato" },
            {
              label: "Respiratorio",
              value: examenFisicoSegmentario.aparatoRespiratorio || "Sin dato",
            },
            {
              label: "Cardiovascular",
              value: examenFisicoSegmentario.aparatoCardiovascular || "Sin dato",
            },
            {
              label: "Abdomen y pelvis",
              value: examenFisicoSegmentario.abdomenPelvis || "Sin dato",
            },
            {
              label: "Sistema nervioso",
              value: examenFisicoSegmentario.sistemaNerviosoCentral || "Sin dato",
            },
          ]
        : [],
    },
    {
      id: "electrocardiograma",
      title: "Electrocardiograma",
      description: "Registro electrico cardiaco.",
      icon: ActivityIcon,
      completed: Boolean(electrocardiograma),
      highlight: scope === "complementarios" && Boolean(electrocardiograma),
      items: electrocardiograma
        ? [
            { label: "Ritmo", value: electrocardiograma.ritmo || "Sin dato" },
            {
              label: "Frecuencia cardiaca",
              value: formatUnit(electrocardiograma.frecuenciaCardiaca, "lpm"),
            },
            { label: "Intervalo PR", value: formatUnit(electrocardiograma.intervaloPR, "ms") },
            { label: "Intervalo QTc", value: formatUnit(electrocardiograma.intervaloQTc, "ms") },
            { label: "Diagnostico", value: electrocardiograma.diagnostico || "Sin dato" },
          ]
        : [],
    },
    {
      id: "espirometria",
      title: "Espirometria",
      description: "Funcion pulmonar.",
      icon: WindIcon,
      completed: Boolean(espirometria),
      highlight: scope === "complementarios" && Boolean(espirometria),
      items: espirometria
        ? [
            { label: "FEV1", value: formatValue(espirometria.FEV1) },
            { label: "% FEV teorico", value: formatUnit(espirometria.porcentajeFEVteorico, "%") },
            { label: "FVC", value: formatValue(espirometria.FVC) },
            { label: "% FVC teorico", value: formatUnit(espirometria.porcentajeFVCteorico, "%") },
            { label: "Diagnostico", value: espirometria.diagnostico || "Sin dato" },
          ]
        : [],
    },
    {
      id: "ecografia",
      title: "Ecografia",
      description: "Hallazgos abdominales registrados.",
      icon: ScanLineIcon,
      completed: Boolean(ecografia),
      highlight: scope === "complementarios" && Boolean(ecografia),
      items: ecografia
        ? [
            {
              label: "Higado",
              value: ecografia.higado
                ? `${ecografia.higado.diagnostico || "Sin diagnostico"} (${
                    ecografia.higado.dimensiones ?? "s/d"
                  } mm)`
                : "Sin dato",
            },
            {
              label: "Vesicula",
              value: ecografia.vesiculaBiliar?.diagnostico ?? "Sin dato",
            },
            { label: "Rinones", value: ecografia.riñones?.diagnostico ?? "Sin dato" },
            {
              label: "Imagen",
              value: ecografia.imagen ? (
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="size-3.5" />
                  {ecografia.imagen.nombre}
                </span>
              ) : (
                "Sin imagen"
              ),
            },
          ]
        : [],
    },
    {
      id: "laboratorios",
      title: "Laboratorios",
      description: "Resultados de laboratorio.",
      icon: FlaskConicalIcon,
      completed: Boolean(laboratorios),
      highlight: scope === "complementarios" && Boolean(laboratorios),
      items: laboratorios
        ? [
            { label: "Glicemia capilar", value: laboratorios.glicemiaCapilar || "Sin dato" },
            { label: "Grupo sanguineo", value: laboratorios.grupoSanguineo || "Sin dato" },
            {
              label: "Otros estudios",
              value:
                laboratorios.otrosEstudios && laboratorios.otrosEstudios.length > 0 ? (
                  <ul className="space-y-1">
                    {laboratorios.otrosEstudios.map((estudio) => (
                      <li key={`${estudio.nombre}-${estudio.resultado}`}>
                        <span className="font-medium">{estudio.nombre}:</span>{" "}
                        {estudio.resultado}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "Sin otros estudios"
                ),
            },
          ]
        : [],
    },
    {
      id: "diagnostico",
      title: "Diagnostico",
      description: "Diagnostico principal, secundarios y plan.",
      icon: FileCheck2Icon,
      completed: Boolean(diagnostico),
      highlight: scope === "diagnostico",
      items: diagnostico
        ? [
            {
              label: "Principal",
              value: diagnostico.principal
                ? `${diagnostico.principal.code} - ${diagnostico.principal.title}`
                : "Sin diagnostico principal",
            },
            {
              label: "Secundarios",
              value:
                diagnostico.secundarios?.length > 0 ? (
                  <ul className="space-y-1">
                    {diagnostico.secundarios.map((item) => (
                      <li key={`${item.code}-${item.iNo}`}>
                        {item.code} - {item.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "Sin diagnosticos secundarios"
                ),
            },
            { label: "Plan de trabajo", value: diagnostico.planTrabajo || "Sin dato" },
            {
              label: "Receta",
              value: diagnostico.recetaId ? (
                <span className="inline-flex items-center gap-1">
                  <PaperclipIcon className="size-3.5" />
                  Asociada
                </span>
              ) : (
                "Sin receta asociada"
              ),
            },
          ]
        : [],
    },
    {
      id: "reportes",
      title: "Reportes",
      description: "Archivos generados para la historia.",
      icon: FileTextIcon,
      completed: Boolean(historia.reporteHistoria || historia.reportesHistoria?.length),
      items: buildReportItems(historia),
    },
  ];
}

function buildReportItems(historia: HistoriaWithId): SummaryItem[] {
  const reportes = [
    ...(historia.reportesHistoria ?? []),
    ...(historia.reporteHistoria ? [historia.reporteHistoria] : []),
  ];

  if (reportes.length === 0) {
    return [];
  }

  return [
    {
      label: "Archivos",
      value: (
        <ul className="space-y-1">
          {reportes.map((reporte) => (
            <li key={reporte.key}>
              <span className="font-medium">{reporte.nombre}</span>
              <span className="text-muted-foreground"> - {formatBytes(reporte.tamano)}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];
}

function getPacienteName(paciente?: PacienteSearchResult) {
  if (!paciente) {
    return "Paciente sin datos cargados";
  }

  return [
    paciente.datosPersonales.nombres,
    paciente.datosPersonales.apellidoPaterno,
    paciente.datosPersonales.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function getPrimaryDiagnosis(historia: HistoriaWithId) {
  return historia.diagnostico?.principal?.title ?? "Sin diagnostico principal";
}

function formatBoolean(value?: boolean) {
  if (typeof value !== "boolean") {
    return "Sin dato";
  }

  return value ? "Si" : "No";
}

function formatBloodPressure(value?: { max?: number; min?: number }) {
  if (typeof value?.max !== "number" || typeof value?.min !== "number") {
    return "Sin dato";
  }

  return `${value.max}/${value.min}`;
}

function formatDate(value?: string) {
  if (!value) {
    return "Sin dato";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatValue(value?: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "Sin dato";
}

function formatUnit(value: number | undefined, unit: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin dato";
  }

  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "tamano no disponible";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
