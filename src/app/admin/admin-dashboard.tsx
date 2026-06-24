"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { PointerEvent, WheelEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  Maximize2Icon,
  MapPinIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import type {
  AdminActivityActorOption,
  AdminActivityLogPage,
  AdminActivityLogRow,
  AdminChangeStats,
  AdminDashboardSummary,
  DiagnosisSummaryRow,
} from "@/lib/admin-dashboard";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { SimpleCombobox } from "@/components/ui/simple-combobox";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: {
    color: "var(--primary)",
    label: "Diagnosticos",
  },
} satisfies ChartConfig;

const genderChartConfig = {
  value: {
    color: "var(--primary)",
    label: "Historias",
  },
} satisfies ChartConfig;

const ADMIN_SELECTED_TRIP_STORAGE_KEY = "admin-dashboard-selected-trip";

export function AdminDashboard({ summary }: { summary: AdminDashboardSummary }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [tripSearch, setTripSearch] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] =
    useState<DiagnosisSummaryRow | null>(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const [isTripPending, startTripTransition] = useTransition();
  const selectedTrip = summary.selectedTrip;
  const loadingTrip = isTripPending && pendingTripId !== summary.selectedTripId;
  const filteredTrips = useMemo(() => {
    const query = normalizeSearch(tripSearch);

    if (!query) {
      return summary.trips;
    }

    return summary.trips.filter((trip) =>
      normalizeSearch(
        `${trip.label} ${trip.secondaryLabel} ${trip.dateLabel}`,
      ).includes(query),
    );
  }, [summary.trips, tripSearch]);
  const chartRows = summary.diagnosisRows.map((row) => ({
    ...row,
    value: row.historias,
  }));
  const chartWidth = Math.max(760, chartRows.length * 82);
  const currentTripParam = searchParams.get("viajeId");

  const navigateTrip = useCallback(
    (tripId: string, mode: "push" | "replace") => {
      const params = new URLSearchParams();
      params.set("viajeId", tripId);
      setTripPickerOpen(false);
      setPendingTripId(tripId);
      startTripTransition(() => {
        const href = `${pathname}?${params.toString()}`;
        if (mode === "replace") {
          router.replace(href);
          return;
        }

        router.push(href);
      });
    },
    [pathname, router],
  );

  useEffect(() => {
    if (currentTripParam || summary.trips.length === 0) {
      return;
    }

    const storedTripId = sessionStorage.getItem(ADMIN_SELECTED_TRIP_STORAGE_KEY);
    const storedTripExists = summary.trips.some((trip) => trip.id === storedTripId);

    if (storedTripId && storedTripExists && storedTripId !== summary.selectedTripId) {
      const params = new URLSearchParams();
      params.set("viajeId", storedTripId);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [currentTripParam, pathname, router, summary.selectedTripId, summary.trips]);

  useEffect(() => {
    if (currentTripParam && summary.selectedTripId) {
      sessionStorage.setItem(
        ADMIN_SELECTED_TRIP_STORAGE_KEY,
        summary.selectedTripId,
      );
    }
  }, [currentTripParam, summary.selectedTripId]);

  function selectTrip(tripId: string) {
    sessionStorage.setItem(ADMIN_SELECTED_TRIP_STORAGE_KEY, tripId);
    navigateTrip(tripId, "push");
  }

  function openDiagnosis(row: DiagnosisSummaryRow) {
    setSelectedDiagnosis(row);
  }

  return (
    <main className="flex flex-col gap-7 text-base">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          Resumen rapido del viaje
        </h1>
      </header>

      <section className="flex flex-col gap-2.5">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Viaje seleccionado
        </p>
        <Popover onOpenChange={setTripPickerOpen} open={tripPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-expanded={tripPickerOpen}
              className="h-auto min-h-12 w-full max-w-4xl justify-between bg-muted/20 px-4 py-2.5 text-left font-normal shadow-none hover:bg-muted/35"
              role="combobox"
              variant="ghost"
            >
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate text-base font-semibold">
                  {selectedTrip?.label ?? "Selecciona un viaje"}
                </span>
                {loadingTrip ? (
                  <span className="truncate text-sm text-muted-foreground">
                    Cargando resumen del viaje...
                  </span>
                ) : selectedTrip ? (
                  <span className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPinIcon aria-hidden="true" />
                      <span className="truncate">
                        {selectedTrip.secondaryLabel}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDaysIcon aria-hidden="true" />
                      {selectedTrip.dateLabel}
                    </span>
                  </span>
                ) : (
                  <span className="truncate text-sm text-muted-foreground">
                    No hay viajes registrados
                  </span>
                )}
              </span>
              <ChevronsUpDownIcon aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(760px,calc(100vw-2rem))] overflow-hidden p-0"
          >
            <PopoverHeader className="p-4 pb-2">
              <PopoverTitle>Viajes</PopoverTitle>
              <PopoverDescription>
                Busca por servicio, establecimiento, direccion o fecha.
              </PopoverDescription>
            </PopoverHeader>
            <div className="px-4 pb-3">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <SearchIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Buscar viaje"
                  onChange={(event) => setTripSearch(event.target.value)}
                  placeholder="Buscar viaje"
                  value={tripSearch}
                />
              </InputGroup>
            </div>
            <div className="max-h-96 overflow-y-auto p-3 pt-1">
              {filteredTrips.length > 0 ? (
                filteredTrips.map((trip) => {
                  const selected = trip.id === summary.selectedTripId;

                  return (
                    <button
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-accent",
                        selected && "bg-primary/10 text-primary",
                      )}
                      disabled={loadingTrip}
                      key={trip.id}
                      onClick={() => selectTrip(trip.id)}
                      type="button"
                    >
                      <span className="mt-1 h-9 w-1 shrink-0 rounded-full bg-border">
                        <span
                          className={cn(
                            "block h-full w-full rounded-full opacity-0",
                            selected && "bg-primary opacity-100",
                          )}
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex min-w-0 items-center justify-between gap-3">
                          <span className="truncate text-base font-medium">
                            {trip.label}
                          </span>
                          {selected ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                              <CheckIcon aria-hidden="true" />
                              Activo
                            </span>
                          ) : null}
                        </span>
                        <span className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPinIcon aria-hidden="true" />
                            <span className="truncate">
                              {trip.secondaryLabel}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDaysIcon aria-hidden="true" />
                            {trip.dateLabel}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No hay viajes que coincidan.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </section>

      <div className="grid gap-6 xl:h-[calc(100dvh-16rem)] xl:min-h-[480px] xl:max-h-[680px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {loadingTrip ? (
          <>
            <DiagnosisChartSkeleton />
            <section className="flex min-h-0 min-w-0 flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ChangeStatsSkeleton />
                <ChangeStatsSkeleton />
              </div>
              <ActivityLogSkeleton />
            </section>
          </>
        ) : (
          <>
            <section className="flex min-h-0 min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Resultados por diagnostico
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Desplaza horizontalmente para ver todos los diagnosticos.
                    Haz click en una barra para ver la distribucion por genero.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {chartRows.length > 0 ? (
                    <Button
                      onClick={() => setChartExpanded(true)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Maximize2Icon aria-hidden="true" />
                      Ampliar
                    </Button>
                  ) : null}
                </div>
              </div>

              {chartRows.length > 0 ? (
                <DiagnosisBarChart
                  chartRows={chartRows}
                  chartWidth={chartWidth}
                  onSelectDiagnosis={openDiagnosis}
                  popoverEnabled={!chartExpanded}
                  selectedDiagnosis={selectedDiagnosis}
                  setSelectedDiagnosis={setSelectedDiagnosis}
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-sm bg-muted/30 text-base text-muted-foreground">
                  Este viaje todavia no tiene diagnosticos registrados.
                </div>
              )}
              {chartRows.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  * Los diagnosticos con muy pocos casos se juntan en Otros para
                  que el grafico sea mas facil de leer.
                </p>
              ) : null}
            </section>

            <section className="flex min-h-0 min-w-0 flex-col gap-4">
              <ChangeStatsCards viajeId={summary.selectedTripId} />
              <ActivityLog
                actorOptions={summary.activityActors}
                initialPage={summary.activityPage}
                key={summary.selectedTripId ?? "sin-viaje"}
                viajeId={summary.selectedTripId}
              />
            </section>
          </>
        )}
      </div>
      <Dialog
        onOpenChange={(open) => {
          setChartExpanded(open);

          if (!open) {
            setSelectedDiagnosis(null);
          }
        }}
        open={chartExpanded}
      >
        <DialogContent className="grid h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden sm:max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Resultados por diagnostico</DialogTitle>
            <DialogDescription>
              Vista ampliada del viaje seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            Desplaza horizontalmente para revisar todos los diagnosticos. Haz
            click en una barra para ver la distribucion por genero.
          </div>
          <div className="min-h-0 min-w-0 overflow-hidden">
            <DiagnosisBarChart
              chartRows={chartRows}
              chartWidth={Math.max(chartWidth, chartRows.length * 110)}
              expanded
              onSelectDiagnosis={openDiagnosis}
              selectedDiagnosis={selectedDiagnosis}
              setSelectedDiagnosis={setSelectedDiagnosis}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function DiagnosisBarChart({
  chartRows,
  chartWidth,
  expanded = false,
  onSelectDiagnosis,
  popoverEnabled = true,
  selectedDiagnosis,
  setSelectedDiagnosis,
}: {
  chartRows: Array<DiagnosisSummaryRow & { value: number }>;
  chartWidth: number;
  expanded?: boolean;
  onSelectDiagnosis: (diagnosis: DiagnosisSummaryRow) => void;
  popoverEnabled?: boolean;
  selectedDiagnosis: DiagnosisSummaryRow | null;
  setSelectedDiagnosis: (diagnosis: DiagnosisSummaryRow | null) => void;
}) {
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollThumbRef = useRef<HTMLDivElement | null>(null);
  const [anchorPosition, setAnchorPosition] = useState({ x: 32, y: 32 });
  const [expandedPanelSide, setExpandedPanelSide] = useState<"left" | "right">(
    "right",
  );
  const chartHeight = "100%";
  const chartInitialHeight = expanded ? 600 : 460;
  const chartScale = useMemo(() => getChartScale(chartRows), [chartRows]);
  const scrollContainerId = expanded
    ? "diagnosis-chart-scroll-expanded"
    : "diagnosis-chart-scroll";

  const syncScrollThumb = useCallback(() => {
    const scroller = scrollContainerRef.current;
    const thumb = scrollThumbRef.current;
    const track = scrollTrackRef.current;

    if (!scroller || !thumb || !track) {
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const trackWidth = track.clientWidth;
    const canScroll = maxScrollLeft > 1 && trackWidth > 0;
    const thumbWidth = canScroll
      ? Math.max(36, (scroller.clientWidth / scroller.scrollWidth) * trackWidth)
      : trackWidth;
    const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft = canScroll
      ? (scroller.scrollLeft / maxScrollLeft) * maxThumbLeft
      : 0;
    const scrollPercent = canScroll
      ? Math.round((scroller.scrollLeft / maxScrollLeft) * 100)
      : 0;

    thumb.style.width = `${thumbWidth}px`;
    thumb.style.transform = `translateX(${thumbLeft}px)`;
    track.setAttribute("data-scrollable", String(canScroll));
    track.setAttribute("aria-valuenow", String(scrollPercent));
    track.setAttribute("aria-valuetext", `${scrollPercent}% desplazado`);
  }, []);

  useEffect(() => {
    const scroller = scrollContainerRef.current;

    if (!scroller) {
      return;
    }

    const frame = window.requestAnimationFrame(syncScrollThumb);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncScrollThumb)
        : null;

    scroller.addEventListener("scroll", syncScrollThumb, { passive: true });
    resizeObserver?.observe(scroller);
    window.addEventListener("resize", syncScrollThumb);

    return () => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", syncScrollThumb);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncScrollThumb);
    };
  }, [chartRows.length, chartWidth, expanded, syncScrollThumb]);

  function scrollFromTrack(clientX: number) {
    const scroller = scrollContainerRef.current;
    const track = scrollTrackRef.current;
    const thumb = scrollThumbRef.current;

    if (!scroller || !track || !thumb) {
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const thumbWidth = thumb.offsetWidth;
    const maxThumbLeft = Math.max(1, trackRect.width - thumbWidth);
    const nextThumbLeft = clamp(
      clientX - trackRect.left - thumbWidth / 2,
      0,
      maxThumbLeft,
    );
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;

    scroller.scrollLeft = (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
    syncScrollThumb();
  }

  function startScrollDrag(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrollFromTrack(event.clientX);
  }

  function handleChartWheel(event: WheelEvent<HTMLDivElement>) {
    if (!expanded || !event.shiftKey) {
      return;
    }

    const scroller = scrollContainerRef.current;

    if (!scroller) {
      return;
    }

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

    if (delta === 0) {
      return;
    }

    event.preventDefault();
    scroller.scrollLeft += delta;
    syncScrollThumb();
  }

  function selectDiagnosisFromBar(
    diagnosis: DiagnosisSummaryRow,
    event?: unknown,
  ) {
    if (isClientPointerEvent(event) && chartFrameRef.current) {
      const rect = chartFrameRef.current.getBoundingClientRect();
      const nextX = clamp(event.clientX - rect.left, 16, rect.width - 16);
      const nextY = clamp(event.clientY - rect.top, 16, rect.height - 16);

      setAnchorPosition({ x: nextX, y: nextY });
      setExpandedPanelSide(nextX > rect.width / 2 ? "left" : "right");
    }

    onSelectDiagnosis(diagnosis);
  }

  return (
    <div
      className={cn(
        "relative min-h-0 min-w-0",
        expanded ? "h-full" : "flex flex-1 flex-col",
      )}
      onPointerDownCapture={(event) => {
        if (!expanded || !selectedDiagnosis) {
          return;
        }

        const target = event.target;

        if (
          target instanceof Element &&
          target.closest("[data-diagnosis-panel]")
        ) {
          return;
        }

        setSelectedDiagnosis(null);
      }}
      ref={chartFrameRef}
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-muted/10">
        <div className="relative min-h-0 flex-1">
          <div
            className="h-full overflow-x-auto overflow-y-hidden px-2 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            id={scrollContainerId}
            onWheel={handleChartWheel}
            ref={scrollContainerRef}
          >
            <div className="flex h-full min-w-max items-stretch">
              <div className="sticky left-0 z-10 w-14 shrink-0 pr-1 before:absolute before:-inset-y-4 before:-left-2 before:right-0 before:bg-background before:content-['']">
                <ChartContainer
                  className="relative w-full"
                  config={chartConfig}
                  initialDimension={{
                    height: chartInitialHeight,
                    width: 56,
                  }}
                  style={{
                    height: chartHeight,
                    minHeight: expanded ? 420 : 320,
                    width: 56,
                  }}
                >
                  <BarChart
                    accessibilityLayer
                    data={chartRows}
                    margin={{
                      bottom: expanded ? 96 : 72,
                      left: 0,
                      right: 0,
                      top: 16,
                    }}
                  >
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      domain={[0, chartScale.max]}
                      tickLine={false}
                      ticks={chartScale.ticks}
                      width={50}
                    />
                    <Bar dataKey="value" fill="transparent" />
                  </BarChart>
                </ChartContainer>
              </div>
              <ChartContainer
                className="w-full"
                config={chartConfig}
                initialDimension={{
                  height: chartInitialHeight,
                  width: chartWidth,
                }}
                style={{
                  height: chartHeight,
                  minHeight: expanded ? 420 : 320,
                  minWidth: chartWidth,
                }}
              >
                <BarChart
                  accessibilityLayer
                  data={chartRows}
                  margin={{
                    bottom: expanded ? 96 : 72,
                    left: expanded ? 24 : 18,
                    right: expanded ? 32 : 24,
                    top: 16,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    angle={-35}
                    axisLine={false}
                    dataKey="label"
                    height={expanded ? 104 : 78}
                    interval={0}
                    padding={{ left: expanded ? 26 : 20, right: 16 }}
                    tickFormatter={(value) =>
                      truncateAxisLabel(String(value), expanded ? 26 : 18)
                    }
                    tickLine={false}
                    tickMargin={12}
                    textAnchor="end"
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, chartScale.max]}
                    hide
                    ticks={chartScale.ticks}
                    width={0}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent hideLabel />}
                    cursor={false}
                  />
                  <Bar
                    barSize={expanded ? 34 : 28}
                    dataKey="value"
                    fill="var(--color-value)"
                    onClick={(row, _index, event) =>
                      selectDiagnosisFromBar(row.payload, event)
                    }
                    radius={3}
                  >
                    <LabelList
                      className="fill-foreground"
                      dataKey="value"
                      fontSize={12}
                      position="top"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-3 pl-16">
          <div
            aria-label="Desplazar diagnosticos"
            aria-controls={scrollContainerId}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={0}
            className="h-3 cursor-pointer rounded-full bg-muted data-[scrollable=false]:opacity-40"
            data-scrollable="false"
            onPointerDown={startScrollDrag}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                scrollFromTrack(event.clientX);
              }
            }}
            ref={scrollTrackRef}
            role="scrollbar"
            tabIndex={0}
          >
            <div
              className="h-full rounded-full bg-primary/75 transition-colors hover:bg-primary"
              ref={scrollThumbRef}
            />
          </div>
        </div>
      </div>
      {popoverEnabled && !expanded ? (
        <Popover
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDiagnosis(null);
            }
          }}
          open={Boolean(selectedDiagnosis)}
        >
          <PopoverAnchor asChild>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-1"
              style={{
                left: anchorPosition.x,
                top: anchorPosition.y,
              }}
            />
          </PopoverAnchor>
          <DiagnosisPopover
            contentClassName="max-h-[min(520px,calc(100dvh-3rem))] overflow-x-hidden overflow-y-auto p-0"
            diagnosis={selectedDiagnosis}
            onSelectDiagnosis={setSelectedDiagnosis}
          />
        </Popover>
      ) : null}
      {expanded && selectedDiagnosis ? (
        <div
          className={cn(
            "absolute top-1/2 z-20 w-[min(390px,calc(100vw-4rem))] -translate-y-1/2",
            expandedPanelSide === "left" ? "left-6" : "right-6",
          )}
        >
          <DiagnosisPanel
            className="max-h-[min(680px,calc(100dvh-6rem))] overflow-x-hidden overflow-y-auto p-3"
            diagnosis={selectedDiagnosis}
            onSelectDiagnosis={setSelectedDiagnosis}
          />
        </div>
      ) : null}
    </div>
  );
}

