"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FileImageIcon,
  HistoryIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UsersIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Issue = { stage: string; message: string; status?: number };
type Replication = { direction: string; state: string; pending: number | null; written: number | null; failures: number | null };
type Change = { sequence: string; id: string; type: string; revision: string | null; revisions: string[]; deleted: boolean; updatedAt: string | null };
type Status = {
  environment: string;
  enabled: boolean;
  configured: boolean;
  nodeId: string;
  stale: boolean;
  updatedAt?: string | null;
  diagnostics?: Issue[];
  changes: Change[];
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
  };
  commands: { id: string; action: string; state: string; actorId?: string; createdAt: string; completedAt?: string }[];
  conflicts: { id: string; type: string; revisions: string[] }[];
  fileConflicts: { id: string; key: string; current: { sha256: string; size: number }; candidate: { sha256: string; size: number } }[];
};

const labels: Record<string, string> = {
  accounts: "Cuentas",
  completed: "Procesada",
  configuration: "Configuración",
  connection: "Conexión",
  data: "Datos",
  failed: "Error",
  files: "Archivos",
  idle: "En espera",
  initializing: "Iniciando",
  pause: "Pausar",
  pending: "Pendiente",
  pull: "Nube → Raspberry",
  push: "Raspberry → nube",
  resume: "Reanudar",
  running: "Activa",
  sync: "Sincronizar",
};

