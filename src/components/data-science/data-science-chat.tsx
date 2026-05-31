"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FileDownIcon,
  FileTextIcon,
  HistoryIcon,
  ListFilterIcon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import {
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  CartesianGrid as RechartsCartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { DataScienceTripOption } from "@/lib/data-science-types";
import { cn } from "@/lib/utils";

type Artifact = {
  data: unknown;
  spec?: {
    kind?: string;
    x?: string;
    y?: string;
  } | null;
  title: string;
  type: string;
};

type Source = {
  chunk_id: string;
  document_id: string;
  document_type: string;
  metadata: Record<string, unknown>;
  score: number;
  title: string;
};

type ChartType = "auto" | "bar" | "line" | "pie" | "table";

type ChatResponse = {
  answer: string;
  assistant_message_index?: number | null;
  artifacts: Artifact[];
  conversation_id?: string | null;
  intent: string;
  sources: Source[];
};

type Message = {
  answer: string;
  assistantMessageIndex?: number;
  artifacts: Artifact[];
  id: string;
  intent: string;
  question: string;
  sources: Source[];
};

type StoredChatSummary = {
  id: string;
  messageCount: number;
  summary: string;
  title: string;
  updatedAt?: string | null;
};

type StoredChatMessage = {
  artifacts: Artifact[];
  content: string;
  createdAt: string;
  messageIndex: number;
  intent?: string | null;
  role: string;
  sources: Source[];
};

type StoredChatDetail = StoredChatSummary & {
  messages: StoredChatMessage[];
};

const stationOptions = [
  { label: "Todas las estaciones", value: "all" },
  { label: "Anamnesis", value: "anamnesis" },
  { label: "Examen fisico general", value: "examen-fisico-general" },
  { label: "Examen fisico segmentario", value: "examen-fisico-segmentario" },
  { label: "Ecografia", value: "ecografia" },
  { label: "Electrocardiograma", value: "electrocardiograma" },
  { label: "Espirometria", value: "espirometria" },
  { label: "Laboratorios", value: "laboratorios" },
  { label: "Diagnostico", value: "diagnostico" },
];

const promptSuggestions = [
  "Muestrame la distribucion por genero",
  "Cuantas historias tienen diagnostico principal registrado?",
  "Resume los antecedentes frecuentes en el viaje filtrado",
  "Calcula el IMC promedio de las historias con examen fisico general",
];

const chartTypeOptions = [
  { label: "Automatico", value: "auto" },
  { label: "Tabla", value: "table" },
  { label: "Barras", value: "bar" },
  { label: "Lineas", value: "line" },
  { label: "Torta", value: "pie" },
] satisfies { label: string; value: ChartType }[];

const chartConfig = {
  value: {
    color: "var(--primary)",
    label: "Total",
  },
} satisfies ChartConfig;

export function DataScienceChat({
  trips,
}: {
  trips: DataScienceTripOption[];
}) {
  const [chats, setChats] = useState<StoredChatSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatsPending, setIsChatsPending] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripSearch, setTripSearch] = useState("");
  const [stationKey, setStationKey] = useState("all");
  const [chartType, setChartType] = useState<ChartType>("auto");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const canSubmit = message.trim().length > 0 && !pending;
  const selectedTrips = trips.filter((trip) => selectedTripIds.includes(trip.id));
  const filteredTrips = trips.filter((trip) =>
    normalizeSearch(
      `${trip.label} ${trip.secondaryLabel} ${trip.dateLabel}`,
    ).includes(normalizeSearch(tripSearch)),
  );
  const selectedStation = stationOptions.find(
    (station) => station.value === stationKey,
  );
  const tripScopeLabel =
    selectedTrips.length === 0
      ? "Todos los viajes"
      : selectedTrips.length === 1
        ? selectedTrips[0]?.label ?? "1 viaje seleccionado"
        : `${selectedTrips.length} viajes seleccionados`;
  const tripScopeDescription =
    selectedTrips.length === 0
      ? "Analisis global de todos los viajes disponibles"
      : selectedTrips.length === 1
        ? `${selectedTrips[0]?.secondaryLabel} · ${selectedTrips[0]?.dateLabel}`
        : selectedTrips.map((trip) => trip.label).join(", ");
  const hiddenSelectedTrips = Math.max(0, selectedTrips.length - 3);

  function toggleTrip(tripId: string) {
    setSelectedTripIds((current) =>
      current.includes(tripId)
        ? current.filter((id) => id !== tripId)
        : [...current, tripId],
    );
  }

  async function loadChats() {
    setIsChatsPending(true);
    try {
      const response = await fetch("/api/data-science/chats");
      const data = (await response.json()) as StoredChatSummary[];

      if (!response.ok) {
        throw new Error("No se pudo cargar el historial.");
      }

      setChats(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el historial.",
      );
    } finally {
      setIsChatsPending(false);
    }
  }

  async function openChat(chatId: string) {
    setIsChatsPending(true);
    try {
      const response = await fetch(`/api/data-science/chats/${encodeURIComponent(chatId)}`);
      const data = (await response.json()) as StoredChatDetail;

      if (!response.ok) {
        throw new Error("No se pudo abrir la conversacion.");
      }

      setConversationId(data.id);
      setMessages(storedMessagesToConversation(data.messages));
      scrollChatToBottom();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo abrir la conversacion.",
      );
    } finally {
      setIsChatsPending(false);
    }
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setMessage("");
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({
          behavior: "smooth",
          top: chatScrollRef.current.scrollHeight,
        });
      });
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialChats() {
      try {
        const response = await fetch("/api/data-science/chats");
        const data = (await response.json()) as StoredChatSummary[];

        if (!response.ok) {
          throw new Error("No se pudo cargar el historial.");
        }

        if (!cancelled) {
          setChats(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el historial.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsChatsPending(false);
        }
      }
    }

    void loadInitialChats();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitChat() {
    const question = message.trim();
    if (!question) {
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/data-science/chat", {
        body: JSON.stringify({
          message: question,
          scope: {
            stationKey: stationKey === "all" ? undefined : stationKey,
            viajeIds:
              selectedTripIds.length > 0 ? selectedTripIds : undefined,
          },
          chartType,
          conversationId,
          topK: 6,
        }),
        method: "POST",
      });
      const data = (await response.json()) as ChatResponse | { detail?: string };

      if (!response.ok) {
        throw new Error("detail" in data ? data.detail : "Consulta fallida.");
      }

      const result = data as ChatResponse;
      const nextConversationId = result.conversation_id ?? conversationId;
      setConversationId(nextConversationId);
      setMessages((current) => [
        ...current,
        {
          answer: result.answer,
          assistantMessageIndex: result.assistant_message_index ?? undefined,
          artifacts: result.artifacts,
          id: crypto.randomUUID(),
          intent: result.intent,
          question,
          sources: result.sources,
        },
      ]);
      void loadChats();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar el servicio.",
      );
      setMessage(question);
    } finally {
      setPending(false);
      requestAnimationFrame(() => messageRef.current?.focus());
    }
  }

  async function generateReport() {
    setReportPending(true);

    try {
      const response = await fetch("/api/data-science/reports", {
        body: JSON.stringify({
          conversationId,
          scope: {
            stationKey: stationKey === "all" ? undefined : stationKey,
            viajeIds:
              selectedTripIds.length > 0 ? selectedTripIds : undefined,
          },
        }),
        method: "POST",
      });
      const data = (await response.json()) as ChatResponse | { detail?: string };

      if (!response.ok) {
        throw new Error("detail" in data ? data.detail : "No se pudo generar el reporte.");
      }

      const result = data as ChatResponse;
      const reportMessage = {
        answer: result.answer,
        assistantMessageIndex: result.assistant_message_index ?? undefined,
        artifacts: result.artifacts,
        id: crypto.randomUUID(),
        intent: result.intent,
        question: "Generar reporte estadistico",
        sources: result.sources,
      };
      setConversationId(result.conversation_id ?? conversationId);
      setMessages((current) => [...current, reportMessage]);
      scrollChatToBottom();
      await downloadReport(reportMessage);
      toast.success("Reporte generado y descargado.");
      void loadChats();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el reporte.",
      );
    } finally {
      setReportPending(false);
    }
  }

  async function updateArtifact(
    messageIndex: number,
    artifactIndex: number,
    chartType: Exclude<ChartType, "auto">,
  ) {
    const currentMessage = messages[messageIndex];
    if (!conversationId || currentMessage?.assistantMessageIndex === undefined) {
      toast.error("No se pudo guardar este cambio.");
      return;
    }

    try {
      const response = await fetch(
        `/api/data-science/chats/${encodeURIComponent(conversationId)}/artifacts/${currentMessage.assistantMessageIndex}/${artifactIndex}`,
        {
          body: JSON.stringify({ chartType }),
          method: "PATCH",
        },
      );
      const artifact = (await response.json()) as Artifact | { detail?: string };

      if (!response.ok) {
        throw new Error("detail" in artifact ? artifact.detail : "No se pudo guardar el cambio.");
      }

      setMessages((current) =>
        current.map((item, index) =>
          index === messageIndex
            ? {
                ...item,
                artifacts: item.artifacts.map((currentArtifact, currentIndex) =>
                  currentIndex === artifactIndex
                    ? (artifact as Artifact)
                    : currentArtifact,
                ),
              }
            : item,
        ),
      );
      toast.success("Visualizacion actualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el cambio.",
      );
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
      <header className="flex flex-col gap-4 border-b p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-semibold">Asistente de investigacion</h2>
            <p className="text-sm text-muted-foreground">
              Elige el alcance y consulta las historias con lenguaje natural.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                  <HistoryIcon aria-hidden="true" data-icon="inline-start" />
                  Conversaciones
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader className="border-b">
                  <SheetTitle>Conversaciones recientes</SheetTitle>
                  <SheetDescription>
                    {isChatsPending ? "Actualizando" : `${chats.length} guardadas`}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
                  <SheetClose asChild>
                    <Button
                      className="mb-2 justify-start"
                      onClick={startNewChat}
                      variant="outline"
                    >
                      <PlusIcon aria-hidden="true" data-icon="inline-start" />
                      Nueva conversacion
                    </Button>
                  </SheetClose>
                  {chats.length > 0 ? (
                    chats.map((chat) => (
                      <SheetClose asChild key={chat.id}>
                        <button
                          className={[
                            "flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/60",
                            conversationId === chat.id ? "bg-muted" : "",
                          ].join(" ")}
                          onClick={() => void openChat(chat.id)}
                          type="button"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <MessageSquareTextIcon aria-hidden="true" />
                            <span className="truncate">{chat.title}</span>
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {chat.summary}
                          </span>
                        </button>
                      </SheetClose>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Tus conversaciones apareceran aqui.
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <Button
              disabled={reportPending}
              onClick={() => void generateReport()}
              size="sm"
              variant="outline"
            >
              {reportPending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <FileTextIcon aria-hidden="true" data-icon="inline-start" />
              )}
              Generar y descargar reporte
            </Button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_220px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Viajes
            </span>
            <Popover onOpenChange={setTripPickerOpen} open={tripPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="h-auto min-h-10 justify-between px-3 py-2 text-left font-normal"
                  variant="outline"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ListFilterIcon aria-hidden="true" data-icon="inline-start" />
                    <span className="min-w-0 truncate">{tripScopeLabel}</span>
                  </span>
                  <ChevronsUpDownIcon aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(620px,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
              >
                <PopoverHeader className="border-b p-4">
                  <PopoverTitle>Alcance del analisis</PopoverTitle>
                  <PopoverDescription>
                    Incluye todos los viajes o selecciona campañas específicas.
                  </PopoverDescription>
                </PopoverHeader>

                <div className="flex flex-col gap-3 border-b p-3">
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <SearchIcon aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Buscar viajes"
                      onChange={(event) => setTripSearch(event.target.value)}
                      placeholder="Buscar por lugar, servicio o fecha"
                      value={tripSearch}
                    />
                  </InputGroup>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => setSelectedTripIds([])}
                      size="sm"
                      type="button"
                      variant={selectedTripIds.length === 0 ? "default" : "outline"}
                    >
                      {selectedTripIds.length === 0 ? (
                        <CheckIcon aria-hidden="true" data-icon="inline-start" />
                      ) : null}
                      Incluir todos
                    </Button>
                    {selectedTripIds.length > 0 ? (
                      <Button
                        onClick={() => setSelectedTripIds([])}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <XIcon aria-hidden="true" data-icon="inline-start" />
                        Limpiar
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto p-2">
                  {filteredTrips.length > 0 ? (
                    filteredTrips.map((trip) => {
                      const checked = selectedTripIds.includes(trip.id);

                      return (
                        <label
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/60",
                            checked && "bg-muted",
                          )}
                          htmlFor={`trip-${trip.id}`}
                          key={trip.id}
                        >
                          <Checkbox
                            checked={checked}
                            id={`trip-${trip.id}`}
                            onCheckedChange={() => toggleTrip(trip.id)}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-sm font-medium">
                              {trip.label}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {trip.secondaryLabel} · {trip.dateLabel}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="p-5 text-center text-sm text-muted-foreground">
                      No hay viajes que coincidan con la busqueda.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t p-3">
                  <span className="text-xs text-muted-foreground">
                    {selectedTripIds.length === 0
                      ? "Se analizaran todos los viajes."
                      : `${selectedTripIds.length} viajes incluidos en el analisis.`}
                  </span>
                  <Button
                    onClick={() => setTripPickerOpen(false)}
                    size="sm"
                    type="button"
                  >
                    <CheckIcon aria-hidden="true" data-icon="inline-start" />
                    Listo
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {selectedTrips.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {selectedTrips.slice(0, 3).map((trip) => (
                  <Button
                    className="h-6 max-w-48 gap-1 px-2 text-xs"
                    key={trip.id}
                    onClick={() => toggleTrip(trip.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <span className="truncate">{trip.label}</span>
                    <XIcon aria-hidden="true" data-icon="inline-end" />
                  </Button>
                ))}
                {hiddenSelectedTrips > 0 ? (
                  <span className="self-center text-xs text-muted-foreground">
                    +{hiddenSelectedTrips} más
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="truncate text-xs text-muted-foreground">
                {tripScopeDescription}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Estacion
            </span>
            <Select onValueChange={setStationKey} value={stationKey}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Estacion" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="truncate text-xs text-muted-foreground">
              {selectedStation?.label ?? "Todas las estaciones"}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Resultado
            </span>
            <Select
              onValueChange={(value) => setChartType(value as ChartType)}
              value={chartType}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {chartTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="truncate text-xs text-muted-foreground">
              El asistente usara este formato cuando aplique.
            </span>
          </div>
        </div>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        ref={chatScrollRef}
      >
        {messages.length === 0 ? (
          <EmptyConversation onPickPrompt={setMessage} />
        ) : (
          messages.map((item, messageIndex) => (
            <ConversationMessage
              key={item.id}
              message={item}
              onChangeArtifact={(artifactIndex, nextType) =>
                void updateArtifact(messageIndex, artifactIndex, nextType)
              }
            />
          ))
        )}
      </div>

      <footer className="border-t p-4">
        <InputGroup>
          <InputGroupTextarea
            aria-label="Pregunta para investigacion"
            className="min-h-24"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submitChat();
              }
            }}
            placeholder="Pregunta sobre historias, hallazgos o comparaciones..."
            ref={messageRef}
            value={message}
          />
          <InputGroupAddon align="block-end" className="justify-between">
            <span>
              {pending ? "Procesando consulta" : "Ctrl/⌘ + Enter para enviar"}
            </span>
            <InputGroupButton
              disabled={!canSubmit}
              onClick={() => void submitChat()}
              size="sm"
              variant="default"
            >
              {pending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <SendIcon aria-hidden="true" data-icon="inline-start" />
              )}
              Enviar
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </footer>
    </section>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function EmptyConversation({
  onPickPrompt,
}: {
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 rounded-xl bg-muted/25 p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold">Haz una consulta investigativa</h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Puedes pedir conteos, resumenes clinicos, distribuciones o datos para
          comparaciones. Usa filtros de viaje y estacion cuando quieras acotar
          la revision.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {promptSuggestions.map((prompt) => (
          <Button
            className="h-auto justify-start whitespace-normal rounded-xl px-4 py-3 text-left"
            key={prompt}
            onClick={() => onPickPrompt(prompt)}
            variant="outline"
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ConversationMessage({
  message,
  onChangeArtifact,
}: {
  message: Message;
  onChangeArtifact: (
    artifactIndex: number,
    chartType: Exclude<ChartType, "auto">,
  ) => void;
}) {
  return (
    <article className="flex flex-col gap-3">
      <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
        {message.question}
      </div>
      <div className="max-w-[92%] rounded-2xl border bg-muted/25 px-4 py-3">
        <div className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap text-sm leading-6">{message.answer}</p>
          {message.intent === "report" && message.artifacts.length > 0 ? (
            <Button
              className="w-fit"
              onClick={() => void downloadReportWithToast(message)}
              size="sm"
              variant="outline"
            >
              <FileDownIcon aria-hidden="true" data-icon="inline-start" />
              Descargar reporte
            </Button>
          ) : null}
          {message.artifacts.length > 0 || message.sources.length > 0 ? (
            <Tabs defaultValue={message.artifacts.length > 0 ? "artifacts" : "sources"}>
              <TabsList>
                {message.artifacts.length > 0 ? (
                  <TabsTrigger value="artifacts">Resultados</TabsTrigger>
                ) : null}
                {message.sources.length > 0 ? (
                  <TabsTrigger value="sources">Fuentes</TabsTrigger>
                ) : null}
              </TabsList>
              {message.artifacts.length > 0 ? (
                <TabsContent className="flex flex-col gap-3" value="artifacts">
                  {message.artifacts.map((artifact, index) => (
                    <ArtifactView
                      artifact={artifact}
                      key={`${artifact.title}-${index}`}
                      onChange={(chartType) => onChangeArtifact(index, chartType)}
                    />
                  ))}
                </TabsContent>
              ) : null}
              {message.sources.length > 0 ? (
                <TabsContent value="sources">
                  <SourcesTable sources={message.sources} />
                </TabsContent>
              ) : null}
            </Tabs>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ArtifactView({
  artifact,
  onChange,
}: {
  artifact: Artifact;
  onChange: (chartType: Exclude<ChartType, "auto">) => void;
}) {
  const canChangeVisualization = Boolean(artifact.spec?.x && artifact.spec?.y);
  const selectedType =
    artifact.type === "table" ? "table" : artifact.spec?.kind ?? "bar";

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="font-medium">{artifact.title}</h4>
        {canChangeVisualization ? (
          <Select
            onValueChange={(value) =>
              onChange(value as Exclude<ChartType, "auto">)
            }
            value={selectedType}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {chartTypeOptions
                  .filter((option) => option.value !== "auto")
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {artifact.type === "chart" && Array.isArray(artifact.data) ? (
        <ArtifactChart artifact={artifact} />
      ) : artifact.type === "table" && Array.isArray(artifact.data) ? (
        <ArtifactTable rows={artifact.data as Record<string, unknown>[]} />
      ) : (
        <pre className="overflow-auto text-xs">
          {JSON.stringify(artifact.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ArtifactChart({ artifact }: { artifact: Artifact }) {
  const rows = artifact.data as Record<string, unknown>[];
  const xKey = artifact.spec?.x ?? Object.keys(rows[0] ?? {})[0] ?? "label";
  const yKey = artifact.spec?.y ?? Object.keys(rows[0] ?? {})[1] ?? "value";
  const data = rows.map((row) => ({
    label: String(row[xKey] ?? "Sin dato"),
    value: Number(row[yKey] ?? 0),
  }));
  const height = Math.max(220, data.length * 34);

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        className="w-full"
        config={chartConfig}
        initialDimension={{ height, width: 560 }}
        style={{ height }}
      >
        {artifact.spec?.kind === "pie" ? (
          <PieChart accessibilityLayer data={data}>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              innerRadius={52}
              nameKey="label"
              outerRadius={90}
            >
              {data.map((row, index) => (
                <Cell
                  fill={`var(--chart-${(index % 5) + 1}, var(--primary))`}
                  key={row.label}
                />
              ))}
            </Pie>
          </PieChart>
        ) : artifact.spec?.kind === "line" ? (
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ bottom: 4, left: 4, right: 28, top: 4 }}
          >
            <RechartsCartesianGrid vertical={false} />
            <RechartsXAxis dataKey="label" tickLine={false} />
            <RechartsYAxis tickLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Line
              dataKey="value"
              dot
              stroke="var(--color-value)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        ) : (
          <RechartsBarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ bottom: 4, left: 4, right: 28, top: 4 }}
          >
            <RechartsCartesianGrid horizontal={false} />
            <RechartsYAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
              type="category"
              width={150}
            />
            <RechartsXAxis dataKey="value" hide type="number" />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
            <RechartsBar dataKey="value" fill="var(--color-value)" radius={6} />
          </RechartsBarChart>
        )}
      </ChartContainer>
    </div>
  );
}

function storedMessagesToConversation(storedMessages: StoredChatMessage[]) {
  const result: Message[] = [];

  for (let index = 0; index < storedMessages.length; index += 1) {
    const current = storedMessages[index];
    const next = storedMessages[index + 1];

    if (current?.role !== "user") {
      continue;
    }

    result.push({
      answer: next?.role === "assistant" ? next.content : "",
      assistantMessageIndex:
        next?.role === "assistant" ? next.messageIndex : undefined,
      artifacts: next?.role === "assistant" ? next.artifacts : [],
      id: `${current.createdAt}-${index}`,
      intent: next?.intent ?? "semantic_search",
      question: current.content,
      sources: next?.role === "assistant" ? next.sources : [],
    });
  }

  return result;
}

function ArtifactTable({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column) => (
                  <TableCell key={column}>{String(row[column] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

async function downloadReport(message: Message) {
  const response = await fetch("/api/investigacion/reporte", {
    body: JSON.stringify({
      answer: message.answer,
      artifacts: message.artifacts,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("No se pudo descargar el PDF.");
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");

  link.href = url;
  link.download = `reporte-investigacion-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function downloadReportWithToast(message: Message) {
  try {
    await downloadReport(message);
    toast.success("PDF descargado.");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "No se pudo descargar el PDF.",
    );
  }
}

function SourcesTable({ sources }: { sources: Source[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-background">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fuente</TableHead>
              <TableHead>Seccion</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.chunk_id}>
                <TableCell className="min-w-56 font-medium">
                  {source.title}
                </TableCell>
                <TableCell>{String(source.metadata.section ?? "")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {source.score.toFixed(3)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
