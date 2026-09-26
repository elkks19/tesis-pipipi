"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, CloudIcon, HardDriveIcon, PauseIcon, PlayIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";

type Replication = { direction: string; state: string; pending: number | null; written: number | null; failures: number; error?: string | null };
type Status = {
  environment: string; enabled: boolean; configured: boolean; nodeId: string; stale: boolean; updatedAt?: string;
  snapshot: null | { paused: boolean; error?: string | null; replication: Replication[]; files: null | { transferred: number; pending: number; conflicts: number }; accounts: null | { ok: boolean; count: number }; conflicts: number | null };
  commands: { id: string; action: string; state: string; createdAt: string }[];
  trips: { tripId: string; phase: string }[];
  availableTrips?: { id: string; name: string }[];
  conflicts: { id: string; type: string; revisions: string[] }[];
  fileConflicts: { id: string; key: string; current: { sha256: string; size: number }; candidate: { sha256: string; size: number } }[];
};
const states: Record<string, string> = { running: "En ejecución", completed: "Completado", pending: "Pendiente", failed: "Error", crashing: "Reintentando", not_started: "Sin iniciar", cloud: "Control en la nube", preparing: "Preparando Raspberry", raspberry: "Control en Raspberry", returning: "Devolución pendiente", sync: "Sincronizar ahora", pause: "Pausar", resume: "Reanudar", prepare: "Preparar viaje", return: "Devolver viaje" };
const label = (value: string) => states[value] ?? value;
const date = (value?: string) => value ? new Date(value).toLocaleString("es-BO") : "Sin comunicación registrada";

