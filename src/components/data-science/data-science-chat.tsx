"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FileChartColumnIcon,
  FileDownIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SlidersHorizontalIcon,
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
  Scatter,
  ScatterChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  ZAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DataScienceTripOption,
  DataScienceTripSearchResponse,
} from "@/lib/data-science-types";
import { cn } from "@/lib/utils";

type Artifact = {
  data: unknown;
  spec?: {
    description?: string;
    group?: string;
    kind?: string;
    role?: "primary" | "summary" | "breakdown" | "evidence" | string;
    series?: string;
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

type ChartType = "auto" | "bar" | "line" | "pie" | "table" | "scatter" | "heatmap";
type ReportType = "general" | "perfil_epidemiologico" | "diagnosticos_poblacion";
type ReportKey = ReportType | "resumen_viaje";

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
  "Grafica la frecuencia de IMC",
  "Compara IMC por genero",
  "Cruza diagnosticos por grupo de edad",
  "Muestra glicemia por viaje",
];

const chartTypeOptions = [
  { label: "Automatico", value: "auto" },
  { label: "Tabla", value: "table" },
  { label: "Barras", value: "bar" },
  { label: "Lineas", value: "line" },
  { label: "Torta", value: "pie" },
  { label: "Dispersion", value: "scatter" },
  { label: "Mapa de calor", value: "heatmap" },
] satisfies { label: string; value: ChartType }[];

const reportTypeOptions = [
  {
    description: "Historias, diagnosticos, genero, IMC e indicadores disponibles en el alcance.",
    label: "Estadistico general",
    scope: "Uno o varios viajes · estacion opcional",
    value: "general",
  },
  {
    description: "Perfil de la poblacion atendida, hallazgos clinicos y cobertura de datos.",
    label: "Perfil epidemiologico",
    scope: "Uno o varios viajes · estacion opcional",
    value: "perfil_epidemiologico",
  },
  {
    description: "Frecuencias y cruces de diagnosticos por genero, edad, viaje e IMC.",
    label: "Diagnosticos por poblacion",
    scope: "Uno o varios viajes · estacion opcional",
    value: "diagnosticos_poblacion",
  },
] satisfies { description: string; label: string; scope: string; value: ReportType }[];

const chartConfig = {
  value: {
    color: "var(--primary)",
    label: "Total",
  },
} satisfies ChartConfig;

export function DataScienceChat() {
  const [chats, setChats] = useState<StoredChatSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatsPending, setIsChatsPending] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [selectedTripOptions, setSelectedTripOptions] = useState<
    DataScienceTripOption[]
  >([]);
  const [tripOptions, setTripOptions] = useState<DataScienceTripOption[]>([]);
  const [tripCursor, setTripCursor] = useState<string | null>(null);
  const [tripHasMore, setTripHasMore] = useState(true);
  const [isTripsPending, setIsTripsPending] = useState(false);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripMobilePickerOpen, setTripMobilePickerOpen] = useState(false);
  const [tripSearch, setTripSearch] = useState("");
  const [stationKey, setStationKey] = useState("all");
  const [chartType, setChartType] = useState<ChartType>("auto");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [reportPending, setReportPending] = useState<ReportKey | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const tripRequestIdRef = useRef(0);
  const canSubmit = message.trim().length > 0 && !pending;
  const selectedTrips = selectedTripOptions.filter((trip) =>
    selectedTripIds.includes(trip.id),
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

  function renderTripPickerContent({
    onDone,
  }: {
    onDone: () => void;
  }) {
    return (
      <div className="flex min-h-0 flex-col">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
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
              onClick={clearTrips}
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
                onClick={clearTrips}
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

        <div
          className="max-h-[52vh] min-h-56 overflow-y-auto p-2 sm:max-h-96"
          onScroll={handleTripListScroll}
        >
          {tripOptions.length > 0 ? (
            tripOptions.map((trip) => {
              const selected = selectedTripIds.includes(trip.id);

              return (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/60",
                    selected && "bg-muted",
                  )}
                  key={trip.id}
                  onClick={() => toggleTrip(trip)}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                  >
                    {selected ? <CheckIcon aria-hidden="true" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium">
                      {trip.label}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {trip.secondaryLabel} · {trip.dateLabel}
                    </span>
                  </span>
                </button>
              );
            })
          ) : !isTripsPending ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              No hay viajes que coincidan con la busqueda.
            </div>
          ) : null}
          {isTripsPending ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin"
                data-icon="inline-start"
              />
              Cargando viajes
            </div>
          ) : null}
          {!isTripsPending && tripOptions.length > 0 && !tripHasMore ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              No hay más viajes para esta búsqueda.
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-3 sm:p-4">
          <span className="text-xs text-muted-foreground">
            {selectedTripIds.length === 0
              ? "Se analizaran todos los viajes."
              : `${selectedTripIds.length} viajes incluidos en el analisis.`}
          </span>
          <Button onClick={onDone} size="sm" type="button">
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
            Listo
          </Button>
        </div>
      </div>
    );
  }

  function renderTripPicker() {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Viajes
        </span>

        <Popover onOpenChange={setTripPickerOpen} open={tripPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-expanded={tripPickerOpen}
              className="hidden h-auto min-h-12 w-full justify-between gap-3 px-3 py-2 text-left font-normal md:flex"
              role="combobox"
              variant="outline"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {tripScopeLabel}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {tripScopeDescription}
                </span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(760px,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
          >
            <PopoverHeader className="border-b p-4">
              <PopoverTitle>Buscar viajes</PopoverTitle>
              <PopoverDescription>
                Escribe un lugar, servicio o fecha. La lista carga más resultados al bajar.
              </PopoverDescription>
            </PopoverHeader>
            {renderTripPickerContent({
              onDone: () => setTripPickerOpen(false),
            })}
          </PopoverContent>
        </Popover>

        <Sheet
          onOpenChange={setTripMobilePickerOpen}
          open={tripMobilePickerOpen}
        >
          <SheetTrigger asChild>
            <Button
              aria-expanded={tripMobilePickerOpen}
              className="flex h-auto min-h-12 w-full justify-between gap-3 px-3 py-2 text-left font-normal md:hidden"
              role="combobox"
              variant="outline"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {tripScopeLabel}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {tripScopeDescription}
                </span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="shrink-0" />
            </Button>
          </SheetTrigger>
          <SheetContent className="max-h-[88svh] rounded-t-3xl p-0" side="bottom">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <SheetTitle>Buscar viajes</SheetTitle>
              <SheetDescription>
                Elige uno o varios viajes para acotar el analisis.
              </SheetDescription>
            </SheetHeader>
            {renderTripPickerContent({
              onDone: () => setTripMobilePickerOpen(false),
            })}
          </SheetContent>
        </Sheet>

        {selectedTrips.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {selectedTrips.slice(0, 3).map((trip) => (
              <Button
                className="h-6 max-w-48 gap-1 px-2 text-xs"
                key={trip.id}
                onClick={() => toggleTrip(trip)}
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
    );
  }

  function renderStationPicker() {
    return (
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
    );
  }

  function renderResultPicker() {
    return (
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
    );
  }

  const loadTripOptions = useCallback(
    async ({
      cursor,
      mode,
      query,
    }: {
      cursor?: string | null;
      mode: "append" | "replace";
      query: string;
    }) => {
      const requestId = tripRequestIdRef.current + 1;
      tripRequestIdRef.current = requestId;
      setIsTripsPending(true);

      try {
        const params = new URLSearchParams({
          limit: "20",
          q: query,
        });
        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await fetch(`/api/investigacion/viajes?${params}`);
        const data = (await response.json()) as
          | DataScienceTripSearchResponse
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in data ? data.message : "No se pudieron cargar los viajes.",
          );
        }

        const result = data as DataScienceTripSearchResponse;
        if (tripRequestIdRef.current !== requestId) {
          return;
        }

        setTripOptions((current) =>
          mode === "append"
            ? mergeTripOptions(current, result.items)
            : result.items,
        );
        setTripCursor(result.nextCursor);
        setTripHasMore(result.hasMore);
      } catch (error) {
        if (tripRequestIdRef.current !== requestId) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los viajes.",
        );
      } finally {
        if (tripRequestIdRef.current === requestId) {
          setIsTripsPending(false);
        }
      }
    },
    [],
  );

  function toggleTrip(trip: DataScienceTripOption) {
    setSelectedTripOptions((current) => mergeTripOptions(current, [trip]));
    setSelectedTripIds((current) =>
      current.includes(trip.id)
        ? current.filter((id) => id !== trip.id)
        : [...current, trip.id],
    );
  }

  function clearTrips() {
    setSelectedTripIds([]);
    setSelectedTripOptions([]);
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

  useEffect(() => {
    if (!tripPickerOpen && !tripMobilePickerOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadTripOptions({
        mode: "replace",
        query: tripSearch,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadTripOptions, tripMobilePickerOpen, tripPickerOpen, tripSearch]);

  function handleTripListScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distanceToBottom > 96 || isTripsPending || !tripHasMore) {
      return;
    }

    void loadTripOptions({
      cursor: tripCursor,
      mode: "append",
      query: tripSearch,
    });
  }

  async function submitChat() {
    const question = message.trim();
    if (!question) {
      return;
    }

    setPending(true);
    setMessage("");

    const tempId = createClientId();

    // Add optimistic user message immediately
    setMessages((current) => [
      ...current,
      {
        answer: "",
        artifacts: [],
        id: tempId,
        intent: "agent",
        question,
        sources: [],
      },
    ]);

    try {
      const response = await fetch("/api/data-science/chat/stream", {
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

      if (!response.ok || !response.body) {
        // Fallback to non-streaming
        const data = await response.json();
        throw new Error(data?.detail ?? "Consulta fallida.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let streamArtifacts: ChatResponse["artifacts"] = [];
      let streamSources: ChatResponse["sources"] = [];
      let streamConversationId = conversationId;
      let assistantMessageIndex: number | undefined;
      let streamIntent = "agent";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr) as {
              type: string;
              data: unknown;
            };

            if (event.type === "token") {
              fullAnswer += event.data as string;
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === tempId ? { ...msg, answer: fullAnswer } : msg,
                ),
              );
            } else if (event.type === "status") {
              const status = event.data as string;
              if (!fullAnswer) {
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === tempId ? { ...msg, answer: status } : msg,
                  ),
                );
              }
            } else if (event.type === "artifacts") {
              streamArtifacts = event.data as ChatResponse["artifacts"];
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === tempId
                    ? { ...msg, artifacts: streamArtifacts }
                    : msg,
                ),
              );
            } else if (event.type === "sources") {
              streamSources = event.data as ChatResponse["sources"];
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === tempId
                    ? { ...msg, sources: streamSources }
                    : msg,
                ),
              );
            } else if (event.type === "done") {
              const meta = event.data as {
                conversation_id?: string;
                assistant_message_index?: number;
                intent?: string;
              };
              streamConversationId = meta.conversation_id ?? streamConversationId;
              assistantMessageIndex = meta.assistant_message_index;
              streamIntent = meta.intent ?? "agent";
            } else if (event.type === "error") {
              throw new Error(event.data as string);
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue;
            throw parseError;
          }
        }
      }

      // Finalize message
      setMessages((current) =>
        current.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                answer: fullAnswer || "No encontre informacion suficiente.",
                artifacts: streamArtifacts,
                assistantMessageIndex,
                intent: streamIntent,
                sources: streamSources,
              }
            : msg,
        ),
      );
      if (streamConversationId) {
        setConversationId(streamConversationId);
      }
      void loadChats();
    } catch (error) {
      // Remove the optimistic message on error
      setMessages((current) => current.filter((msg) => msg.id !== tempId));
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

  async function generateReport(reportType: ReportType) {
    setReportPending(reportType);

    try {
      const response = await fetch("/api/data-science/reports", {
        body: JSON.stringify({
          conversationId,
          reportType,
          saveToConversation: false,
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
      const reportMessage: Message = {
        answer: result.answer,
        assistantMessageIndex: result.assistant_message_index ?? undefined,
        artifacts: result.artifacts,
        id: createClientId(),
        intent: result.intent,
        question: "",
        sources: result.sources,
      };
      await downloadReport(reportMessage, `reporte-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Reporte descargado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el reporte.",
      );
    } finally {
      setReportPending(null);
    }
  }

  async function downloadTripReport() {
    const trip = selectedTrips[0];
    if (selectedTrips.length !== 1 || !trip) {
      toast.error("Selecciona exactamente un viaje para este reporte.");
      return;
    }

    setReportPending("resumen_viaje");
    try {
      const response = await fetch(
        `/api/investigacion/reportes/viaje/${encodeURIComponent(trip.id)}`,
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "No se pudo generar el reporte del viaje.");
      }
      await downloadResponse(response, `reporte-viaje-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Reporte del viaje descargado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el reporte.");
    } finally {
      setReportPending(null);
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-sm font-semibold sm:text-base">
              Asistente de investigacion
            </h2>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {tripScopeLabel} · {selectedStation?.label ?? "Todas las estaciones"}
            </p>
          </div>
          <TooltipProvider>
            <div className="flex shrink-0 items-center gap-1">
              <Sheet>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button aria-label="Ajustar alcance y formato" size="icon-sm" variant="ghost">
                        <SlidersHorizontalIcon aria-hidden="true" />
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Ajustar alcance y formato</TooltipContent>
                </Tooltip>
              <SheetContent
                className="mx-auto max-h-[88svh] w-full max-w-[760px] rounded-t-3xl"
                side="bottom"
              >
                <SheetHeader className="border-b p-4">
                  <SheetTitle>Alcance del analisis</SheetTitle>
                  <SheetDescription>
                    Ajusta viajes, estacion y formato de respuesta.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid min-h-0 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">{renderTripPicker()}</div>
                  {renderStationPicker()}
                  {renderResultPicker()}
                </div>
              </SheetContent>
              </Sheet>
              <Sheet>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button aria-label="Conversaciones" size="icon-sm" variant="ghost">
                        <HistoryIcon aria-hidden="true" />
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Conversaciones</TooltipContent>
                </Tooltip>
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
              <Sheet>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button aria-label="Reportes" size="icon-sm" variant="ghost">
                        <FileChartColumnIcon aria-hidden="true" />
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Reportes</TooltipContent>
                </Tooltip>
                <SheetContent className="w-full gap-0 p-0 sm:max-w-lg" side="right">
                  <SheetHeader className="border-b px-5 py-4 text-left">
                    <SheetTitle>Reportes</SheetTitle>
                    <SheetDescription>
                      Configura el alcance y descarga el PDF sin agregarlo al chat.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <section className="border-b px-5 py-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">Alcance</h3>
                          <p className="text-xs text-muted-foreground">Los filtros se aplican al reporte elegido.</p>
                        </div>
                        {(selectedTripIds.length > 0 || stationKey !== "all") ? (
                          <Button
                            onClick={() => { setSelectedTripIds([]); setSelectedTripOptions([]); setStationKey("all"); }}
                            size="sm"
                            variant="ghost"
                          >
                            Limpiar
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-3">
                        {renderTripPicker()}
                        {renderStationPicker()}
                      </div>
                    </section>

                    <div className="flex flex-col divide-y">
                      <ReportDownloadItem
                        description="Servicio, fechas, establecimiento y asignacion de docentes y estudiantes por estacion."
                        disabled={selectedTrips.length !== 1 || Boolean(reportPending)}
                        filterLabel="Requiere exactamente un viaje"
                        loading={reportPending === "resumen_viaje"}
                        onDownload={() => void downloadTripReport()}
                        title="Resumen operativo del viaje"
                      />
                      {reportTypeOptions.map((report) => (
                        <ReportDownloadItem
                          description={report.description}
                          disabled={Boolean(reportPending)}
                          filterLabel={report.scope}
                          key={report.value}
                          loading={reportPending === report.value}
                          onDownload={() => void generateReport(report.value)}
                          title={report.label}
                        />
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </TooltipProvider>
        </div>
      </header>

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:gap-5 sm:px-5"
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

      <footer className="shrink-0 border-t px-3 py-2 sm:px-5 sm:py-3">
        <InputGroup className="border-border bg-muted/40">
          <InputGroupTextarea
            aria-label="Pregunta para investigacion"
            className="min-h-11 max-h-32 py-2 sm:min-h-12"
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
          <InputGroupAddon align="block-end" className="justify-end gap-3 py-1.5">
            {pending ? <span className="text-xs text-muted-foreground">Procesando</span> : null}
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

function mergeTripOptions(
  current: DataScienceTripOption[],
  incoming: DataScienceTripOption[],
) {
  const byId = new Map(current.map((trip) => [trip.id, trip]));
  for (const trip of incoming) {
    byId.set(trip.id, trip);
  }

  return Array.from(byId.values());
}

function createClientId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `client:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function EmptyConversation({
  onPickPrompt,
}: {
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 py-6">
      <h3 className="text-base font-semibold">Nueva consulta</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {promptSuggestions.map((prompt) => (
          <Button
            className="h-auto min-h-10 justify-start whitespace-normal rounded-md px-3 py-2 text-left"
            key={prompt}
            onClick={() => onPickPrompt(prompt)}
            size="sm"
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
  const primaryArtifactIndex = message.artifacts.findIndex(
    (artifact) => artifact.spec?.role === "primary",
  );
  const highlightedArtifactIndex =
    primaryArtifactIndex >= 0 ? primaryArtifactIndex : message.artifacts.length > 0 ? 0 : -1;
  const highlightedArtifact =
    highlightedArtifactIndex >= 0 ? message.artifacts[highlightedArtifactIndex] : null;
  const secondaryArtifacts = message.artifacts
    .map((artifact, index) => ({ artifact, index }))
    .filter((item) => item.index !== highlightedArtifactIndex);
  const artifactContent = message.artifacts.length > 0 ? (
    <div className="flex min-w-0 flex-col gap-3">
      {highlightedArtifact ? (
        <ArtifactView
          artifact={highlightedArtifact}
          emphasis="primary"
          onChange={(chartType) => onChangeArtifact(highlightedArtifactIndex, chartType)}
        />
      ) : null}
      {secondaryArtifacts.length > 0 ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          {secondaryArtifacts.map(({ artifact, index }) => (
            <ArtifactView
              artifact={artifact}
              key={`${artifact.title}-${index}`}
              onChange={(chartType) => onChangeArtifact(index, chartType)}
            />
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <div className="ml-auto max-w-[90%] rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground sm:max-w-[75%]">
        {message.question}
      </div>
      <div className="flex min-w-0 max-w-full flex-col gap-3 border-l-2 border-primary/50 pl-3 sm:pl-4">
          <p className="max-w-prose whitespace-pre-wrap wrap-break-word text-sm leading-6">{message.answer}</p>
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
          {message.sources.length > 0 ? (
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
                <TabsContent value="artifacts">
                  {artifactContent}
                </TabsContent>
              ) : null}
              {message.sources.length > 0 ? (
                <TabsContent value="sources">
                  <SourcesTable sources={message.sources} />
                </TabsContent>
              ) : null}
            </Tabs>
          ) : artifactContent}
      </div>
    </article>
  );
}

function ArtifactView({
  artifact,
  emphasis = "secondary",
  onChange,
}: {
  artifact: Artifact;
  emphasis?: "primary" | "secondary";
  onChange: (chartType: Exclude<ChartType, "auto">) => void;
}) {
  const canChangeVisualization = Boolean(artifact.spec?.x && artifact.spec?.y);
  const selectedType =
    artifact.type === "table" ? "table" : artifact.spec?.kind ?? "bar";
  const roleLabel = artifactRoleLabel(artifact.spec?.role, emphasis);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-md border bg-background p-3",
        emphasis === "primary" ? "border-border" : "border-border/60",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] font-semibold uppercase text-primary">
              {roleLabel}
            </span>
            <h4 className="min-w-0 wrap-break-word text-sm font-medium">{artifact.title}</h4>
          </div>
          {artifact.spec?.description ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {artifact.spec.description}
            </p>
          ) : null}
        </div>
        {canChangeVisualization ? (
          <Select
            onValueChange={(value) =>
              onChange(value as Exclude<ChartType, "auto">)
            }
            value={selectedType}
          >
          <SelectTrigger className="h-8 w-full sm:w-36">
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

function artifactRoleLabel(role: string | undefined, emphasis: "primary" | "secondary") {
  if (role === "summary") {
    return "Resumen";
  }
  if (role === "breakdown") {
    return "Cruce";
  }
  if (role === "evidence") {
    return "Evidencia";
  }
  return emphasis === "primary" ? "Principal" : "Resultado";
}

function ArtifactChart({ artifact }: { artifact: Artifact }) {
  const [showFullTable, setShowFullTable] = useState(false);
  const rows = artifact.data as Record<string, unknown>[];
  const xKey = artifact.spec?.x ?? Object.keys(rows[0] ?? {})[0] ?? "label";
  const yKey = artifact.spec?.y ?? Object.keys(rows[0] ?? {})[1] ?? "value";
  const chartKind = artifact.spec?.kind ?? "bar";
  const limit = chartKind === "line" ? 24 : 12;
  const canLimit = chartKind !== "scatter" && rows.length > limit;
  const visibleRows = canLimit ? rows.slice(0, chartKind === "pie" ? 11 : limit) : rows;
  const data = visibleRows.map((row) => ({
    label: String(row[xKey] ?? "Sin dato"),
    value: Number(row[yKey] ?? 0),
  }));
  if (canLimit && chartKind === "pie") {
    data.push({
      label: "Otros",
      value: rows.slice(11).reduce((total, row) => total + Number(row[yKey] ?? 0), 0),
    });
  }
  const height = chartKind === "bar" ? Math.max(220, data.length * 30) : 270;

  if (showFullTable) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <ArtifactTable rows={rows} />
        <Button className="w-fit" onClick={() => setShowFullTable(false)} size="xs" variant="ghost">
          Volver al gráfico
        </Button>
      </div>
    );
  }

  if (chartKind === "heatmap") {
    return <ArtifactHeatmap artifact={artifact} />;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay datos para visualizar.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="min-w-0">
        <ChartContainer
        className="aspect-auto w-full min-w-0"
        config={chartConfig}
        initialDimension={{ height, width: 320 }}
        style={{ height }}
      >
        {chartKind === "pie" ? (
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
        ) : chartKind === "line" ? (
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
        ) : chartKind === "scatter" ? (
          <ScatterChart
            accessibilityLayer
            data={toScatterData(visibleRows, xKey, yKey)}
            margin={{ bottom: 4, left: 4, right: 28, top: 4 }}
          >
            <RechartsCartesianGrid />
            <RechartsXAxis
              dataKey="x"
              tickFormatter={(value) =>
                toScatterData(visibleRows, xKey, yKey).find((row) => row.x === value)?.label ??
                String(value)
              }
              tickLine={false}
              type="number"
            />
            <RechartsYAxis dataKey="y" tickLine={false} width={44} />
            <ZAxis range={[64, 64]} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Scatter dataKey="y" fill="var(--color-value)" />
          </ScatterChart>
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
              width={112}
              tickFormatter={(value: string) =>
                value.length > 20 ? `${value.slice(0, 19)}…` : value
              }
            />
            <RechartsXAxis dataKey="value" hide type="number" />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <RechartsBar dataKey="value" fill="var(--color-value)" radius={6} />
          </RechartsBarChart>
        )}
        </ChartContainer>
      </div>
      {canLimit ? (
        <Button
          className="w-fit"
          onClick={() => setShowFullTable(true)}
          size="xs"
          variant="ghost"
        >
          Ver todos los datos ({rows.length})
        </Button>
      ) : null}
    </div>
  );
}

function toScatterData(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
) {
  return rows.map((row, index) => {
    const rawX = Number(row[xKey]);
    return {
      label: String(row[xKey] ?? index + 1),
      x: Number.isFinite(rawX) ? rawX : index + 1,
      y: Number(row[yKey] ?? 0),
    };
  });
}

function ArtifactHeatmap({ artifact }: { artifact: Artifact }) {
  const rows = artifact.data as Record<string, unknown>[];
  const xKey = artifact.spec?.x ?? Object.keys(rows[0] ?? {})[0] ?? "x";
  const yKey = artifact.spec?.group ?? artifact.spec?.series ?? Object.keys(rows[0] ?? {})[1] ?? "group";
  const valueKey = artifact.spec?.y ?? "historias";
  const xLabels = Array.from(new Set(rows.map((row) => String(row[xKey] ?? "Sin dato"))));
  const yLabels = Array.from(new Set(rows.map((row) => String(row[yKey] ?? "Sin dato"))));
  const values = new Map(
    rows.map((row) => [
      `${String(row[xKey] ?? "Sin dato")}::${String(row[yKey] ?? "Sin dato")}`,
      Number(row[valueKey] ?? 0),
    ]),
  );
  const max = Math.max(...Array.from(values.values()), 1);

  return (
    <div className="max-h-[420px] min-w-0 overflow-auto rounded-md border">
      <div
        className="grid w-max min-w-full text-xs"
        style={{ gridTemplateColumns: `minmax(110px, 1fr) repeat(${xLabels.length}, minmax(72px, 1fr))` }}
      >
        <div className="bg-muted px-3 py-2 font-medium">{yKey}</div>
        {xLabels.map((label) => (
          <div className="bg-muted px-3 py-2 text-center font-medium" key={label}>
            {label}
          </div>
        ))}
        {yLabels.map((rowLabel) => (
          <HeatmapRow
            key={rowLabel}
            max={max}
            rowLabel={rowLabel}
            values={values}
            xLabels={xLabels}
          />
        ))}
      </div>
    </div>
  );
}

function HeatmapRow({
  max,
  rowLabel,
  values,
  xLabels,
}: {
  max: number;
  rowLabel: string;
  values: Map<string, number>;
  xLabels: string[];
}) {
  return (
    <>
      <div className="border-t px-3 py-2 font-medium">{rowLabel}</div>
      {xLabels.map((columnLabel) => {
        const value = values.get(`${columnLabel}::${rowLabel}`) ?? 0;
        return (
          <div
            className="border-t px-3 py-2 text-center tabular-nums"
            key={columnLabel}
            style={{ backgroundColor: `color-mix(in oklch, var(--primary) ${Math.max(8, (value / max) * 58)}%, transparent)` }}
          >
            {value}
          </div>
        );
      })}
    </>
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
    <div className="min-w-0 overflow-hidden rounded-md border">
      <div className="max-h-[420px] overflow-auto">
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

function ReportDownloadItem({
  description,
  disabled,
  filterLabel,
  loading,
  onDownload,
  title,
}: {
  description: string;
  disabled: boolean;
  filterLabel: string;
  loading: boolean;
  onDownload: () => void;
  title: string;
}) {
  return (
    <article className="flex flex-col gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
          <FileChartColumnIcon aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-5">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-muted-foreground">{filterLabel}</span>
        <Button disabled={disabled} onClick={onDownload} size="sm">
          {loading ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileDownIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {loading ? "Generando" : "Descargar"}
        </Button>
      </div>
    </article>
  );
}

async function downloadReport(message: Message, fileName?: string) {
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

  await downloadResponse(
    response,
    fileName ?? `reporte-investigacion-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

async function downloadResponse(response: Response, fallbackFileName: string) {
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");

  link.href = url;
  link.download = getDownloadFileName(response.headers.get("Content-Disposition")) ?? fallbackFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function getDownloadFileName(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
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
