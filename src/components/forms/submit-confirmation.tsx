"use client";

import {
  type FormEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { ArrowLeftIcon, CheckIcon, ClipboardListIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SubmitSummaryItem = {
  label: string;
  value: ReactNode;
};

export type SubmitSummarySection = {
  items: SubmitSummaryItem[];
  title: string;
};

type UseSubmitConfirmationOptions = {
  actionAvailable: boolean;
  confirmLabel?: string;
  description?: string;
  title?: string;
};

function isEmptyValue(value: ReactNode) {
  return value === undefined || value === null || value === "";
}

export function textSummary(value: unknown, fallback = "Sin registrar") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

export function booleanSummary(value: boolean, trueText = "Si", falseText = "No") {
  return value ? trueText : falseText;
}

export function listSummary(values: unknown[], fallback = "Sin registrar") {
  const normalized = values
    .map((value) => textSummary(value, ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized.join(", ") : fallback;
}

export function compactSummarySections(
  sections: SubmitSummarySection[],
): SubmitSummarySection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !isEmptyValue(item.value)),
    }))
    .filter((section) => section.items.length > 0);
}

export function useSubmitConfirmation({
  actionAvailable,
  confirmLabel = "Guardar datos",
  description = "Revisa este resumen antes de guardar los datos.",
  title = "Confirmar guardado",
}: UseSubmitConfirmationOptions) {
  const summaryId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SubmitSummarySection[]>([]);

  function confirmSubmit(
    event: FormEvent<HTMLFormElement>,
    nextSections: SubmitSummarySection[],
  ) {
    if (!actionAvailable) {
      event.preventDefault();
      return false;
    }

    if (confirmedRef.current) {
      confirmedRef.current = false;
      return true;
    }

    event.preventDefault();
    setSections(compactSummarySections(nextSections));
    setOpen(true);
    return false;
  }

  function submitConfirmed() {
    confirmedRef.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  const confirmationDialog = (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 py-5 pr-14 text-left sm:py-6 sm:pl-6">
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ClipboardListIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Revisión final</p>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/40 [scrollbar-gutter:stable]">
          {sections.length > 0 ? (
            <div className="grid items-start gap-5 p-4 sm:p-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
              <nav aria-label="Índice del resumen" className="hidden lg:sticky lg:top-6 lg:block">
                <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contenido</p>
                <ol className="flex flex-col gap-1">
                  {sections.map((section, index) => (
                    <li key={section.title}>
                      <a href={`#${summaryId}-section-${index}`} className="flex items-baseline gap-2 rounded-lg px-2 py-2 text-xs leading-relaxed text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="shrink-0 font-medium tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span>
                        <span>{section.title}</span>
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 px-2 text-xs leading-relaxed text-muted-foreground">Revisa cada sección antes de confirmar el guardado.</p>
              </nav>
              <div className="flex min-w-0 flex-col gap-5">
              {sections.map((section, sectionIndex) => (
                <section id={`${summaryId}-section-${sectionIndex}`} aria-labelledby={`${summaryId}-title-${sectionIndex}`} className="scroll-mt-5 overflow-hidden rounded-xl border bg-background shadow-sm" key={section.title}>
                  <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
                    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                      {String(sectionIndex + 1).padStart(2, "0")}
                    </span>
                    <h3 id={`${summaryId}-title-${sectionIndex}`} className="text-sm font-semibold tracking-tight">{section.title}</h3>
                  </div>
                  <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                    {section.items.map((item) => (
                      <div
                        className={cn("flex min-w-0 flex-col gap-1.5 border-b border-border/60 pb-3", typeof item.value === "string" && (item.value.length > 90 || item.value.includes("\n")) && "sm:col-span-2")}
                        key={item.label}
                      >
                        <dt className="text-xs leading-relaxed text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className={cn("whitespace-pre-wrap text-sm font-medium leading-relaxed [overflow-wrap:anywhere]", item.value === "Sin registrar" && "font-normal italic text-muted-foreground")}>
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
              No hay datos para resumir.
            </p>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-3 border-t bg-muted/20 px-5 py-4 sm:items-center sm:px-6">
          <p className="mr-auto hidden text-xs text-muted-foreground sm:block">Confirma cuando hayas revisado los datos.</p>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a revisar
          </Button>
          <Button onClick={submitConfirmed} type="button">
            <CheckIcon data-icon="inline-start" />
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    confirmationDialog,
    confirmSubmit,
    formRef,
  };
}