export function SyncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [streamState, setStreamState] = useState<"connecting" | "open" | "retrying">("connecting");
  const [streamKey, setStreamKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [conflictId, setConflictId] = useState("");

  useEffect(() => {
    const source = new EventSource("/api/admin/sync/events");
    source.onopen = () => setStreamState("open");
    source.addEventListener("status", (event) => {
      try {
        setStatus(JSON.parse((event as MessageEvent<string>).data));
        setStreamState("open");
      } catch {
        setStreamState("retrying");
      }
    });
    source.onerror = () => setStreamState("retrying");
    return () => source.close();
  }, [streamKey]);

  async function mutate(path: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sync/${path}`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
      toast.success(response.status === 202 ? "Orden registrada; se aplicará al conectar." : "Decisión guardada.");
      setStreamKey((value) => value + 1);
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
      toast.error("No se pudieron consultar las versiones.");
    } finally {
      setBusy(false);
    }
  }

  const snapshot = status?.snapshot;
  const issues = [...(status?.diagnostics ?? []), ...(snapshot?.errors ?? [])];
  const replication = snapshot?.replication ?? [];
  const pendingData = replication.reduce((sum, item) => sum + (item.pending ?? 0), 0);
  const failedData = replication.reduce((sum, item) => sum + (item.failures ?? 0), 0);
  const conflicts = (status?.conflicts.length ?? 0) + (status?.fileConflicts.length ?? 0);
  const pendingCommands = status?.commands.filter((command) => command.state === "pending").length ?? 0;
  const ready = Boolean(status?.enabled && status.configured);
  const online = Boolean(ready && !status?.stale && snapshot?.connected);
  const caughtUp = Boolean(online && !snapshot?.running && !snapshot?.paused && !issues.length && pendingData === 0 && failedData === 0 && snapshot?.files?.pending === 0 && conflicts === 0);
  const headline = !status ? "Consultando estado"
    : !ready ? "Falta configuración"
      : status.stale ? "Estado desactualizado"
        : snapshot?.paused ? "Sincronización pausada"
          : issues.length ? "Requiere atención"
            : caughtUp ? "Todo al día"
              : snapshot?.running ? "Sincronizando" : "Supervisión activa";
  const recentChanges = useMemo(() => (status?.changes ?? []).slice(0, 8), [status?.changes]);
  const recentCommands = useMemo(() => [...(status?.commands ?? [])].reverse().slice(0, 6), [status?.commands]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-xl ${online ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
            {online ? <WifiIcon /> : <WifiOffIcon />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{headline}</h1><Badge variant="outline">{status?.environment ?? "—"}</Badge></div>
            <p className="text-xs text-muted-foreground">{status?.nodeId ?? "Nodo sin identificar"} · última comunicación {formatDate(status?.updatedAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !ready} onClick={() => void mutate("commands", { action: "sync" })} size="sm"><RefreshCwIcon data-icon="inline-start" />Sincronizar ahora</Button>
          {snapshot?.paused
            ? <Button disabled={busy || !ready} onClick={() => void mutate("commands", { action: "resume" })} size="sm" variant="outline"><PlayIcon data-icon="inline-start" />Reanudar</Button>
            : <Button disabled={busy || !ready} onClick={() => void mutate("commands", { action: "pause" })} size="sm" variant="outline"><PauseIcon data-icon="inline-start" />Pausar</Button>}
          <Button aria-label="Reconectar estado" disabled={busy} onClick={() => { setStreamState("connecting"); setStreamKey((value) => value + 1); }} size="icon-sm" variant="ghost"><RefreshCwIcon className={streamState !== "open" ? "animate-spin" : ""} /></Button>
        </div>
      </header>

      {!status ? <LoadingState /> : (
        <>
          {(!ready || status.stale || pendingCommands > 0) ? (
            <Alert variant={!ready ? "destructive" : "default"}>
              <TriangleAlertIcon />
              <AlertTitle>{!ready ? "Sincronización desactivada o incompleta" : status.stale ? "La Raspberry todavía no reportó un estado reciente" : `${pendingCommands} orden(es) esperando conexión`}</AlertTitle>
              <AlertDescription>{!ready ? "Revisa las variables SYNC_* del servidor." : "Las órdenes pendientes no se consideran ejecutadas hasta recibir confirmación."}</AlertDescription>
            </Alert>
          ) : null}

          <section className="grid gap-3 md:grid-cols-3">
            <CompactMetric icon={DatabaseIcon} label="Datos" main={number(pendingData)} note={`${number(failedData)} fallos · ${replication.length}/2 direcciones`} tone={failedData ? "danger" : pendingData ? "warning" : "ok"} />
            <CompactMetric icon={FileImageIcon} label="Archivos" main={number(snapshot?.files?.pending)} note={`${number(snapshot?.files?.transferred)} transferidos · ${number(snapshot?.files?.conflicts)} conflictos`} tone={snapshot?.files?.conflicts ? "danger" : snapshot?.files?.pending ? "warning" : "ok"} />
            <CompactMetric icon={UsersIcon} label="Cuentas" main={number(snapshot?.accounts?.count)} note={snapshot?.accounts?.ok ? "Última descarga correcta" : "Sin confirmación reciente"} tone={snapshot?.accounts?.ok ? "ok" : "warning"} />
          </section>

          {issues.length ? <section className="space-y-2">{issues.map((issue, index) => <Alert key={`${issue.stage}-${index}`} variant="destructive"><TriangleAlertIcon /><AlertTitle>{labels[issue.stage] ?? issue.stage}{issue.status ? ` · HTTP ${issue.status}` : ""}</AlertTitle><AlertDescription>{issue.message}</AlertDescription></Alert>)}</section> : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <Card size="sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><DatabaseIcon className="size-4" />Replicación</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(["push", "pull"] as const).map((direction) => {
                  const item = replication.find((entry) => entry.direction === direction);
                  return <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3" key={direction}>
                    {direction === "push" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{labels[direction]}</p><p className="text-xs text-muted-foreground">{labels[item?.state ?? ""] ?? item?.state ?? "Sin iniciar"}</p></div>
                    <div className="text-right"><p className="font-mono text-sm font-semibold">{number(item?.pending)}</p><p className="text-[11px] text-muted-foreground">pendientes</p></div>
                  </div>;
                })}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><HistoryIcon className="size-4" />Órdenes recientes</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {recentCommands.length ? recentCommands.map((command) => <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={command.id}><div className="min-w-0 flex-1"><p className="text-sm font-medium">{labels[command.action] ?? command.action}</p><p className="text-xs text-muted-foreground">{formatDate(command.createdAt)}</p></div><Badge variant={command.state === "pending" ? "secondary" : "outline"}>{labels[command.state] ?? command.state}</Badge></div>) : <p className="py-5 text-center text-sm text-muted-foreground">Sin órdenes registradas.</p>}
              </CardContent>
            </Card>
          </section>

          {(conflicts > 0 || conflictId) ? (
            <Card className="border-amber-500/30" size="sm">
              <CardHeader><CardTitle className="text-sm">Conflictos por resolver ({conflicts})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {status.conflicts.map((conflict) => <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" key={conflict.id}><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{conflict.id}</p><p className="text-xs text-muted-foreground">{conflict.revisions.length} revisiones</p></div><Button disabled={busy} onClick={() => void inspect(conflict.id)} size="sm" variant="outline">Comparar</Button></div>)}
                {conflictId ? <div className="grid gap-3 lg:grid-cols-2">{versions.map((version, index) => <section className="min-w-0 rounded-xl bg-muted/50 p-3" key={String(version._rev)}><p className="text-sm font-semibold">Versión {index + 1}</p><p className="break-all font-mono text-xs text-muted-foreground">{String(version._rev)}</p><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(Object.fromEntries(Object.entries(version).filter(([key]) => !key.startsWith("_"))), null, 2)}</pre><Button className="mt-3" disabled={busy} onClick={() => { if (confirm("¿Conservar esta versión completa?")) void mutate("conflicts", { id: conflictId, selected: version._rev, expected: versions.map((item) => item._rev) }).then((ok) => { if (ok) { setConflictId(""); setVersions([]); } }); }} size="sm">Conservar</Button></section>)}</div> : null}
                {status.fileConflicts.map((conflict) => <div className="rounded-xl border p-3" key={conflict.id}><p className="break-all text-sm font-medium">{conflict.key}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["current", "candidate"] as const).map((selected) => <Button className="h-auto justify-start py-3" disabled={busy} key={selected} onClick={() => { if (confirm("¿Conservar este contenido?")) void mutate("files", { id: conflict.id, selected, expected: [conflict.current.sha256, conflict.candidate.sha256] }); }} variant="outline"><span className="text-left"><span className="block text-xs font-semibold">{selected === "current" ? "Actual" : "Recibido"}</span><span className="block text-[11px] text-muted-foreground">{bytes(conflict[selected].size)}</span></span></Button>)}</div></div>)}
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm">
            <CardHeader><CardTitle className="text-sm">Cambios recientes</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {recentChanges.length ? recentChanges.map((change) => <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]" key={`${change.id}-${change.sequence}`}><div className="min-w-0"><p className="truncate font-mono text-xs font-medium">{change.id}</p><p className="text-xs text-muted-foreground">{change.type} · rev {change.revision ?? "—"}</p></div><time className="text-xs text-muted-foreground">{formatDate(change.updatedAt)}</time></div>) : <p className="py-5 text-center text-sm text-muted-foreground">CouchDB todavía no reportó cambios.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function CompactMetric({ icon: Icon, label, main, note, tone }: { icon: typeof DatabaseIcon; label: string; main: string; note: string; tone: "danger" | "ok" | "warning" }) {
  const tones = { danger: "text-destructive", ok: "text-emerald-700 dark:text-emerald-300", warning: "text-amber-700 dark:text-amber-300" };
  return <Card size="sm"><CardContent className="flex items-center gap-4"><div className="flex size-10 items-center justify-center rounded-xl bg-muted"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`text-2xl font-semibold tabular-nums ${tones[tone]}`}>{main}</p><p className="truncate text-xs text-muted-foreground">{note}</p></div>{tone === "ok" ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : tone === "danger" ? <TriangleAlertIcon className="size-4 text-destructive" /> : null}</CardContent></Card>;
}

function LoadingState() {
  return <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-28 rounded-xl" key={index} />)}</div>;
}

function number(value?: number | null) { return value == null ? "—" : value.toLocaleString("es-BO"); }
function formatDate(value?: string | null) { if (!value) return "no disponible"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "no disponible" : parsed.toLocaleString("es-BO"); }
function bytes(value: number) { const units = ["B", "KB", "MB", "GB"]; let size = value; let unit = 0; while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; } return `${size.toLocaleString("es-BO", { maximumFractionDigits: 1 })} ${units[unit]}`; }
