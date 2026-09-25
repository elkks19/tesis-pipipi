import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardPenLineIcon,
  IdCardIcon,
  SearchXIcon,
  UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";

import { ExamenGeneralQuickActions } from "./examen-general-quick-actions";
import { HistoriasFilters } from "./historias-filters";
import { listHistoriasForExamenFisicoGeneral } from "./queries";

export const metadata: Metadata = {
  title: "Examen fisico general",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExamenFisicoGeneralPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getPacienteName(paciente: PacienteSearchResult) {
  const { nombres, apellidoPaterno, apellidoMaterno } =
    paciente.datosPersonales;

  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function formatDate(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatHistoryDate(value?: string) {
  if (!value) return "Fecha no registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no registrada";

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/La_Paz",
    year: "numeric",
  }).format(date);
}

function getPlace(paciente: PacienteSearchResult) {
  return [
    paciente.lugarNacimiento.distrito,
    paciente.lugarNacimiento.departamento,
    paciente.lugarNacimiento.pais,
  ]
    .filter(Boolean)
    .join(", ");
}

function getPageHref({
  cursor,
  cursors,
  query,
}: {
  cursor?: string;
  cursors: string[];
  query: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (cursors.length > 0) {
    params.set("cursors", cursors.join(","));
  }

  const search = params.toString();

  return search
    ? `/estudiante/examen-fisico-general?${search}`
    : "/estudiante/examen-fisico-general";
}

export default async function ExamenFisicoGeneralPage({
  searchParams,
}: ExamenFisicoGeneralPageProps) {
  await connection();

  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const previousCursor = cursors.at(-1);
  const previousCursors = cursors.slice(0, -1);
  const historiasPage = await listHistoriasForExamenFisicoGeneral({
    cursor,
    query,
  });
  const nextCursors = cursor ? [...cursors, cursor] : cursors;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · 01</span>
        <h1 className="font-heading text-2xl font-semibold">
          Examen físico general
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Elige una historia para registrar signos vitales, presión arterial y
          medidas antropométricas.
        </p>
      </div>

      <section className="flex flex-col gap-5 rounded-2xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Seleccionar historia</h2>
          <p className="text-sm text-muted-foreground">Busca por identidad y continúa con el examen correspondiente.</p>
        </div>
        <HistoriasFilters query={query} />

        <div className="grid gap-3">
          {historiasPage.rows.length > 0 ? historiasPage.rows.map((row) => {
            const datos = row.paciente.datosPersonales;
            return (
              <article className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-xs transition-colors hover:border-primary/30" key={row.historiaId}>
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                      <UserRoundIcon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold sm:text-base">{getPacienteName(row.paciente)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{row.paciente.genero} · Historia del {formatHistoryDate(row.createdAt)}</p>
                    </div>
                    <span className={row.examenFisicoGeneralCompleto
                      ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                      : "inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"}>
                      {row.examenFisicoGeneralCompleto ? <ClipboardCheckIcon className="size-3.5" /> : <ClipboardPenLineIcon className="size-3.5" />}
                      {row.examenFisicoGeneralCompleto ? "Completado" : "Pendiente"}
                    </span>
                  </div>
                  <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Documento</dt>
                      <dd className="mt-1 flex items-center gap-1.5 break-words font-medium"><IdCardIcon className="size-4 shrink-0 text-muted-foreground" />{datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Nacimiento</dt>
                      <dd className="mt-1 font-medium">{formatDate(datos.fechaNacimiento)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Procedencia</dt>
                      <dd className="mt-1 break-words font-medium">{getPlace(row.paciente) || "Sin lugar"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <p className="text-xs text-muted-foreground">Historia clínica vinculada al paciente</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ExamenGeneralQuickActions hasClinicalDetail={row.hasClinicalDetail} historiaId={row.historiaId} />
                    <Button asChild size="sm" variant={row.examenFisicoGeneralCompleto ? "outline" : "default"}>
                      <Link href={"/estudiante/examen-fisico-general/" + encodeURIComponent(row.historiaId)}>
                        <ClipboardPenLineIcon data-icon="inline-start" />
                        {row.examenFisicoGeneralCompleto ? "Editar examen" : "Registrar examen"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
              <SearchXIcon className="size-7" />
              <span className="font-medium text-foreground">No encontramos historias</span>
              <span className="text-sm">Prueba con otro nombre o número de documento.</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {historiasPage.rows.length} {historiasPage.rows.length === 1 ? "historia visible" : "historias visibles"} · hasta {historiasPage.pageSize} por página
          </p>
          <div className="flex items-center gap-2">
            <Button
              asChild={Boolean(cursor)}
              disabled={!cursor}
              size="sm"
              variant="outline"
            >
              {cursor ? (
                <Link
                  href={getPageHref({
                    cursor: previousCursor,
                    cursors: previousCursors,
                    query,
                  })}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Anterior
                </Link>
              ) : (
                <>
                  <ChevronLeftIcon data-icon="inline-start" />
                  Anterior
                </>
              )}
            </Button>
            <Button
              asChild={historiasPage.hasNextPage}
              disabled={!historiasPage.hasNextPage}
              size="sm"
              variant="outline"
            >
              {historiasPage.hasNextPage && historiasPage.nextCursor ? (
                <Link
                  href={getPageHref({
                    cursor: historiasPage.nextCursor,
                    cursors: nextCursors,
                    query,
                  })}
                >
                  Siguiente
                  <ChevronRightIcon data-icon="inline-end" />
                </Link>
              ) : (
                <>
                  Siguiente
                  <ChevronRightIcon data-icon="inline-end" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
