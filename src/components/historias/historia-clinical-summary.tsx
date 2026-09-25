"use client";

import { useMemo, useState } from "react";
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  DownloadIcon,
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
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia } from "@/lib/schema/historia";
import { getClinicalDetailGroups, type ClinicalDetailGroup } from "@/lib/clinical-history-details";

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
  groups?: ClinicalDetailGroup[];
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
      <div className="flex flex-wrap items-center gap-2">
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
        <HistoriaPdfDownloadButton historiaId={historia._id} />
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Resumen de la historia</SheetTitle>
              <SheetDescription>
                {formatHistoryDate(historia.createdAt)} · Vista rapida para {scopeLabels[scope].toLowerCase()}.
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
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Resumen de la historia</DialogTitle>
              <DialogDescription>
                {formatHistoryDate(historia.createdAt)} · Vista rapida para {scopeLabels[scope].toLowerCase()}.
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
  const latestHistoria = useMemo(
    () => sortHistoriesByDate(previousHistorias)[0],
    [previousHistorias],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
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
        <HistoriaPdfDownloadButton historiaId={latestHistoria?._id} />
      </div>

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
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-4xl">
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
  const sortedHistorias = sortHistoriesByDate(previousHistorias);
  const completedBlocks = sortedHistorias.reduce((total, historia) => {
    return total + buildSections(historia, "anamnesis").filter((section) => section.completed).length;
  }, 0);
  const latestDiagnosis = sortedHistorias[0]
    ? getPrimaryDiagnosis(sortedHistorias[0])
    : "Sin historias previas";

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HeartPulseIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Resumen clínico</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground shadow-xs">
                {previousHistorias.length} {previousHistorias.length === 1 ? "historia" : "historias"}
              </span>
              <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground shadow-xs">
                {completedBlocks} bloques con datos
              </span>
            </div>
            <p className="mt-2 truncate text-sm">
              <span className="text-muted-foreground">Último diagnóstico: </span>
              <span className="font-medium">{latestDiagnosis}</span>
            </p>
            {sortedHistorias[0] ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Última atención: {formatHistoryDate(sortedHistorias[0].createdAt)}
              </p>
            ) : null}
          </div>
        </div>
        <PacienteClinicalSummaryModal
          paciente={paciente}
          previousHistorias={sortedHistorias}
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
    <div className="flex flex-col gap-4">
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
    <div className="flex flex-col gap-4">
      {historia._id ? (
        <div className="flex justify-end">
          <HistoriaPdfDownloadButton historiaId={historia._id} />
        </div>
      ) : null}

      <PatientIdentityPanel
        fallbackPacienteId={historia.pacienteId}
        historiaDate={historia.createdAt}
        paciente={paciente}
      />

      {showPrevious ? (
        <PreviousHistoriesPanel
          paciente={paciente}
          previousHistorias={previousHistorias}
          scope={scope}
        />
      ) : null}

      <ClinicalHistoryStepper sections={visibleSections} />
    </div>
  );
}