export function SyncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tripId, setTripId] = useState("");
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [conflictId, setConflictId] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sync/status", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo consultar el estado de sincronización.");
      setStatus(await response.json()); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Sin conexión con el servidor."); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [refresh]);
  async function mutate(path: string, body: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sync/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
      toast.success(response.status === 202 ? "Solicitud registrada. Se aplicará cuando el dispositivo se comunique." : "Operación registrada.");
      await refresh(); return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo completar la operación."); return false; }
    finally { setBusy(false); }
  }
  async function inspect(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/sync/conflicts?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron consultar las revisiones.");
      setVersions(await response.json()); setConflictId(id);
    } catch { toast.error("No se pudieron consultar las revisiones."); }
    finally { setBusy(false); }
  }
  const snapshot = status?.snapshot;
  const ready = status?.enabled && status.configured;
  const caughtUp = ready && !status.stale && !snapshot?.error && !snapshot?.paused && snapshot?.replication.length === 2 && snapshot.replication.every((r) => r.pending === 0 && r.failures === 0 && r.state === "running") && snapshot.files?.pending === 0 && snapshot.files.conflicts === 0 && snapshot.accounts?.ok && snapshot.conflicts === 0 && status.fileConflicts.length === 0;
  const selectedTrip = status?.trips.find((trip) => trip.tripId === tripId);
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div className="flex flex-col gap-2"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Administración · Continuidad del viaje</p><h1 className="font-heading text-3xl font-semibold">Sincronización</h1><p className="max-w-xl text-sm text-muted-foreground">Datos disponibles en el viaje, cambios compartidos al recuperar conexión.</p></div>
      <Badge variant="outline">{status?.environment === "raspberry" ? <HardDriveIcon /> : <CloudIcon />}{status?.environment === "raspberry" ? "Raspberry Pi" : "Servidor en la nube"}</Badge>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error} El último estado puede estar desactualizado.</p>}
    {!status ? <p role="status">Consultando estado…</p> : <>
      <Card><CardHeader><CardTitle>{!status.enabled ? "Sincronización desactivada" : !status.configured ? "Configuración pendiente" : caughtUp ? "Todo sincronizado" : status.stale ? "Estado desactualizado" : snapshot?.paused ? "Sincronización pausada" : "Sincronización en seguimiento"}</CardTitle><CardDescription>{!ready ? "Completa las variables de ambos servidores y activa SYNC_ENABLED para comenzar." : `Última comunicación: ${date(status.updatedAt)}. ${status.stale ? "La nube no puede confirmar el estado actual de la Raspberry." : "Los datos, archivos y cuentas se verifican por separado."}`}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">
        <Button disabled={!ready || busy} onClick={() => void mutate("commands", { action: "sync" })}><RefreshCwIcon data-icon="inline-start" />Sincronizar ahora</Button>
        <Button variant="outline" disabled={!ready || busy} onClick={() => void mutate("commands", { action: snapshot?.paused ? "resume" : "pause" })}>{snapshot?.paused ? <PlayIcon data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}{snapshot?.paused ? "Reanudar" : "Pausar"}</Button>
        <Button variant="ghost" onClick={() => void refresh()}>Actualizar estado</Button>
      </CardContent></Card>
      {snapshot?.error && <p role="alert" className="text-sm text-destructive">{snapshot.error}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Datos</CardTitle><CardDescription>Replicación nativa de CouchDB</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{snapshot?.replication?.length ? snapshot.replication.map((r) => <div key={r.direction} className="flex flex-col gap-1"><p className="flex items-center gap-2 text-sm font-medium">{r.direction === "push" ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}{r.direction === "push" ? "Raspberry → nube" : "Nube → Raspberry"}</p><p className="text-sm text-muted-foreground">{label(r.state)} · {r.pending ?? "No disponible"} pendientes</p><p className="text-xs text-muted-foreground">{r.written ?? "No disponible"} documentos escritos en la ejecución</p>{r.error && <p className="text-xs text-destructive">{r.error}</p>}</div>) : <p className="text-sm text-muted-foreground">Sin mediciones disponibles.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Archivos</CardTitle><CardDescription>Imágenes y reportes verificados</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{snapshot?.files?.pending ?? "—"}</p><p className="text-sm text-muted-foreground">pendientes · {snapshot?.files?.transferred ?? "—"} transferidos en el último ciclo</p><p className="mt-2 text-sm">{snapshot?.files?.conflicts ?? "—"} diferencias de contenido</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Cuentas</CardTitle><CardDescription>Administradas en la nube</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{snapshot?.accounts?.count ?? "—"}</p><p className="text-sm text-muted-foreground">cuentas con acceso por contraseña</p><p className="mt-2 text-sm">{snapshot?.accounts?.ok ? "Descarga aplicada" : "Descarga pendiente"}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Control operativo del viaje</CardTitle><CardDescription>La Raspberry opera el viaje mientras la nube lo mantiene en consulta. La devolución espera que termine la sincronización.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{status.environment === "cloud" ? <>
        <Field><FieldLabel htmlFor="sync-trip">Viaje</FieldLabel><Select value={tripId} onValueChange={setTripId}><SelectTrigger id="sync-trip" className="w-full"><SelectValue placeholder="Selecciona un viaje" /></SelectTrigger><SelectContent><SelectGroup>{status.availableTrips?.map((trip) => <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{label(selectedTrip?.phase ?? "cloud")}</Badge><Button disabled={!ready || busy || !tripId || Boolean(selectedTrip && selectedTrip.phase !== "cloud")} onClick={() => { if (confirm("¿Preparar este viaje en la Raspberry? La nube quedará en modo consulta hasta devolver el control.")) void mutate("commands", { action: "prepare", tripId }); }}>Preparar en Raspberry</Button><Button variant="outline" disabled={!ready || busy || selectedTrip?.phase !== "raspberry"} onClick={() => { if (confirm("¿Solicitar el cierre de escrituras en la Raspberry y devolver el control a la nube?")) void mutate("commands", { action: "return", tripId }); }}>Devolver a la nube</Button></div>
      </> : <p className="text-sm text-muted-foreground">La asignación y devolución se solicitan desde el panel de la nube.</p>}{status.trips.map((trip) => <p key={trip.tripId} className="text-sm">{status.availableTrips?.find((item) => item.id === trip.tripId)?.name ?? trip.tripId} · {label(trip.phase)}</p>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Conflictos para revisar</CardTitle><CardDescription>Compara las versiones y elige cuál conservar. No se reemplazan silenciosamente.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3">
        {!status.conflicts.length && !status.fileConflicts.length && <p className="text-sm text-muted-foreground">No hay conflictos detectados{status.stale ? " en el último estado disponible" : ""}.</p>}
        {status.conflicts.map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="min-w-0 break-all text-sm">{c.type} · {c.id}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => void inspect(c.id)}>Comparar versiones</Button></div>)}
        {conflictId && <section className="flex flex-col gap-3"><div className="flex items-center justify-between"><h2 className="font-medium">Revisiones de {conflictId}</h2><Button variant="ghost" onClick={() => { setConflictId(""); setVersions([]); }}>Cerrar</Button></div><div className="grid gap-3 lg:grid-cols-2">{versions.map((version) => <div key={String(version._rev)} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3"><p className="break-all text-xs">Revisión {String(version._rev)}</p><pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(version, null, 2)}</pre><Button disabled={busy} variant="outline" onClick={async () => { if (confirm("¿Conservar esta versión completa? La decisión quedará registrada.")) { if (await mutate("conflicts", { id: conflictId, selected: version._rev, expected: versions.map((v) => v._rev) })) { setConflictId(""); setVersions([]); } } }}>Conservar esta versión</Button></div>)}</div></section>}
        {status.fileConflicts.map((c) => <div className="flex flex-col gap-2 rounded-lg border p-3" key={c.id}><p className="break-all text-sm font-medium">{c.key}</p><p className="break-all text-xs text-muted-foreground">Actual: {c.current.size} bytes · SHA-256 {c.current.sha256}</p><p className="break-all text-xs text-muted-foreground">Recibido: {c.candidate.size} bytes · SHA-256 {c.candidate.sha256}</p><div className="flex flex-wrap gap-2">{["current", "candidate"].map((selected) => <Button key={selected} variant="outline" size="sm" disabled={busy} onClick={() => { if (confirm("¿Conservar este contenido del archivo y registrar la decisión?")) void mutate("files", { id: c.id, selected, expected: [c.current.sha256, c.candidate.sha256] }); }}>{selected === "current" ? "Conservar actual" : "Conservar recibido"}</Button>)}</div></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Solicitudes recientes</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{status.commands.length ? [...status.commands].reverse().map((c) => <div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0" key={c.id}><span>{label(c.action)} · {date(c.createdAt)}</span><Badge variant="outline">{label(c.state)}</Badge></div>) : <p className="text-sm text-muted-foreground">Aún no hay solicitudes.</p>}</CardContent></Card>
    </>}
  </main>;
}
