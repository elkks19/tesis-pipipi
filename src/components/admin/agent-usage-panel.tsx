"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  Clock3Icon,
  FileDownIcon,
  LoaderCircleIcon,
  SearchIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AgentUsageRow = {
  action: "artifact_changed" | "pdf_generated" | "preset_report" | "query";
  actorEmail?: string;
  actorId: string;
  actorName: string;
  artifactCount?: number;
  completedAt: string;
  conversationId?: string;
  createdAt: string;
  durationMs: number;
  environment: "cloud" | "raspberry";
  errorCode?: string;
  id: string;
  intent?: string;
  messageIndex?: number;
  model?: string;
  nodeId: string;
  provider?: string;
  sourceCount?: number;
  status: "cancelled" | "failed" | "succeeded";
  tools?: Array<{ name: string; status: "failed" | "succeeded" }>;
};

type Actor = { email: string; id: string; name: string };

type UsageResponse = {
  actors: Actor[];
  hasNextPage: boolean;
  nextCursor?: string;
  rows: AgentUsageRow[];
};

type UsageDetail = {
  event: AgentUsageRow;
  message?: {
    answer: string;
    artifacts: unknown[];
    question: string;
    sources: unknown[];
  };
};

const actionLabels: Record<AgentUsageRow["action"], string> = {
  artifact_changed: "Visualización",
  pdf_generated: "PDF",
  preset_report: "Reporte",
  query: "Consulta",
};

const statusLabels: Record<AgentUsageRow["status"], string> = {
  cancelled: "Cancelado",
  failed: "Fallido",
  succeeded: "Completado",
};

