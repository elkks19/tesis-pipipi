"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ActivityIcon,
  ArrowDownIcon,
  ArrowLeftRightIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CloudIcon,
  DatabaseIcon,
  FileImageIcon,
  FilterIcon,
  HardDriveIcon,
  HistoryIcon,
  LaptopIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UsersIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Issue = { stage: string; message: string; status?: number };
type Replication = {
  direction: string;
  state: string;
  pending: number | null;
  written: number | null;
  failures: number | null;
  updatedAt?: string | null;
  error?: string | null;
  history?: { type?: string; timestamp?: string }[];
};
type Change = {
  sequence: string;
  id: string;
  type: string;
  revision: string | null;
  revisions: string[];
  deleted: boolean;
  updatedAt: string | null;
};
type Audit = {
  id: string;
  kind: "file" | "document";
  target?: string;
  state?: string;
  actorId?: string;
  selected?: string;
  createdAt?: string;
  completedAt?: string;
};
type Status = {
  environment: string;
  enabled: boolean;
  configured: boolean;
  nodeId: string;
  stale: boolean;
  updatedAt?: string | null;
  interval: number;
  diagnostics?: Issue[];
  database: null | {
    name: string;
    documents: number;
    deleted: number;
    updateSequence: unknown;
    diskSize: number | null;
    activeSize: number | null;
  };
  changes: Change[];
  audit: Audit[];
  snapshot: null | {
    paused: boolean;
    running?: boolean;
    connected?: boolean;
    stage?: string;
    error?: string | null;
    errors?: Issue[];
    replication: Replication[];
    files: null | { transferred: number; pending: number; conflicts: number };
    accounts: null | { ok: boolean; count: number };
    conflicts: number | null;
    startedAt?: string;
  };
  commands: { id: string; action: string; state: string; actorId?: string; createdAt: string; completedAt?: string }[];
  conflicts: { id: string; type: string; revisions: string[] }[];
  fileConflicts: { id: string; key: string; current: { sha256: string; size: number }; candidate: { sha256: string; size: number } }[];
};

