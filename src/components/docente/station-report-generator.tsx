"use client";

import { useState, type FormEvent } from "react";
import { DownloadIcon, FileTextIcon, LoaderCircleIcon, StethoscopeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportStationSlugs, type DocenteReportOptions } from "@/lib/reports/docente-report-options";
import { reportDateRangeSchema, reportPeriodLabel, withinReportDates } from "@/lib/reports/report-filters";

const scopes = { global: "Global de la estación", estudiante: "Individual por estudiante", paciente: "Historial por paciente", atencion: "Una atención específica" } as const;
type Scope = keyof typeof scopes;
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function dateLabel(value: string) {
  return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(value)) : "Sin fecha";
}

export function StationReportGenerator({ options }: { options: DocenteReportOptions }) {
  const [scope, setScope] = useState<Scope>("global");
  const [id, setId] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<"station" | "complete">("station");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const range = { from: from || undefined, to: to || undefined };
  const validRange = reportDateRangeSchema.safeParse(range);
  const dateError = validRange.success ? "" : validRange.error.issues[0].message;
  const filteredVisits = options.visits.filter((visit) => withinReportDates(visit.date, range));
  const patients = [...new Map(filteredVisits.map((visit) => [visit.patientId, { id: visit.patientId, name: visit.name, document: visit.document }])).values()];
  const selectedPatient = patients.find((patient) => patient.id === id);
  const patientMatches = patients.filter((patient) => normalize(`${patient.name} ${patient.document}`).includes(normalize(query)));
  const visiblePatients = patientMatches.slice(0, 60);
  if (selectedPatient && !visiblePatients.some((patient) => patient.id === id)) visiblePatients.unshift(selectedPatient);
  const selectedVisit = filteredVisits.find((visit) => visit.id === id);
  const selectedStudent = options.students.find((student) => student.id === id);
  const matches = filteredVisits.filter((visit) => normalize(`${visit.name} ${visit.document} ${dateLabel(visit.date)}`).includes(normalize(query)));
  const visibleVisits = matches.slice(0, 60);
  if (selectedVisit && !visibleVisits.some((visit) => visit.id === id)) visibleVisits.unshift(selectedVisit);
  const count = scope === "global" ? filteredVisits.length : scope === "estudiante" ? filteredVisits.filter((visit) => visit.authorIds.includes(id)).length : scope === "paciente" ? filteredVisits.filter((visit) => visit.patientId === id).length : selectedVisit ? 1 : 0;
  const clinical = scope === "paciente" || scope === "atencion";
  const canGenerate = !dateError && (scope === "global" || (scope === "estudiante" ? Boolean(selectedStudent) : scope === "paciente" ? Boolean(selectedPatient) : Boolean(selectedVisit)));

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateError) { document.getElementById("report-from")?.focus(); return; }
    if (!canGenerate || busy) return;
    setBusy(true); setError(""); setSuccess(false);
    try {
      const params = new URLSearchParams({ scope, ...(scope !== "global" ? { id } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(clinical ? { detail } : {}) });
      const response = await fetch(`/docente/${reportStationSlugs[options.stationKey]}/reportes/pdf?${params}`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/pdf")) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "No se pudo generar el reporte. Revisa tu sesión e intenta nuevamente.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-${reportStationSlugs[options.stationKey]}-${scope}.pdf`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el reporte.");
    } finally { setBusy(false); }
  }

  return <div className="flex flex-col gap-8">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary"><FileTextIcon className="size-7" aria-hidden="true" /></div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Docencia · {options.stationLabel}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Generador de reportes</h1>
          <p className="max-w-xl text-sm text-muted-foreground">Elige el alcance y descarga la información de tu estación en el formato institucional.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm sm:max-w-64 sm:text-right"><span className="font-medium">{options.tripLabel}</span><span className="text-muted-foreground">{options.establishment}</span></div>
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle>Configura tu reporte</CardTitle><CardDescription>{clinical && detail === "complete" ? "Atenciones autorizadas del viaje activo, con todas sus secciones clínicas registradas." : `Información del viaje activo, exclusiva de ${options.stationLabel}.`}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={generate} noValidate className="flex flex-col gap-6">
            <FieldGroup>
              <Field><FieldLabel htmlFor="report-scope">Alcance</FieldLabel>
                <Select value={scope} disabled={busy} onValueChange={(value) => { setScope(value as Scope); setId(""); setQuery(""); setError(""); setSuccess(false); }}>
                  <SelectTrigger id="report-scope" className="w-full"><SelectValue>{scopes[scope]}</SelectValue></SelectTrigger>
                  <SelectContent><SelectGroup>{Object.entries(scopes).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
                <FieldDescription>{scope === "global" ? "Todas las atenciones y sus responsables en esta estación." : scope === "estudiante" ? "Atenciones registradas por el estudiante en esta estación. En Farmacia, atenciones con dispensaciones realizadas por él." : scope === "paciente" ? "Reúne las atenciones disponibles del paciente en el viaje activo, ordenadas por fecha y con el responsable de cada visita." : "Datos clínicos de una atención específica, identificada por paciente y fecha."}</FieldDescription>
              </Field>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(dateError)}><FieldLabel htmlFor="report-from">Desde</FieldLabel><Input id="report-from" type="date" value={from} disabled={busy} aria-invalid={Boolean(dateError)} aria-describedby="report-date-help" onChange={(event) => { setFrom(event.target.value); setSuccess(false); }} /></Field>
                <Field data-invalid={Boolean(dateError)}><FieldLabel htmlFor="report-to">Hasta</FieldLabel><Input id="report-to" type="date" value={to} disabled={busy} aria-invalid={Boolean(dateError)} aria-describedby="report-date-help" onChange={(event) => { setTo(event.target.value); setSuccess(false); }} /></Field>
              </FieldGroup>
              <p id="report-date-help" role={dateError ? "alert" : undefined} className="text-sm text-muted-foreground">{dateError || "Filtra por fecha de atención, incluyendo ambos días (hora de Bolivia). Deja las fechas vacías para incluir todas las disponibles."}</p>
              {clinical && <Field><FieldLabel htmlFor="report-detail">Contenido clínico</FieldLabel>
                <Select value={detail} disabled={busy} onValueChange={(value) => { setDetail(value as "station" | "complete"); setSuccess(false); }}><SelectTrigger id="report-detail" className="w-full"><SelectValue>{detail === "station" ? "Solo mi estación" : "Historial clínico completo"}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="station">Solo mi estación</SelectItem><SelectItem value="complete">Historial clínico completo</SelectItem></SelectGroup></SelectContent></Select>
                <FieldDescription>{detail === "complete" ? "Incluye todas las secciones clínicas registradas de las atenciones autorizadas para este docente." : `Incluye identificación y datos de ${options.stationLabel}.`}</FieldDescription>
              </Field>}
              {scope === "estudiante" && <Field><FieldLabel htmlFor="report-student">Estudiante asignado</FieldLabel>
                <Select value={id} disabled={busy || !options.students.length} onValueChange={(value) => { setId(value); setSuccess(false); }}><SelectTrigger id="report-student" className="w-full"><SelectValue placeholder="Selecciona un estudiante" /></SelectTrigger><SelectContent><SelectGroup>{options.students.map((student) => <SelectItem value={student.id} key={student.id}>{student.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
                {!options.students.length && <FieldDescription>No hay estudiantes asignados a esta estación.</FieldDescription>}
              </Field>}
              {clinical && <>
                <Field><FieldLabel htmlFor="report-search">Buscar paciente</FieldLabel><Input id="report-search" placeholder={scope === "paciente" ? "Nombre o documento" : "Nombre, documento o fecha"} value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} /></Field>
                {scope === "paciente" ? <Field><FieldLabel htmlFor="report-patient">Paciente</FieldLabel>
                  <Select value={id} disabled={busy || !patients.length} onValueChange={(value) => { setId(value); setSuccess(false); }}><SelectTrigger id="report-patient" className="w-full"><SelectValue placeholder="Selecciona un paciente" /></SelectTrigger><SelectContent><SelectGroup>{visiblePatients.map((patient) => <SelectItem value={patient.id} key={patient.id}>{patient.name} · {patient.document}</SelectItem>)}</SelectGroup></SelectContent></Select>
                  <FieldDescription>{patientMatches.length} {patientMatches.length === 1 ? "paciente" : "pacientes"} en el período.{patientMatches.length > 60 ? " Afina la búsqueda para ver más resultados." : ""}</FieldDescription>
                </Field> : <>
                <Field><FieldLabel htmlFor="report-visit">Atención</FieldLabel>
                  <Select value={id} disabled={busy || !options.visits.length} onValueChange={(value) => { setId(value); setSuccess(false); }}><SelectTrigger id="report-visit" className="w-full"><SelectValue placeholder="Selecciona paciente y fecha" /></SelectTrigger><SelectContent><SelectGroup>{visibleVisits.map((visit) => <SelectItem value={visit.id} key={visit.id}>{visit.name} · {visit.document} · {dateLabel(visit.date)}</SelectItem>)}</SelectGroup></SelectContent></Select>
                  <FieldDescription>{matches.length ? `${matches.length} atenciones encontradas${matches.length > 60 ? ". Afina la búsqueda para ver más resultados" : ""}.` : "No hay atenciones que coincidan con la búsqueda."}</FieldDescription>
                </Field>
                </>}
              </>}
            </FieldGroup>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {success && <p role="status" className="text-sm text-muted-foreground">Reporte generado. La descarga está lista.</p>}
            <Button type="submit" size="lg" disabled={busy || !canGenerate} className="w-full">{busy ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <DownloadIcon data-icon="inline-start" />}{busy ? "Generando reporte…" : "Generar y descargar PDF"}</Button>
          </form>
        </CardContent>
      </Card>
      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Contenido del reporte</CardTitle><CardDescription>{scopes[scope]}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><StethoscopeIcon className="size-5 text-primary" aria-hidden="true" /><span className="font-medium">{options.stationLabel}</span></div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Selección</dt><dd className="text-right">{scope === "global" ? "Toda la estación" : scope === "estudiante" ? selectedStudent?.name ?? "Por seleccionar" : scope === "paciente" ? selectedPatient?.name ?? "Por seleccionar" : selectedVisit?.name ?? "Por seleccionar"}</dd>
              <dt className="text-muted-foreground">Período</dt><dd className="text-right">{reportPeriodLabel(range)}</dd>
              {clinical && <><dt className="text-muted-foreground">Contenido</dt><dd className="text-right">{detail === "complete" ? "Historial completo" : "Solo mi estación"}</dd></>}
              <dt className="text-muted-foreground">Atenciones</dt><dd className="text-right font-semibold tabular-nums">{count}</dd>
              <dt className="text-muted-foreground">Formato</dt><dd className="text-right">PDF · Medicina UNIFRANZ</dd>
              {scope === "atencion" && selectedVisit && <><dt className="text-muted-foreground">Fecha</dt><dd className="text-right">{dateLabel(selectedVisit.date)}</dd><dt className="text-muted-foreground">Responsable</dt><dd className="text-right">{selectedVisit.author}</dd></>}
            </dl>
            <p className="text-sm leading-relaxed text-muted-foreground">{clinical ? "Cada atención incluye sus datos clínicos, fecha y responsable. Las visitas se presentan en páginas separadas dentro de un solo PDF." : "Incluye resumen de atenciones, estado y tabla de pacientes con fecha y responsable."}</p>
          </CardContent>
        </Card>
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">Cada nueva visita del paciente se presenta como una atención independiente. Los reportes usan los datos disponibles al momento de generarlos.</p>
      </aside>
    </div>
  </div>;
}
