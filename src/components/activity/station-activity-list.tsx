"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ClipboardCheckIcon,
  FilePenLineIcon,
  InfoIcon,
  ScrollTextIcon,
  UserRoundIcon,
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

type StationActivityListProps = {
  mode: "docente" | "estudiante";
  rows: ActivityListRow[];
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(date);
}

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
    "antecedentesPatologicos.familiares": "Antecedentes familiares",
    "antecedentesPatologicos.personales": "Antecedentes personales",
    "antecedentesNoPatologicos.habitoTabaquico": "Habito tabaquico",
    "antecedentesNoPatologicos.consumoAlcohol": "Consumo de alcohol",
    "antecedentesNoPatologicos.realizaActividadFisica": "Actividad fisica",
    historiaEnfermedadActual: "Historia de enfermedad actual",
    motivoConsulta: "Motivo de consulta",
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

  return [value.title, value.code, value.iNo]
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
    <dl className="grid gap-2">
      {Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => (
          <div className="grid gap-1" key={key}>
            <dt className="text-xs font-medium text-muted-foreground">
              {formatFieldLabel(key)}
            </dt>
            <dd className="text-sm leading-relaxed">
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
    <div className="grid gap-2">
      {values.map((item, index) => (
        <div
          className="rounded-xl border bg-background/70 p-2.5"
          key={index}
        >
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

function AuditDetailDialog({ row }: { row: ActivityListRow }) {
  const changes = getAuditChanges(row);
  const isCreated = row.action === "created";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <InfoIcon data-icon="inline-start" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{getActionLabel(row.action, row.subject)}</DialogTitle>
          <DialogDescription>
            {row.pacienteName} - {row.pacienteDocument} - {formatDate(row.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {changes.length > 0 ? (
          <div className="grid gap-3">
            {changes.map((change) => (
              <article
                className="grid gap-3 rounded-2xl border bg-background p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]"
                key={change.field}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Campo
                  </span>
                  <p className="break-words text-sm font-medium">
                    {formatFieldLabel(change.field)}
                  </p>
                </div>
                {!isCreated ? (
                  <AuditValue label="Antes" value={change.before} />
                ) : null}
                <AuditValue
                  label={isCreated ? "Registrado" : "Despues"}
                  value={change.after}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
            Esta actividad no tiene detalle de cambios registrado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-muted/40 p-3">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="max-h-56 overflow-y-auto break-words text-sm leading-relaxed">
        {renderAuditValue(value)}
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
          <Item className="bg-background" key={row.id} variant="outline">
            <ItemMedia variant="icon">
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{getActionLabel(row.action, row.subject)}</ItemTitle>
              <ItemDescription>
                {row.pacienteName} · {row.pacienteDocument}
              </ItemDescription>
            </ItemContent>
            <ItemContent className="hidden flex-none md:flex">
              <ItemTitle className="text-xs text-muted-foreground">
                <UserRoundIcon />
                {row.actorName}
              </ItemTitle>
              <ItemDescription>{formatDate(row.createdAt)}</ItemDescription>
            </ItemContent>
            <ItemActions className="basis-full justify-end sm:basis-auto">
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