const labels: Record<string, string> = {
  running: "En ejecución",
  completed: "Procesada",
  pending: "En espera",
  cancelled: "Cancelada",
  partial: "Parcial",
  failed: "Error",
  crashing: "Reintentando",
  not_started: "Sin iniciar",
  initializing: "Iniciando",
  sync: "Sincronización solicitada",
  pause: "Pausa solicitada",
  resume: "Reanudación solicitada",
  connection: "Conexión con la nube",
  configuration: "Configuración",
  control: "Base de control",
  commands: "Solicitudes",
  data: "Datos",
  files: "Archivos",
  accounts: "Cuentas",
  conflicts: "Revisiones",
  heartbeat: "Reporte de estado",
  idle: "Esperando el próximo ciclo",
  document: "Documento",
  file: "Archivo",
};
const label = (value?: string) => value ? labels[value] ?? value : "No disponible";
const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-BO") : "Fecha no registrada";
const number = (value?: number | null) => value == null ? "—" : value.toLocaleString("es-BO");
const bytes = (value?: number | null) => {
  if (value == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size.toLocaleString("es-BO", { maximumFractionDigits: 1 })} ${units[unit]}`;
};
const sequence = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value == null ? "—" : JSON.stringify(value);
};

export function SyncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "open" | "retrying">("connecting");
  const [streamKey, setStreamKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [conflictId, setConflictId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const source = new EventSource("/api/admin/sync/events");
    setStreamState("connecting");
    source.onopen = () => setStreamState("open");
    source.addEventListener("status", (event) => {
      try {
        setStatus(JSON.parse((event as MessageEvent<string>).data));
        setStreamState("open");
      } catch {
        setStreamState("retrying");
      }
    });
    source.addEventListener("sync-error", () => setStreamState("retrying"));
    source.onerror = () => setStreamState("retrying");
    return () => source.close();
  }, [streamKey]);

  async function mutate(path: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sync/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
      toast.success(response.status === 202 ? "Solicitud registrada. El worker la recogerá al conectarse." : "Decisión guardada.");
      setStreamKey((key) => key + 1);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la operación.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function inspect(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sync/conflicts?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setVersions(await response.json());
      setConflictId(id);
    } catch {
      toast.error("No se pudieron consultar las revisiones.");
    } finally {
      setBusy(false);
    }
  }

  const snapshot = status?.snapshot;
  const issues = [...(status?.diagnostics ?? []), ...(snapshot?.errors ?? [])];
  const ready = Boolean(status?.enabled && status.configured);
  const fresh = Boolean(status && !status.stale);
  const connected = fresh && snapshot?.connected === true;
  const pendingCommands = status?.commands.filter((command) => command.state === "pending").length ?? 0;
  const caughtUp = ready && fresh && !issues.length && !snapshot?.error && !snapshot?.running && !snapshot?.paused
    && snapshot?.replication.length === 2
    && snapshot.replication.every((replication) => replication.pending === 0 && replication.failures === 0 && replication.state === "running")
    && snapshot.files?.pending === 0 && snapshot.files.conflicts === 0
    && snapshot.accounts?.ok && snapshot.conflicts === 0 && !status?.fileConflicts.length;
  const conflictCount = (status?.conflicts.length ?? 0) + (status?.fileConflicts.length ?? 0);
  const filteredChanges = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return status?.changes ?? [];
    return (status?.changes ?? []).filter((change) =>
      [change.id, change.type, change.revision].some((value) => value?.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [query, status?.changes]);

  const headline = !status ? "Leyendo el estado de ambos entornos"
    : !ready ? "Configuración pendiente"
    : !fresh ? "El último reporte está desactualizado"
    : snapshot?.paused ? "Sincronización en pausa"
    : caughtUp ? "Ambos entornos están al día"
    : issues.length ? "Hay operaciones pendientes"
    : snapshot?.running ? "Procesando cambios"
    : "Supervisión automática activa";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <CircleDotIcon className="size-3" />
            Centro de sincronización
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Raspberry ↔ nube</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Estado operativo, documentos recientes y decisiones auditadas en una sola vista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={streamState === "open" ? "default" : "secondary"}>
            {streamState === "open" ? <ActivityIcon /> : <RefreshCwIcon />}
            {streamState === "open" ? "En vivo por SSE" : streamState === "connecting" ? "Conectando" : "Reconectando"}
          </Badge>
          <Button variant="outline" disabled={busy} onClick={() => setStreamKey((key) => key + 1)}>
            <RefreshCwIcon data-icon="inline-start" />
            Reconectar
          </Button>
        </div>
      </header>

      {!status ? (
        <div className="flex flex-col gap-4" aria-label="Cargando sincronización">
          <Skeleton className="h-72 w-full" />
          <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-36" />)}</div>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl border bg-card" aria-label="Estado de conexión">
            <div className="grid items-center gap-6 p-6 sm:grid-cols-[1fr_auto_1fr] sm:p-8">
              <Endpoint icon={LaptopIcon} title="Raspberry Pi" detail={status.nodeId} badge={status.environment === "raspberry" ? "Este entorno" : "Campo"} />
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="h-px w-12 bg-border sm:w-24" />
                  <ArrowLeftRightIcon className="size-6" />
                  <span className="h-px w-12 bg-border sm:w-24" />
                </div>
                <Badge variant={connected ? "default" : "secondary"}>
                  {connected ? <WifiIcon /> : <WifiOffIcon />}
                  {connected ? "Enlace confirmado" : "Nube sin confirmar"}
                </Badge>
                <p className="text-center text-xs text-muted-foreground">{label(snapshot?.stage)}</p>
              </div>
              <Endpoint icon={CloudIcon} title="Servidor nube" detail="Servidor central" badge={status.environment === "cloud" ? "Este entorno" : "Remoto"} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-5 border-t bg-muted/30 p-6">
              <div className="flex max-w-2xl flex-col gap-1">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {caughtUp ? <CheckCircle2Icon className="size-5" /> : <ActivityIcon className="size-5" />}
                  {headline}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Último reporte de la Raspberry: {date(status.updatedAt)}. Los cambios mostrados abajo provienen directamente de CouchDB.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!ready || busy || pendingCommands > 0} onClick={() => void mutate("commands", { action: "sync" })}>
                  <RefreshCwIcon data-icon="inline-start" />
                  {pendingCommands ? "Orden pendiente" : "Sincronizar ahora"}
                </Button>
                <Button variant="outline" disabled={!ready || busy || pendingCommands > 0} onClick={() => void mutate("commands", { action: snapshot?.paused ? "resume" : "pause" })}>
                  {snapshot?.paused ? <PlayIcon data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
                  {snapshot?.paused ? "Reanudar" : "Pausar"}
                </Button>
              </div>
            </div>
          </section>

          {streamState === "retrying" && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Se perdió la actualización en vivo</AlertTitle>
              <AlertDescription>El navegador intentará reconectar automáticamente. Los datos visibles corresponden al último evento recibido.</AlertDescription>
            </Alert>
          )}

          {pendingCommands > 0 && (
            <Alert>
              <HistoryIcon />
              <AlertTitle>{pendingCommands} orden(es) esperando conexión</AlertTitle>
              <AlertDescription>La orden seguirá pendiente hasta que el worker confirme que la aplicó.</AlertDescription>
            </Alert>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de la base">
            <Metric icon={DatabaseIcon} title="Documentos actuales" value={number(status.database?.documents)} detail={status.database?.name ?? "Base no disponible"} />
            <Metric icon={HistoryIcon} title="Cambios visibles" value={number(status.changes.length)} detail="Últimos eventos de CouchDB" />
            <Metric icon={HardDriveIcon} title="Tamaño en disco" value={bytes(status.database?.diskSize)} detail={`${number(status.database?.deleted)} documentos eliminados`} />
            <Metric icon={ActivityIcon} title="Secuencia actual" value={sequence(status.database?.updateSequence)} detail="Checkpoint local de la base" compact />
          </section>

          <Tabs defaultValue="history" className="gap-5">
            <TabsList>
              <TabsTrigger value="history">Historial ({status.changes.length})</TabsTrigger>
              <TabsTrigger value="status">Estado técnico</TabsTrigger>
              <TabsTrigger value="conflicts">Conflictos ({conflictCount})</TabsTrigger>
              <TabsTrigger value="audit">Auditoría ({status.audit.length + status.commands.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="flex flex-col gap-4">
              <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <CardTitle>Últimos cambios en documentos</CardTitle>
                    <CardDescription>CouchDB informa la secuencia y revisión; no se exponen contenidos clínicos en este panel.</CardDescription>
                  </div>
                  <div className="relative w-full sm:max-w-sm">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por ID, tipo o revisión" className="pl-9" />
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredChanges.length ? (
                    <ol className="relative flex flex-col before:absolute before:bottom-5 before:left-[0.4375rem] before:top-5 before:w-px before:bg-border">
                      {filteredChanges.map((change) => (
                        <li key={`${change.sequence}-${change.id}`} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-4 py-4">
                          <span className="relative mt-1.5 size-3 rounded-full border-2 border-background bg-primary ring-1 ring-border" />
                          <div className="flex min-w-0 flex-col gap-2 border-b pb-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={change.deleted ? "destructive" : "secondary"}>{change.deleted ? "Eliminado" : label(change.type)}</Badge>
                              <span className="break-all text-sm font-medium">{change.id}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
                              <span>rev {change.revision ?? "—"}</span>
                              <span>seq {change.sequence}</span>
                              {change.revisions.length > 1 && <span>{change.revisions.length} hojas</span>}
                            </div>
                            <time className="text-xs text-muted-foreground">{date(change.updatedAt)}</time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><FilterIcon /></EmptyMedia>
                        <EmptyTitle>No hay cambios que coincidan</EmptyTitle>
                        <EmptyDescription>{query ? "Prueba con otro ID, tipo o revisión." : "CouchDB todavía no devolvió cambios para esta base."}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status" className="flex flex-col gap-4">
              {issues.map((issue, index) => (
                <Alert key={`${issue.stage}-${index}`} variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>{label(issue.stage)}{issue.status ? ` · HTTP ${issue.status}` : ""}</AlertTitle>
                  <AlertDescription>{issue.message}</AlertDescription>
                </Alert>
              ))}
              <div className="grid gap-4 lg:grid-cols-3">
                <ServiceCard icon={DatabaseIcon} title="Datos" status={issues.some((issue) => issue.stage === "data") ? "Reintento" : snapshot?.paused ? "En pausa" : "Supervisado"} value={snapshot?.replication.reduce((sum, item) => sum + (item.pending ?? 0), 0)} suffix="cambios pendientes" />
                <ServiceCard icon={FileImageIcon} title="Archivos" status={issues.some((issue) => issue.stage === "files") ? "Reintento" : "Supervisado"} value={snapshot?.files?.pending} suffix={`${number(snapshot?.files?.transferred)} transferidos en el último ciclo`} />
                <ServiceCard icon={UsersIcon} title="Cuentas" status={snapshot?.accounts?.ok ? "Actualizadas" : "Sin confirmación"} value={snapshot?.accounts?.count} suffix="cuentas con contraseña" />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Replicación nativa</CardTitle>
                  <CardDescription>Contadores informados por el planificador de CouchDB. “—” significa que CouchDB no entregó esa medición.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {(["push", "pull"] as const).map((direction) => {
                    const replication = snapshot?.replication.find((item) => item.direction === direction);
                    return (
                      <div key={direction} className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                          {direction === "push" ? <ArrowUpIcon className="size-5" /> : <ArrowDownIcon className="size-5" />}
                        </div>
                        <div className="min-w-44 flex-1">
                          <p className="font-medium">{direction === "push" ? "Raspberry → nube" : "Nube → Raspberry"}</p>
                          <p className="text-xs text-muted-foreground">{label(replication?.state)}</p>
                        </div>
                        <dl className="flex gap-8 text-sm">
                          <div><dt className="text-xs text-muted-foreground">Pendientes</dt><dd className="font-semibold tabular-nums">{number(replication?.pending)}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">Escritos</dt><dd className="font-semibold tabular-nums">{number(replication?.written)}</dd></div>
                          <div><dt className="text-xs text-muted-foreground">Fallos</dt><dd className="font-semibold tabular-nums">{number(replication?.failures)}</dd></div>
                        </dl>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-4 shrink-0" />
                El historial muestra metadatos operativos. Los contenidos clínicos permanecen en sus pantallas autorizadas.
              </p>
            </TabsContent>

            <TabsContent value="conflicts" className="flex flex-col gap-4">
              {!conflictCount && (
                <Card><CardContent>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><CheckCircle2Icon /></EmptyMedia>
                      <EmptyTitle>Sin conflictos detectados</EmptyTitle>
                      <EmptyDescription>Las diferencias que necesiten una decisión aparecerán aquí.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </CardContent></Card>
              )}
              {status.conflicts.map((conflict) => (
                <Card key={conflict.id} size="sm">
                  <CardHeader><CardTitle>{label(conflict.type)}</CardTitle><CardDescription className="break-all">{conflict.id}</CardDescription></CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{conflict.revisions.length} versiones</Badge>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void inspect(conflict.id)}>Comparar</Button>
                  </CardContent>
                </Card>
              ))}
              {conflictId && (
                <Card>
                  <CardHeader><CardTitle>Seleccionar versión completa</CardTitle><CardDescription>La decisión quedará registrada con las revisiones involucradas.</CardDescription></CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <Button variant="ghost" className="self-end" onClick={() => { setConflictId(""); setVersions([]); }}>Cerrar comparación</Button>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {versions.map((version, index) => (
                        <section key={String(version._rev)} className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
                          <h3 className="font-semibold">Versión {index + 1}</h3>
                          <p className="break-all font-mono text-xs text-muted-foreground">{String(version._rev)}</p>
                          <dl className="flex max-h-80 flex-col gap-2 overflow-auto text-sm">
                            {Object.entries(version).filter(([key]) => !key.startsWith("_")).map(([key, value]) => (
                              <div key={key} className="border-b pb-2 last:border-0">
                                <dt className="font-medium">{key}</dt>
                                <dd className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "—")}</dd>
                              </div>
                            ))}
                          </dl>
                          <Button variant="outline" disabled={busy} onClick={async () => {
                            if (confirm("¿Conservar esta versión completa?")) {
                              if (await mutate("conflicts", { id: conflictId, selected: version._rev, expected: versions.map((item) => item._rev) })) {
                                setConflictId(""); setVersions([]);
                              }
                            }
                          }}>Conservar versión {index + 1}</Button>
                        </section>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {status.fileConflicts.map((conflict) => (
                <Card key={conflict.id}>
                  <CardHeader><CardTitle>Dos contenidos para un archivo</CardTitle><CardDescription className="break-all">{conflict.key}</CardDescription></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {(["current", "candidate"] as const).map((selected) => (
                      <div key={selected} className="flex flex-col gap-2 rounded-xl border p-4">
                        <p className="font-medium">{selected === "current" ? "Actual" : "Recibido"}</p>
                        <p className="text-sm">{bytes(conflict[selected].size)}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">{conflict[selected].sha256}</p>
                        {status.environment === "cloud" && <Button variant="outline" disabled={busy} onClick={() => {
                          if (confirm("¿Conservar este contenido?")) void mutate("files", { id: conflict.id, selected, expected: [conflict.current.sha256, conflict.candidate.sha256] });
                        }}>Conservar</Button>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="audit" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Órdenes del administrador</CardTitle><CardDescription>Una orden pendiente todavía no fue ejecutada por la Raspberry.</CardDescription></CardHeader>
                <CardContent>
                  {status.commands.length ? <ol className="flex flex-col">{[...status.commands].reverse().map((command) => (
                    <li key={command.id} className="flex items-center gap-3 border-b py-4 last:border-0">
                      <HistoryIcon className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label(command.action)}</p><p className="text-xs text-muted-foreground">{date(command.createdAt)}</p></div>
                      <Badge variant={command.state === "pending" ? "secondary" : "outline"}>{label(command.state)}</Badge>
                    </li>
                  ))}</ol> : <AuditEmpty title="Sin órdenes registradas" />}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Decisiones de conflictos</CardTitle><CardDescription>Conserva quién decidió, qué elemento y cuándo terminó.</CardDescription></CardHeader>
                <CardContent>
                  {status.audit.length ? <ol className="flex flex-col">{status.audit.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 border-b py-4 first:pt-0 last:border-0">
                      <div className="flex items-center gap-2"><Badge variant="outline">{label(item.kind)}</Badge><Badge variant="secondary">{label(item.state)}</Badge></div>
                      <p className="break-all text-sm font-medium">{item.target ?? item.id}</p>
                      <p className="text-xs text-muted-foreground">{date(item.completedAt ?? item.createdAt)}{item.actorId ? ` · administrador ${item.actorId}` : ""}</p>
                    </li>
                  ))}</ol> : <AuditEmpty title="Sin decisiones registradas" />}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}

function Endpoint({ icon: Icon, title, detail, badge }: { icon: typeof LaptopIcon; title: string; detail: string; badge: string }) {
  return <div className="flex flex-col items-center gap-3 text-center">
    <div className="flex size-16 items-center justify-center rounded-2xl bg-muted"><Icon className="size-8" /></div>
    <div><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{detail}</p></div>
    <Badge variant="outline">{badge}</Badge>
  </div>;
}

function Metric({ icon: Icon, title, value, detail, compact = false }: { icon: typeof DatabaseIcon; title: string; value: string; detail: string; compact?: boolean }) {
  return <Card>
    <CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><CardTitle className="text-sm">{title}</CardTitle><Icon className="size-4 text-muted-foreground" /></div></CardHeader>
    <CardContent><p className={compact ? "break-all font-mono text-xl font-semibold" : "text-3xl font-semibold tabular-nums"}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
  </Card>;
}

function ServiceCard({ icon: Icon, title, status, value, suffix }: { icon: typeof DatabaseIcon; title: string; status: string; value?: number | null; suffix: string }) {
  return <Card>
    <CardHeader><div className="flex items-center justify-between gap-2"><Icon className="size-5 text-muted-foreground" /><Badge variant="secondary">{status}</Badge></div><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent><p className="text-4xl font-semibold tabular-nums">{number(value)}</p><p className="mt-1 text-sm text-muted-foreground">{suffix}</p></CardContent>
  </Card>;
}

function AuditEmpty({ title }: { title: string }) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>Los eventos aparecerán aquí cuando ocurran.</EmptyDescription></EmptyHeader></Empty>;
}