export function HistoriaClinicalSplitViewer({
  historia,
  onOpenChange,
  open,
  paciente,
  previousHistorias = [],
  scope,
  view,
}: {
  historia: HistoriaWithId;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  paciente?: PacienteSearchResult;
  previousHistorias?: HistoriaWithId[];
  scope: SummaryScope;
  view: "historial" | "clinico";
}) {
  const isMobile = useIsMobile();
  const title = view === "historial" ? "Historial del paciente" : "Detalle clínico";
  const description = view === "historial"
    ? "Atenciones anteriores disponibles para este paciente."
    : `${formatHistoryDate(historia.createdAt)} · ${scopeLabels[scope]}.`;
  const content = view === "historial" ? (
    <div className="flex flex-col gap-4">
      <PatientIdentityPanel
        fallbackPacienteId={historia.pacienteId}
        historiaDate={historia.createdAt}
        paciente={paciente}
      />
      <PreviousHistoriesPanel
        paciente={paciente}
        previousHistorias={previousHistorias}
        scope={scope}
      />
    </div>
  ) : (
    <HistoriaSummaryBody historia={historia} paciente={paciente} scope={scope} showPrevious={false} />
  );

  return isMobile ? (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4 py-4">{content}</div>
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

function PatientIdentityPanel({
  fallbackPacienteId,
  historiaDate,
  paciente,
}: {
  fallbackPacienteId?: string;
  historiaDate?: string;
  paciente?: PacienteSearchResult;
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UserRoundIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Paciente
            </p>
            <h3 className="truncate text-base font-semibold">
              {getPacienteName(paciente)}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {paciente
                ? `${paciente.datosPersonales.documentoIdentidad}: ${paciente.datosPersonales.numeroDocumentoIdentidad}`
                : `Paciente ${fallbackPacienteId ?? "sin identificador"}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-3 lg:flex lg:shrink-0 lg:gap-6">
          {fallbackPacienteId ? (
            <MetaItem label="Fecha de atención" value={formatHistoryDate(historiaDate)} />
          ) : null}
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
  const sortedHistorias = useMemo(
    () => sortHistoriesByDate(previousHistorias),
    [previousHistorias],
  );

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
          {sortedHistorias.length}
        </span>
      </div>

      {sortedHistorias.length > 0 ? (
        <div className="divide-y">
          {sortedHistorias.map((previous, index) => (
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
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {diagnosis}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatHistoryDate(historia.createdAt)} · {completedCount} secciones con datos
        </p>
      </div>
      <div className="ml-12 flex w-full shrink-0 items-center justify-end gap-1 sm:ml-0 sm:w-auto">
        <HistoriaPdfDownloadButton historiaId={historia._id} label="PDF" />
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
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[94svh] overflow-y-auto p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Historia anterior</SheetTitle>
              <SheetDescription>
                {formatHistoryDate(historia.createdAt)} · {diagnosis}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4">{summary}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
            <DialogHeader className="border-b px-6 py-5 text-left">
              <DialogTitle>Historia anterior</DialogTitle>
              <DialogDescription>
                {formatHistoryDate(historia.createdAt)} · {diagnosis}
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">{summary}</div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function HistoriaPdfDownloadButton({
  historiaId,
  label = "Descargar PDF",
}: {
  historiaId?: string;
  label?: string;
}) {
  if (!historiaId) {
    return null;
  }

  const href = `/reportes/historias/${encodeURIComponent(historiaId)}?download=1`;

  return (
    <Button asChild size="sm" variant="outline">
      <a href={href}>
        <DownloadIcon data-icon="inline-start" />
        {label}
      </a>
    </Button>
  );
}

function ClinicalHistoryStepper({ sections }: { sections: SummarySection[] }) {
  const initialIndex = Math.max(
    0,
    sections.findIndex((section) => section.highlight),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        Todavia no hay datos clinicos registrados en esta historia.
      </div>
    );
  }

  const currentIndex = Math.min(activeIndex, sections.length - 1);
  const section = sections[currentIndex];

  return (
    <section className="flex flex-col gap-4" aria-label="Secciones de la historia clínica">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Lectura clínica</p>
          <h3 className="mt-1 text-lg font-semibold">{section.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Apartado {currentIndex + 1} de {sections.length} con datos registrados</p>
        </div>
        <span className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">{String(currentIndex + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}</span>
      </div>

      <nav
        aria-label="Navegación por secciones clínicas"
        className="-mx-1 overflow-x-auto px-1 pb-1"
      >
        <div className="flex w-max min-w-full items-start justify-center">
          {sections.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === currentIndex;

            return (
              <div className="flex shrink-0 items-start" key={item.id}>
                <div className="flex w-24 shrink-0 flex-col items-center gap-2 px-1 sm:w-28">
                  <Button
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`Ver sección ${item.title}`}
                    className="rounded-full"
                    onClick={() => setActiveIndex(index)}
                    size="icon-lg"
                    title={item.title}
                    type="button"
                    variant={isActive ? "default" : index < currentIndex ? "secondary" : "outline"}
                  >
                    <Icon />
                  </Button>
                  <span className={cn("line-clamp-2 min-h-8 w-full text-center text-[11px] leading-tight [overflow-wrap:anywhere]", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {item.title}
                  </span>
                </div>
                {index < sections.length - 1 ? <Separator className="mt-5 w-3 shrink-0 sm:w-4" /> : null}
              </div>
            );
          })}
        </div>
      </nav>

      <SectionBlock section={section} />

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button
          disabled={currentIndex === 0}
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1}/{sections.length}
        </span>
        <Button
          disabled={currentIndex === sections.length - 1}
          onClick={() =>
            setActiveIndex((index) => Math.min(sections.length - 1, index + 1))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Siguiente
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}

function SectionBlock({ section }: { section: SummarySection }) {
  const Icon = section.icon;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-sm",
        section.highlight && "border-primary/40",
      )}
    >
      <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{section.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
        </div>
      </div>

      {section.groups?.length ? (
        <div className="grid gap-4 p-4 sm:p-5">
          {section.groups.map((group) => (
            <section key={group.title} className="overflow-hidden rounded-xl border bg-muted/10">
              <h5 className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h5>
              <dl className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
                {group.items.map((item) => (
                  <div key={item.label} className={cn("min-w-0 rounded-lg border border-border/60 bg-background px-3 py-3", (item.value.length > 100 || item.value.includes("\n")) && "sm:col-span-2")}>
                    <dt className="text-xs leading-relaxed text-muted-foreground">{item.label}</dt>
                    <dd className={cn("mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed [overflow-wrap:anywhere]", item.value === "Sin registrar" && "font-normal italic text-muted-foreground")}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : section.items.length > 0 ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
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
    <div className={boxed ? "min-w-0 rounded-lg border border-border/60 bg-muted/15 p-3" : "min-w-0"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold leading-relaxed">{value}</div>
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

  const sections: SummarySection[] = [
    {
      id: "anamnesis",
      title: "Anamnesis",
      description: "Consulta, contexto social y antecedentes registrados.",
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
  return sections.map((section) => ({ ...section, groups: getClinicalDetailGroups(historia, section.id) }));
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

function sortHistoriesByDate(histories: HistoriaWithId[]) {
  return [...histories].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

    return rightTime - leftTime;
  });
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

function formatHistoryDate(value?: string) {
  if (!value) {
    return "Fecha no registrada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no registrada";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
