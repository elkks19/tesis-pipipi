"use client";

import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { CheckIcon, ClipboardListIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-muted">
              <ClipboardListIcon />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">
          {sections.length > 0 ? (
            <div className="flex flex-col gap-5">
              {sections.map((section, sectionIndex) => (
                <section className="flex flex-col gap-3" key={section.title}>
                  {sectionIndex > 0 ? <Separator /> : null}
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <div
                        className="rounded-2xl bg-muted/40 p-3"
                        key={item.label}
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {item.label}
                        </span>
                        <p className="mt-1 text-sm leading-relaxed">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
              No hay datos para resumir.
            </p>
          )}
        </div>
        <DialogFooter className="border-t px-5 py-4 sm:px-6">
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Revisar
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