function DiagnosisPopover({
  contentClassName,
  diagnosis,
  onSelectDiagnosis,
}: {
  contentClassName?: string;
  diagnosis: DiagnosisSummaryRow | null;
  onSelectDiagnosis: (diagnosis: DiagnosisSummaryRow | null) => void;
}) {
  return (
    <PopoverContent
      align="center"
      className={cn("w-[min(420px,calc(100vw-2rem))]", contentClassName)}
    >
      <DiagnosisPanel
        diagnosis={diagnosis}
        onSelectDiagnosis={onSelectDiagnosis}
      />
    </PopoverContent>
  );
}

function isClientPointerEvent(
  event: unknown,
): event is { clientX: number; clientY: number } {
  return (
    typeof event === "object" &&
    event !== null &&
    "clientX" in event &&
    "clientY" in event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number"
  );
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getChartScale(rows: Array<DiagnosisSummaryRow & { value: number }>) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const stepBase = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / stepBase;
  const niceStep =
    normalized <= 2
      ? stepBase / 2
      : normalized <= 5
        ? stepBase
        : stepBase * 2;
  const step = Math.max(1, Math.ceil(niceStep));
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) =>
    index * step,
  );

  return { max, ticks };
}

function truncateAxisLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function DiagnosisPanel({
  className,
  diagnosis,
  onSelectDiagnosis,
}: {
  className?: string;
  diagnosis: DiagnosisSummaryRow | null;
  onSelectDiagnosis: (diagnosis: DiagnosisSummaryRow | null) => void;
}) {
  const data =
    diagnosis?.genderRows.map((row) => ({
      label: row.genero,
      value: row.historias,
    })) ?? [];

  return (
    <div
      data-diagnosis-panel
      className={cn(
        "grid min-w-0 gap-3 rounded-md bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-border",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <PopoverHeader className="min-w-0">
          <PopoverTitle className="break-words">{diagnosis?.label}</PopoverTitle>
          <PopoverDescription>
            {diagnosis?.isOther
              ? "Diagnosticos agrupados bajo el umbral configurado."
              : "Distribucion por genero para este diagnostico."}
          </PopoverDescription>
        </PopoverHeader>
        <Button
          aria-label="Cerrar detalle"
          onClick={() => onSelectDiagnosis(null)}
          className="shrink-0"
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      {diagnosis?.isOther ? (
        <div className="grid max-h-80 gap-1 overflow-y-auto">
          {(diagnosis.members ?? []).map((row) => (
            <button
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              key={row.label}
              onClick={() => onSelectDiagnosis(row)}
              type="button"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {row.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.historias}
              </span>
            </button>
          ))}
        </div>
      ) : data.length > 0 ? (
        <>
          <ChartContainer
            className="w-full overflow-hidden"
            config={genderChartConfig}
            initialDimension={{ height: 220, width: 320 }}
            style={{ height: 220 }}
          >
            <PieChart accessibilityLayer data={data}>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={data}
                dataKey="value"
                innerRadius={48}
                nameKey="label"
                outerRadius={78}
              >
                {data.map((row, index) => (
                  <Cell
                    fill={`var(--chart-${(index % 5) + 1}, var(--primary))`}
                    key={row.label}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid gap-1">
            {diagnosis?.genderRows.map((row) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm bg-muted/20 px-2 py-1.5 text-sm"
                key={row.genero}
              >
                <span className="min-w-0 truncate">{row.genero}</span>
                <span className="font-medium tabular-nums">
                  {row.historias}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChangeStatsCards({ viajeId }: { viajeId?: string }) {
  const [result, setResult] = useState<{
    error?: string;
    stats?: AdminChangeStats;
    viajeId?: string;
  }>({});

  useEffect(() => {
    if (!viajeId) {
      return;
    }

    const controller = new AbortController();
    const currentViajeId = viajeId;

    async function loadStats() {
      try {
        const response = await fetch(
          `/api/admin/dashboard/change-stats?viajeId=${encodeURIComponent(currentViajeId)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as
          | AdminChangeStats
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in payload
              ? payload.message
              : "No se pudieron cargar las metricas.",
          );
        }

        setResult({
          stats: payload as AdminChangeStats,
          viajeId: currentViajeId,
        });
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setResult({
          error: "No se pudieron cargar las metricas de cambios.",
          viajeId: currentViajeId,
        });
      }
    }

    void loadStats();

    return () => controller.abort();
  }, [viajeId]);

  if (!viajeId) {
    return null;
  }

  const pending = result.viajeId !== viajeId;
  const stats = result.stats;
  const error = result.error;

  if (pending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <ChangeStatsSkeleton />
        <ChangeStatsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm bg-muted/20 p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChangeStatCard
        count={stats.changedHistories}
        label="Historias con un cambio"
        percent={stats.changedPercent}
        total={stats.totalHistories}
      />
      <ChangeStatCard
        count={stats.multipleChangedHistories}
        label="Historias con 2+ cambios"
        percent={stats.multipleChangedPercent}
        total={stats.totalHistories}
      />
    </div>
  );
}

function ChangeStatCard({
  count,
  label,
  percent,
  total,
}: {
  count: number;
  label: string;
  percent: number;
  total: number;
}) {
  return (
    <article className="min-h-32 rounded-md bg-background/60 p-4">
      <div className="flex h-full flex-col justify-between gap-4">
        <p className="text-base font-medium">{label}</p>
        <div className="grid gap-1">
          <p className="text-4xl font-semibold tracking-tight">{percent}%</p>
          <p className="text-sm font-medium text-muted-foreground">
            {count} de {total} historias
          </p>
        </div>
      </div>
    </article>
  );
}

function ChangeStatsSkeleton() {
  return (
    <div className="min-h-28 animate-pulse rounded-md bg-muted/20 p-4">
      <div className="mb-8 flex justify-end">
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

function DiagnosisChartSkeleton() {
  return (
    <section
      aria-busy="true"
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="grid gap-4 rounded-sm bg-muted/10 py-4">
        {[220, 280, 180, 250, 150, 205].map((width, index) => (
          <div className="grid gap-2" key={index}>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 max-w-full" style={{ width }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityLogSkeleton() {
  return (
    <section
      aria-busy="true"
      className="flex min-h-[280px] flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="size-5" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((item) => (
          <div className="grid gap-2.5 rounded-sm bg-muted/15 p-3" key={item}>
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityLog({
  actorOptions,
  initialPage,
  viajeId,
}: {
  actorOptions: AdminActivityActorOption[];
  initialPage: AdminActivityLogPage;
  viajeId?: string;
}) {
  const [rows, setRows] = useState<AdminActivityLogRow[]>(initialPage.rows);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage);
  const [selectedActorId, setSelectedActorId] = useState("");
  const [selectedActivity, setSelectedActivity] =
    useState<AdminActivityLogRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const comboboxOptions = useMemo(
    () => [
      { label: "Todos los usuarios", value: "" },
      ...actorOptions.map((actor) => ({
        description: actor.email,
        label: actor.name,
        value: actor.id,
      })),
    ],
    [actorOptions],
  );

  const fetchActivityPage = useCallback(
    async ({
      actorId,
      cursor,
      merge,
    }: {
      actorId: string;
      cursor?: string;
      merge: boolean;
    }) => {
      if (!viajeId) {
        return;
      }

      setPending(true);
      setError(null);
      try {
        const params = new URLSearchParams({ viajeId });
        if (actorId) {
          params.set("actorId", actorId);
        }
        if (cursor) {
          params.set("cursor", cursor);
        }
        const response = await fetch(`/api/admin/dashboard/activity?${params}`);
        const page = (await response.json()) as
          | AdminActivityLogPage
          | { message?: string };

        if (!response.ok) {
          throw new Error(
            "message" in page ? page.message : "No se pudo cargar actividad.",
          );
        }

        const nextPage = page as AdminActivityLogPage;
        setRows((current) =>
          merge ? mergeActivityRows(current, nextPage.rows) : nextPage.rows,
        );
        setNextCursor(nextPage.nextCursor);
        setHasNextPage(nextPage.hasNextPage);
      } catch {
        setError("No se pudo cargar la actividad.");
      } finally {
        setPending(false);
      }
    },
    [viajeId],
  );

  function changeActorFilter(actorId: string) {
    setSelectedActorId(actorId);

    if (!actorId) {
      setRows(initialPage.rows);
      setNextCursor(initialPage.nextCursor);
      setHasNextPage(initialPage.hasNextPage);
      setError(null);
      return;
    }

    void fetchActivityPage({ actorId, merge: false });
  }

  const loadMore = useCallback(async () => {
    if (!hasNextPage || pending) {
      return;
    }

    await fetchActivityPage({
      actorId: selectedActorId,
      cursor: nextCursor,
      merge: true,
    });
  }, [fetchActivityPage, hasNextPage, nextCursor, pending, selectedActorId]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        root: scrollRootRef.current,
        rootMargin: "120px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasNextPage, loadMore, rows.length]);

  return (
    <section className="flex min-h-[280px] flex-col gap-4 rounded-md bg-muted/25 p-4">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Historial de actividad del viaje
          </p>
          <p className="text-sm text-muted-foreground">
            Cambios recientes hechos por el equipo durante el viaje.
          </p>
        </div>
        <SimpleCombobox
          emptyLabel="No hay usuarios"
          onValueChange={changeActorFilter}
          options={comboboxOptions}
          placeholder="Filtrar usuario"
          searchPlaceholder="Buscar usuario"
          value={selectedActorId}
        />
      </div>

      {pending && rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((item) => (
            <div className="grid gap-2.5 rounded-sm bg-muted/15 p-3" key={item}>
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : rows.length > 0 ? (
        <div
          className="flex max-h-[330px] flex-col gap-3 overflow-y-auto pr-1"
          ref={scrollRootRef}
        >
          {rows.map((row) => (
            <button
              className="grid gap-1.5 rounded-sm bg-muted/15 p-3 text-left transition-colors hover:bg-muted/30"
              key={row.id}
              onClick={() => setSelectedActivity(row)}
              type="button"
            >
              <p className="line-clamp-1 text-sm font-medium">
                {activityActionLabel(row)}
              </p>
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {row.actorName}
              </p>
            </button>
          ))}
          {hasNextPage ? (
            <div
              aria-hidden="true"
              className="h-2"
              ref={loadMoreRef}
            />
          ) : null}
          {pending ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              Cargando actividad...
            </div>
          ) : null}
          {error ? (
            <div className="py-2 text-center text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-sm bg-muted/30 text-base text-muted-foreground">
          No hay actividad registrada para este viaje.
        </div>
      )}
      <ActivityDetailDialog
        activity={selectedActivity}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedActivity(null);
          }
        }}
      />
    </section>
  );
}

function ActivityDetailDialog({
  activity,
  onOpenChange,
}: {
  activity: AdminActivityLogRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(activity)}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle de actividad</DialogTitle>
          <DialogDescription>
            Cambios registrados para el documento seleccionado.
          </DialogDescription>
        </DialogHeader>

        {activity ? (
          <div className="grid min-h-0 gap-4 overflow-y-auto pr-2">
            <div className="grid gap-1.5 rounded-sm bg-muted/20 p-4 text-base">
              <p className="font-medium">
                {activityActionLabel(activity)} en {activity.stationLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {activity.actorName} · {formatDateTime(activity.createdAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                Paciente: {activity.pacienteLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                Viaje: {activity.viajeLabel ?? activity.viajeId}
              </p>
            </div>

            <div className="grid gap-3">
              {activity.changes.length > 0 ? (
                activity.changes.map((change) => (
                  <div
                    className="grid gap-3 rounded-sm border bg-background p-4"
                    key={change.field}
                  >
                    <div className="grid gap-1">
                      <p className="text-base font-medium">
                        {formatFieldLabel(change.field)}
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <span className="text-muted-foreground">Antes</span>
                        <div className="max-h-48 overflow-auto rounded-sm bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                          {formatChangeValue(change.before)}
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <span className="text-muted-foreground">Despues</span>
                        <div className="max-h-48 overflow-auto rounded-sm bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                          {formatChangeValue(change.after)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-sm bg-muted/20 p-4 text-base text-muted-foreground">
                  Esta actividad no tiene detalle de campos modificados.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function activityActionLabel(row: AdminActivityLogRow) {
  if (row.action === "created") {
    return row.subject === "paciente" ? "Creo paciente" : "Creo registro";
  }

  const fields = row.changedFields.length;
  return fields > 0
    ? `Actualizo ${fields} ${fields === 1 ? "campo" : "campos"}`
    : "Actualizo registro";
}

const fieldLabels: Record<string, string> = {
  abdomenPelvis: "Abdomen y pelvis",
  antecedentesNoPatologicos: "Antecedentes no patologicos",
  antecedentesPatologicos: "Antecedentes patologicos",
  after: "Valor nuevo",
  apellidoMaterno: "Apellido materno",
  apellidoPaterno: "Apellido paterno",
  aparatoCardiovascular: "Aparato cardiovascular",
  aparatoGenitourinario: "Aparato genitourinario",
  aparatoOsteoartromuscular: "Aparato osteoartromuscular",
  aparatoRespiratorio: "Aparato respiratorio",
  datosPersonales: "Datos personales",
  diagnosticoIMC: "Diagnostico por IMC",
  diagnostico: "Diagnostico",
  derecha: "Derecha",
  dimensiones: "Dimensiones",
  ecografia: "Ecografia",
  ecogenicidad: "Ecogenicidad",
  electrocardiograma: "Electrocardiograma",
  espirometria: "Espirometria",
  etnia: "Etnia",
  examenFisicoGeneral: "Examen fisico general",
  examenFisicoSegmentario: "Examen fisico segmentario",
  FEV1: "FEV1",
  FVC: "FVC",
  FEV1FVC: "Relacion FEV1/FVC",
  flujoEspiratorioPicoPEF: "Flujo espiratorio pico",
  frecuenciaCardiaca: "Frecuencia cardiaca",
  frecuenciaRespiratoria: "Frecuencia respiratoria",
  glicemiaCapilar: "Glicemia capilar",
  grupoSanguineo: "Grupo sanguineo",
  higado: "Higado",
  historiaEnfermedadActual: "Historia de enfermedad actual",
  iNo: "Identificador CIE",
  imc: "IMC",
  izquierda: "Izquierda",
  laboratorios: "Laboratorios",
  max: "Presion sistolica",
  min: "Presion diastolica",
  nacionalidad: "Nacionalidad",
  nombres: "Nombres",
  observaciones: "Observaciones",
  otrosEstudios: "Otros estudios",
  paciente: "Paciente",
  parenquima: "Parenquima",
  peso: "Peso",
  planTrabajo: "Plan de trabajo",
  porcentajeFEVteorico: "Porcentaje FEV1 teorico",
  porcentajeFVCteorico: "Porcentaje FVC teorico",
  porcentajeFEV1FVCteorico: "Porcentaje FEV1/FVC teorico",
  porcentajePEFteorico: "Porcentaje PEF teorico",
  presionArterial: "Presion arterial",
  principal: "Diagnostico principal",
  resultado: "Resultado",
  riñones: "Rinones",
  secundario: "Diagnostico secundario",
  secundarios: "Diagnosticos secundarios",
  temperaturaAxilar: "Temperatura axilar",
  title: "Nombre del diagnostico",
  tratamiento: "Tratamiento",
  vesiculaBiliar: "Vesicula biliar",
  code: "Codigo CIE",
};

function formatFieldLabel(field: string) {
  return field
    .split(".")
    .map((part, index, parts) => {
      if (/^\d+$/.test(part)) {
        const previous = parts[index - 1];
        const prefix =
          previous && fieldLabels[previous]
            ? fieldLabels[previous]
            : "Elemento";

        return `${prefix} ${Number(part) + 1}`;
      }

      return fieldLabels[part] ?? humanizeFieldPart(part);
    })
    .filter((part, index, parts) => part !== parts[index - 1])
    .join(" / ");
}

function humanizeFieldPart(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatChangeValue(value: unknown): string {
  if (value === undefined) {
    return "Sin valor";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Sin elementos";
    }

    return value.map((item) => `- ${formatChangeValue(item)}`).join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return "Sin datos";
    }

    return entries
      .map(([key, nestedValue]) => {
        const formatted: string = formatChangeValue(nestedValue);

        return `${formatFieldLabel(key)}: ${formatted}`;
      })
      .join("\n");
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Valor no serializable";
  }
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function mergeActivityRows(
  currentRows: AdminActivityLogRow[],
  incomingRows: AdminActivityLogRow[],
) {
  const seen = new Set(currentRows.map((row) => row.id));
  const merged = [...currentRows];

  for (const row of incomingRows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }

  return merged;
}