export function AgentUsagePanel() {
  const [rows, setRows] = useState<AgentUsageRow[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [actorId, setActorId] = useState("all");
  const [action, setAction] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pending, setPending] = useState(true);
  const [detail, setDetail] = useState<UsageDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);

  const load = useCallback(
    async (mode: "append" | "replace", cursor?: string) => {
      setPending(true);
      try {
        const params = new URLSearchParams({ limit: "25" });
        if (actorId !== "all") params.set("actorId", actorId);
        if (action !== "all") params.set("action", action);
        if (status !== "all") params.set("status", status);
        if (from) params.set("from", new Date(`${from}T00:00:00-04:00`).toISOString());
        if (to) params.set("to", new Date(`${to}T23:59:59-04:00`).toISOString());
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(`/api/admin/agent-usage?${params}`);
        const data = (await response.json()) as UsageResponse | { message?: string };
        if (!response.ok) {
          throw new Error("message" in data ? data.message : "No se pudo cargar la bitácora.");
        }

        const page = data as UsageResponse;
        setRows((current) =>
          mode === "append" ? mergeRows(current, page.rows) : page.rows,
        );
        setActors(page.actors);
        setHasNextPage(page.hasNextPage);
        setNextCursor(page.nextCursor);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cargar la bitácora.",
        );
      } finally {
        setPending(false);
      }
    },
    [action, actorId, from, status, to],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load("replace");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const metrics = useMemo(
    () => ({
      average:
        rows.length > 0
          ? Math.round(rows.reduce((total, row) => total + row.durationMs, 0) / rows.length)
          : 0,
      failed: rows.filter((row) => row.status === "failed").length,
      pdf: rows.filter((row) => row.action === "pdf_generated").length,
      queries: rows.filter((row) => row.action === "query").length,
    }),
    [rows],
  );

  async function openDetail(id: string) {
    setDetailPending(true);
    setDetail(null);
    try {
      const response = await fetch(
        `/api/admin/agent-usage/${encodeURIComponent(id)}`,
      );
      const data = (await response.json()) as UsageDetail | { message?: string };
      if (!response.ok) {
        throw new Error(
          "event" in data ? "No se pudo abrir el evento." : data.message,
        );
      }
      setDetail(data as UsageDetail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el evento.");
    } finally {
      setDetailPending(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BotIcon} label="Consultas visibles" value={metrics.queries} />
        <MetricCard icon={FileDownIcon} label="PDF generados" value={metrics.pdf} />
        <MetricCard icon={AlertCircleIcon} label="Fallos" value={metrics.failed} />
        <MetricCard
          icon={Clock3Icon}
          label="Duración promedio"
          value={formatDuration(metrics.average)}
        />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Actividad del agente</CardTitle>
          <CardDescription>
            Metadatos operativos de consultas, herramientas, visualizaciones y reportes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Select onValueChange={setActorId} value={actorId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Usuario" /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {actors.map((actor) => (
                  <SelectItem key={actor.id} value={actor.id}>{actor.name}</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
            <Select onValueChange={setAction} value={action}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Acción" /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {Object.entries(actionLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
            <Input aria-label="Desde" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
            <Input aria-label="Hasta" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nodo</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-40 flex-col">
                          <span className="font-medium">{row.actorName}</span>
                          <span className="text-xs text-muted-foreground">{row.actorEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>{actionLabels[row.action]}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{row.nodeId}</span>
                          <span className="text-muted-foreground">{row.environment}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDuration(row.durationMs)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          disabled={detailPending}
                          onClick={() => void openDetail(row.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <SearchIcon aria-hidden="true" data-icon="inline-start" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && !pending ? (
                    <TableRow>
                      <TableCell className="h-28 text-center text-muted-foreground" colSpan={7}>
                        No hay eventos para estos filtros.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {rows.length} eventos cargados
            </span>
            <Button
              disabled={!hasNextPage || !nextCursor || pending}
              onClick={() => void load("append", nextCursor)}
              size="sm"
              variant="outline"
            >
              {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : null}
              Cargar más
            </Button>
          </div>
        </CardContent>
      </Card>

      <UsageDetailDialog
        detail={detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        open={Boolean(detail)}
      />
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BotIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AgentUsageRow["status"] }) {
  const variant =
    status === "failed" ? "destructive" : status === "succeeded" ? "secondary" : "outline";
  return (
    <Badge variant={variant}>
      {status === "succeeded" ? <CheckCircle2Icon /> : status === "failed" ? <AlertCircleIcon /> : <Clock3Icon />}
      {statusLabels[status]}
    </Badge>
  );
}

function UsageDetailDialog({
  detail,
  onOpenChange,
  open,
}: {
  detail: UsageDetail | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
        {detail ? (
          <>
            <DialogHeader>
              <DialogTitle>{actionLabels[detail.event.action]}</DialogTitle>
              <DialogDescription>
                {detail.event.actorName} · {formatDate(detail.event.createdAt)} · {detail.event.nodeId}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              <DetailValue label="Estado" value={statusLabels[detail.event.status]} />
              <DetailValue label="Duración" value={formatDuration(detail.event.durationMs)} />
              <DetailValue label="Modelo" value={[detail.event.provider, detail.event.model].filter(Boolean).join(" / ") || "No disponible"} />
            </div>

            {detail.event.tools?.length ? (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <WrenchIcon className="size-4" /> Herramientas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detail.event.tools.map((tool) => (
                    <Badge key={tool.name} variant="outline">{tool.name}</Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {detail.message ? (
              <section className="flex flex-col gap-4 border-t pt-4">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consulta enlazada</h3>
                  <p className="whitespace-pre-wrap text-sm">{detail.message.question}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta enlazada</h3>
                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm leading-6">
                    {detail.message.answer}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {detail.message.artifacts.length} artefactos · {detail.message.sources.length} fuentes
                </p>
              </section>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">
                Este evento no tiene una respuesta de conversación enlazada.
              </p>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function mergeRows(current: AgentUsageRow[], incoming: AgentUsageRow[]) {
  const byId = new Map(current.map((row) => [row.id, row]));
  incoming.forEach((row) => byId.set(row.id, row));
  return [...byId.values()];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(new Date(value));
}

function formatDuration(value: number) {
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} s`;
}
