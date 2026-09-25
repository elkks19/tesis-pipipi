"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import {
  ActivityIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FilePenLineIcon,
  HeartPulseIcon,
  InfoIcon,
  ImageIcon,
  MapPinIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  UserRoundCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { ActivityListRow } from "@/components/activity/station-activity-links";
import { formatBoliviaActivityDate as formatDate } from "@/lib/bolivia-time";

type StationActivityListProps = {
  mode: "docente" | "estudiante";
  rows: ActivityListRow[];
};

function getActionLabel(action: "created" | "updated", subject: string) {
  if (subject === "paciente") {
    return action === "created" ? "Paciente creado" : "Paciente actualizado";
  }

  return action === "created" ? "Registro creado" : "Registro editado";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatFieldLabel(value: string) {
  const labels: Record<string, string> = {
    apellidoMaterno: "Apellido materno",
    apellidoPaterno: "Apellido paterno",
    documentoIdentidad: "Tipo de documento",
    numeroDocumentoIdentidad: "Número de documento",
    fechaNacimiento: "Fecha de nacimiento",
    pais: "País",
    añosCursados: "Años cursados",
    situacionLaboral: "Situación laboral",
    createdAt: "Fecha de registro",
    updatedAt: "Última actualización",
    pacienteId: "Paciente",
    "antecedentesPatologicos.familiares": "Antecedentes familiares",
    "antecedentesPatologicos.personales": "Antecedentes personales",
    "antecedentesNoPatologicos.habitoTabaquico": "Habito tabaquico",
    "antecedentesNoPatologicos.consumoAlcohol": "Consumo de alcohol",
    "antecedentesNoPatologicos.realizaActividadFisica": "Actividad fisica",
    historiaEnfermedadActual: "Historia de enfermedad actual",
    motivoConsulta: "Motivo de consulta",
    "higado.dimensiones": "Dimensiones del hígado",
    "higado.parenquima": "Parénquima hepático",
    "higado.hepatomegalia": "Hepatomegalia",
    "higado.diagnostico": "Diagnóstico del hígado",
    "vesiculaBiliar.paredes": "Paredes vesiculares",
    "vesiculaBiliar.contenidoAnecoico": "Contenido anecoico",
    "vesiculaBiliar.barroBiliar": "Barro biliar",
    "vesiculaBiliar.calculos": "Cálculos",
    "vesiculaBiliar.diagnostico": "Diagnóstico de la vesícula",
    "riñones.derecho.longitud": "Riñón derecho · Longitud",
    "riñones.derecho.parenquima": "Riñón derecho · Parénquima",
    "riñones.izquierdo.longitud": "Riñón izquierdo · Longitud",
    "riñones.izquierdo.parenquima": "Riñón izquierdo · Parénquima",
    "riñones.ecogenicidad": "Ecogenicidad renal",
    "riñones.relacionCorticoMedular": "Relación córtico-medular",
    "riñones.diagnostico": "Diagnóstico renal",
    "imagen.nombre": "Archivo adjunto",
    "imagen.tipo": "Formato",
    "imagen.tamano": "Tamaño",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split(".")
    .at(-1)
    ?.replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase()) ?? value;
}

function getDiseaseLabel(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  return [value.title, value.code]
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean)
    .join(" - ");
}

function formatPrimitiveAuditValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Sin registro";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (typeof value === "string" || typeof value === "number") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))) {
      return formatDate(value);
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value.split("-").reverse().join("/");
    }
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderObjectValue(value: Record<string, unknown>) {
  const diseaseLabel = getDiseaseLabel(value);

  if (diseaseLabel) {
    return <span>{diseaseLabel}</span>;
  }

  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => (
          <div className={`min-w-0 ${key === "enfermedad" || key === "tratamiento" ? "sm:col-span-2" : ""}`} key={key}>
            <dt className="text-[11px] font-medium text-muted-foreground">
              {formatFieldLabel(key)}
            </dt>
            <dd className="mt-1 break-words text-sm font-medium leading-relaxed">
              {renderAuditValue(nestedValue)}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function renderArrayValue(values: unknown[]) {
  if (values.length === 0) {
    return <span>Sin registros</span>;
  }

  return (
    <div className="grid gap-4">
      {values.map((item, index) => (
        <div
          className="min-w-0 rounded-lg border-l-2 border-primary/40 bg-muted/20 px-4 py-4"
          key={index}
        >
          {values.length > 1 ? <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary">Registro {index + 1}</p> : null}
          {isRecord(item) ? renderObjectValue(item) : renderAuditValue(item)}
        </div>
      ))}
    </div>
  );
}

function renderAuditValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    return renderArrayValue(value);
  }

  if (isRecord(value)) {
    return renderObjectValue(value);
  }

  return formatPrimitiveAuditValue(value);
}

function getAuditChanges(row: ActivityListRow) {
  if (row.changes.length > 0) {
    return row.changes;
  }

  return row.changedFields.map((field) => ({
    after: undefined,
    before: undefined,
    field,
  }));
}

function renderFieldValue(field: string, value: unknown): ReactNode {
  if (typeof value === "number") {
    if (/^(higado\.dimensiones|riñones\.(derecho|izquierdo)\.(longitud|parenquima))$/.test(field)) {
      return `${value} cm`;
    }
    if (field === "imagen.tamano") {
      return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    }
  }
  return renderAuditValue(value);
}

function getChangeGroup(field: string, stationKey: ActivityListRow["stationKey"]) {
  if (stationKey === "ecografia") {
    if (field.startsWith("higado.")) return "Hígado";
    if (field.startsWith("vesiculaBiliar.")) return "Vesícula biliar";
    if (field.startsWith("riñones.")) return "Riñones";
    if (field.startsWith("imagen.")) return "Imagen del estudio";
  }
  if (field.startsWith("datosPersonales.") || field === "genero") return "Datos personales";
  if (field.startsWith("lugarNacimiento.") || field === "nacionalidad" || field === "etnia") return "Procedencia";
  if (field.startsWith("padres.")) return "Padres o responsables";
  if (field.startsWith("antecedentesNoPatologicos.")) return "Hábitos y estilo de vida";
  if (field.startsWith("antecedentesPatologicos.personales")) return "Antecedentes personales";
  if (field.startsWith("antecedentesPatologicos.familiares")) return "Antecedentes familiares";
  if (field.startsWith("antecedentesGinecoObstetricos.")) return "Antecedentes gineco-obstétricos";
  if (field === "motivoConsulta" || field === "historiaEnfermedadActual") return "Consulta actual";
  return "Otros datos";
}

const groupOrder = ["Datos personales", "Procedencia", "Padres o responsables", "Consulta actual", "Hábitos y estilo de vida", "Antecedentes personales", "Antecedentes familiares", "Antecedentes gineco-obstétricos", "Hígado", "Vesícula biliar", "Riñones", "Imagen del estudio", "Otros datos"];

const groupIcons: Record<string, typeof UserRoundIcon> = {
  "Datos personales": UserRoundIcon,
  Procedencia: MapPinIcon,
  "Padres o responsables": UsersIcon,
  "Consulta actual": ClipboardListIcon,
  "Hábitos y estilo de vida": ActivityIcon,
  "Antecedentes personales": HeartPulseIcon,
  "Antecedentes familiares": UsersIcon,
  "Antecedentes gineco-obstétricos": HeartPulseIcon,
  "Hígado": ScanSearchIcon,
  "Vesícula biliar": ScanSearchIcon,
  "Riñones": ScanSearchIcon,
  "Imagen del estudio": ImageIcon,
  "Otros datos": InfoIcon,
};

const fieldOrder = [
  "datosPersonales.nombres", "datosPersonales.apellidoPaterno", "datosPersonales.apellidoMaterno",
  "datosPersonales.documentoIdentidad", "datosPersonales.numeroDocumentoIdentidad", "datosPersonales.fechaNacimiento", "genero",
  "lugarNacimiento.pais", "lugarNacimiento.departamento", "lugarNacimiento.distrito", "nacionalidad", "etnia",
  "motivoConsulta", "historiaEnfermedadActual",
  "antecedentesNoPatologicos.habitoTabaquico", "antecedentesNoPatologicos.consumoAlcohol",
  "antecedentesNoPatologicos.realizaActividadFisica", "antecedentesNoPatologicos.consumoFrutasVerduras",
  "higado.dimensiones", "higado.parenquima", "higado.hepatomegalia", "higado.diagnostico",
  "vesiculaBiliar.paredes", "vesiculaBiliar.contenidoAnecoico", "vesiculaBiliar.barroBiliar", "vesiculaBiliar.calculos", "vesiculaBiliar.diagnostico",
  "riñones.derecho.longitud", "riñones.derecho.parenquima", "riñones.izquierdo.longitud", "riñones.izquierdo.parenquima", "riñones.ecogenicidad", "riñones.relacionCorticoMedular", "riñones.diagnostico",
  "imagen.nombre", "imagen.tipo", "imagen.tamano",
];

function fieldPosition(field: string) {
  const index = fieldOrder.indexOf(field);
  return index === -1 ? fieldOrder.length : index;
}

function groupChanges(changes: ReturnType<typeof getAuditChanges>, stationKey: ActivityListRow["stationKey"]) {
  const groups = new Map<string, typeof changes>();
  for (const change of changes) {
    if (["createdAt", "updatedAt", "created_by", "updated_by"].includes(change.field)) continue;
    if (stationKey === "ecografia" && ["imagen.key", "imagen.url", "imagen.data"].includes(change.field)) continue;
    const group = getChangeGroup(change.field, stationKey);
    groups.set(group, [...(groups.get(group) ?? []), change]);
  }
  return groupOrder.filter((name) => groups.has(name)).map((name) => ({
    name,
    changes: groups.get(name)!.sort((left, right) => fieldPosition(left.field) - fieldPosition(right.field)),
  }));
}

function AuditDetailDialog({ row }: { row: ActivityListRow }) {
  const sectionId = useId();
  const changes = getAuditChanges(row);
  const isCreated = row.action === "created";
  const groups = groupChanges(changes, row.stationKey);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <InfoIcon data-icon="inline-start" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(92dvh,900px)] max-h-[calc(100dvh-1.5rem)] w-[min(96vw,1280px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="relative shrink-0 overflow-hidden border-b bg-background px-5 py-5 pr-14 text-left sm:px-8 sm:py-7">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15 text-primary shadow-sm">
              {isCreated ? <ClipboardCheckIcon className="size-5" aria-hidden="true" /> : <FilePenLineIcon className="size-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Actividad del viaje</p>
              <DialogTitle className="text-xl tracking-tight">{getActionLabel(row.action, row.subject)}</DialogTitle>
              <DialogDescription className="text-sm">{row.pacienteName} · {row.pacienteDocument}</DialogDescription>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-primary/10 pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarClockIcon className="size-4" aria-hidden="true" /><time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time> · Bolivia</span>
            <span className="inline-flex items-center gap-1.5"><UserRoundCheckIcon className="size-4" aria-hidden="true" />{row.actorName}</span>
          </div>
        </DialogHeader>

        {groups.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/10 [scrollbar-gutter:stable]">
            <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[210px_minmax(0,1fr)]">
              <nav aria-label="Apartados de la actividad" className="hidden self-start xl:sticky xl:top-6 xl:block">
                <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">En este registro</p>
                <ol className="flex flex-col gap-1">
                  {groups.map((group, index) => (
                    <li key={group.name}><a className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs leading-5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring" href={`#${sectionId}-${index}`}><span className="font-semibold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span>{group.name}</a></li>
                  ))}
                </ol>
                <p className="mt-4 px-2 text-xs text-muted-foreground">{groups.reduce((total, group) => total + group.changes.length, 0)} campos {isCreated ? "registrados" : "modificados"}</p>
              </nav>
              <div className="flex min-w-0 flex-col gap-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground xl:hidden">{groups.reduce((total, group) => total + group.changes.length, 0)} campos · {groups.length} apartados</p>
              {groups.map((group, index) => {
                const Icon = groupIcons[group.name];
                return <section id={`${sectionId}-${index}`} className="scroll-mt-6 overflow-hidden rounded-xl border bg-background shadow-sm" key={group.name}>
                  <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary/8 to-transparent px-4 py-4 sm:px-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Apartado {String(index + 1).padStart(2, "0")}</p><h3 className="text-sm font-semibold">{group.name}</h3></div>
                    <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">{group.changes.length}</span>
                  </div>
                  {isCreated ? (
                    <dl className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                      {group.changes.map((change) => (
                        <div className={`min-w-0 rounded-lg px-4 py-3 ${Array.isArray(change.after) ? "border border-primary/15 bg-primary/[0.035] sm:col-span-2" : "border border-border/60 bg-muted/15"} ${change.field === "motivoConsulta" || change.field === "historiaEnfermedadActual" || (typeof change.after === "string" && change.after.length > 110) ? "sm:col-span-2" : ""}`} key={change.field}>
                          <dt className="text-[11px] font-medium text-muted-foreground">{formatFieldLabel(change.field)}</dt>
                          <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium leading-6">{renderFieldValue(change.field, change.after)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="divide-y">
                      {group.changes.map((change) => (
                        <article className="grid gap-3 p-4 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-5 lg:p-5" key={change.field}>
                          <h4 className="break-words text-sm font-medium">{formatFieldLabel(change.field)}</h4>
                          <AuditValue field={change.field} label="Antes" value={change.before} />
                          <AuditValue field={change.field} label="Después" value={change.after} />
                        </article>
                      ))}
                    </div>
                  )}
                </section>;
              })}
              </div>
            </div>
          </div>
        ) : (
          <p className="m-5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Esta actividad no tiene detalle de cambios registrado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditValue({ field, label, value }: { field: string; label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/35 p-3">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="max-h-56 overflow-y-auto break-words text-sm leading-relaxed">
        {renderFieldValue(field, value)}
      </div>
    </div>
  );
}

export function StationActivityList({
  rows,
}: StationActivityListProps) {
  return (
    <ItemGroup>
      {rows.map((row) => {
        const Icon =
          row.action === "created" ? ClipboardCheckIcon : FilePenLineIcon;

        return (
          <Item className="rounded-xl bg-background p-4 transition-colors hover:bg-muted/20" key={row.id} variant="outline">
            <ItemMedia variant="icon">
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{row.pacienteName}</ItemTitle>
              <ItemDescription>
                {row.pacienteDocument} · {getActionLabel(row.action, row.subject)}
              </ItemDescription>
            </ItemContent>
            <ItemContent className="hidden flex-none md:flex">
              <ItemTitle className="text-xs text-muted-foreground">
                <UserRoundIcon />
                {row.actorName}
              </ItemTitle>
              <ItemDescription><time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time></ItemDescription>
            </ItemContent>
            <ItemActions className="basis-full flex-wrap justify-end sm:basis-auto">
              <span className="text-xs text-muted-foreground md:hidden">
                {formatDate(row.createdAt)}
              </span>
              <AuditDetailDialog row={row} />
              {row.reportHref ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={row.reportHref} target="_blank">
                    <ScrollTextIcon data-icon="inline-start" />
                    Reporte
                  </Link>
                </Button>
              ) : null}
              {row.editHref ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={row.editHref}>
                    <FilePenLineIcon data-icon="inline-start" />
                    Editar
                  </Link>
                </Button>
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
