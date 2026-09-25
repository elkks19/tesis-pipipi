"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Field } from "@/components/forms/fields/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type IcdCodeValue = {
  code: string;
  iNo: string;
  title: string;
};

type IcdCodePickerProps = {
  baseName: string;
  error?: string;
  label: string;
  onChange: (value: IcdCodeValue) => void;
  value: IcdCodeValue;
};

type EctSelectedEntity = {
  code?: string;
  foundationUri?: string;
  iNo?: string;
  linearizationUri?: string;
  selectedText?: string;
  title?: string;
};

type EctHandler = {
  bind: (iNo: string) => void;
  clear: (iNo: string) => void;
  configure: (
    settings: Record<string, unknown>,
    callbacks?: Record<string, unknown>,
  ) => void;
  search: (iNo: string, query: string) => void;
};

declare global {
  interface Window {
    ECT?: {
      Handler: EctHandler;
    };
  }
}

const ectScriptUrl = "https://icdcdn.who.int/embeddedct/icd11ect-1.7.1.js";
const ectStyleUrl = "https://icdcdn.who.int/embeddedct/icd11ect-1.7.1.css";
const ectCallbacks = new Map<string, (entity: EctSelectedEntity) => void>();
let ectAssetsPromise: Promise<void> | null = null;
let ectConfigured = false;

function loadEctAssets() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (ectAssetsPromise) {
    return ectAssetsPromise;
  }

  ectAssetsPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${ectStyleUrl}"]`)) {
      const link = document.createElement("link");
      link.href = ectStyleUrl;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    if (window.ECT?.Handler) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${ectScriptUrl}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar el codificador CIE-11.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = ectScriptUrl;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar el codificador CIE-11.")),
      { once: true },
    );
    document.body.appendChild(script);
  });

  return ectAssetsPromise;
}

function configureEct() {
  if (ectConfigured || !window.ECT?.Handler) {
    return;
  }

  window.ECT.Handler.configure(
    {
      apiServerUrl: "https://icd11restapi-developer-test.azurewebsites.net",
      autoBind: false,
      chaptersAvailable: false,
      height: "52vh",
      language: "es",
      searchByCodeOrURI: true,
      sourceApp: "unifranz-tesis",
      wordsAvailable: false,
    },
    {
      selectedEntityFunction: (selectedEntity: EctSelectedEntity) => {
        const iNo = selectedEntity.iNo;

        if (!iNo) {
          return;
        }

        ectCallbacks.get(iNo)?.(selectedEntity);
      },
    },
  );
  ectConfigured = true;
}

function getSelectedValue(entity: EctSelectedEntity): IcdCodeValue {
  return {
    code: entity.code ?? "",
    iNo: entity.foundationUri ?? entity.linearizationUri ?? entity.iNo ?? "",
    title: entity.title ?? entity.selectedText ?? "",
  };
}

export function IcdCodePicker({
  baseName,
  error,
  label,
  onChange,
  value,
}: IcdCodePickerProps) {
  const reactId = useId();
  const instanceId = useMemo(
    () => `icd${reactId.replace(/[^a-zA-Z0-9]/g, "")}`,
    [reactId],
  );
  const [open, setOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    ectCallbacks.set(instanceId, (selectedEntity) => {
      onChange(getSelectedValue(selectedEntity));
      window.ECT?.Handler.clear(instanceId);
      setOpen(false);
    });

    return () => {
      ectCallbacks.delete(instanceId);
    };
  }, [instanceId, onChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    loadEctAssets()
      .then(() => {
        if (cancelled) {
          return;
        }

        configureEct();
        window.ECT?.Handler.bind(instanceId);
        setIsReady(true);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el codificador CIE-11.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [instanceId, open]);

  return (
    <Field error={error} name={baseName}>
      <Label htmlFor={baseName}>{label}</Label>
      <input name={`${baseName}.code`} type="hidden" value={value.code} />
      <input name={`${baseName}.title`} type="hidden" value={value.title} />
      <input name={`${baseName}.iNo`} type="hidden" value={value.iNo} />
      <Button
        aria-describedby={error ? `${baseName}-error` : undefined}
        aria-invalid={Boolean(error)}
        className="h-auto min-h-10 justify-start text-left font-normal"
        onClick={() => setOpen(true)}
        id={baseName}
        type="button"
        variant="outline"
      >
        <SearchIcon data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate">
          {value.title
            ? `${value.title}${value.code ? ` (${value.code})` : ""}`
            : "Seleccionar enfermedad CIE-11"}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
            <DialogTitle>Buscar enfermedad CIE-11</DialogTitle>
            <DialogDescription>
              Escribe el diagnóstico o código y selecciona una opción del listado.
            </DialogDescription>
          </DialogHeader>
          <div className="icd-ect-scope flex min-h-0 flex-col gap-4 p-4 sm:p-6">
            <Label htmlFor={`${instanceId}-search`}>Diagnóstico o código CIE-11</Label>
            <Input
              id={`${instanceId}-search`}
              autoComplete="off"
              className="ctw-input h-11"
              data-ctw-ino={instanceId}
              disabled={Boolean(loadError)}
              placeholder="Ej. dolor abdominal o un código CIE-11"
              onChange={(event) => {
                if (isReady) {
                  window.ECT?.Handler.search(instanceId, event.target.value);
                }
              }}
            />
            {loadError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {loadError}
              </div>
            ) : null}
            <div
              className="ctw-window min-h-64 rounded-xl border bg-background p-3"
              data-ctw-ino={instanceId}
            />
          </div>
          <style>{`
            .icd-ect-scope .ctw-window {
              overflow: auto;
              max-height: min(55dvh, 560px);
              scrollbar-width: thin;
              scrollbar-color: var(--border) transparent;
            }

            .icd-ect-scope .ctw-window,
            .icd-ect-scope .ctw-window * {
              font-family: inherit;
            }

            .icd-ect-scope .ectComponent,
            .icd-ect-scope .ectComponent .defaultFontColor,
            .icd-ect-scope .ectComponent .entityTitle,
            .icd-ect-scope .ectComponent .propertyHeader,
            .icd-ect-scope .ectComponent .propertyHeaderSelection {
              color: var(--foreground);
              line-height: 1.6;
            }

            .icd-ect-scope .ectComponent .entitylist ul.toplevel {
              margin: 0;
              padding: 0;
              list-style: none;
            }

            .icd-ect-scope .ectComponent .entityInList {
              padding: 6px 0;
              border-bottom: 1px solid var(--border);
            }

            .icd-ect-scope .ectComponent .entityHead {
              align-items: baseline;
              gap: 12px;
              padding: 10px 12px;
              border-radius: 8px;
            }

            .icd-ect-scope .ectComponent .entityTheCode {
              flex: 0 0 7em;
              color: var(--muted-foreground);
              font-size: 12px;
              font-variant-numeric: tabular-nums;
              overflow: visible;
              white-space: normal;
              overflow-wrap: anywhere;
            }

            .icd-ect-scope .ectComponent .entityTitleAndIcons,
            .icd-ect-scope .ectComponent .entityTitle {
              min-width: 0;
              overflow-wrap: anywhere;
            }

            .icd-ect-scope .ectComponent .entityHead.currentEntityHighlighted,
            .icd-ect-scope .ectComponent .entityHead:not(.keyboardOnlyHighlight):hover,
            .icd-ect-scope .ectComponent .highlightedEntity,
            .icd-ect-scope .ectComponent .highlightedEntityPv,
            .icd-ect-scope .ectComponent .importantlabelCurrentEntityHighlighted {
              background-color: var(--accent) !important;
              color: var(--accent-foreground);
            }

            .icd-ect-scope .ectComponent .pvs {
              margin: 4px 12px 6px;
              padding: 6px 12px;
              border-radius: 6px;
              background-color: var(--muted);
              color: var(--muted-foreground);
            }

            .icd-ect-scope .ectComponent .entityPv,
            .icd-ect-scope .ectComponent .highlightedEntityPv {
              border-color: transparent !important;
            }

            .icd-ect-scope .ectComponent em.found,
            .icd-ect-scope .ectComponent em.found em,
            .icd-ect-scope .ectComponent em.wbe,
            .icd-ect-scope .ectComponent em.nonwbe {
              color: var(--primary);
              font-style: normal;
              font-weight: 600;
            }

            .icd-ect-scope .ectComponent .showlink,
            .icd-ect-scope .ectComponent .showlinkNormalSize {
              color: var(--primary) !important;
              font-size: 12px;
            }

            .icd-ect-scope .ectComponent .showdetails {
              padding-left: 8px;
            }

            .icd-ect-scope .ectComponent .statusFlexInfo {
              padding: 8px 12px;
              margin-bottom: 8px;
              border-radius: 6px;
              background: var(--muted);
              text-align: left;
              white-space: normal;
              font-size: 12px;
            }

            .icd-ect-scope .ectComponent .chopped {
              color: var(--foreground);
            }

            .icd-ect-scope .ectComponent .entityDetails,
            .icd-ect-scope .ectComponent .entityDetailsSelection {
              background-color: var(--muted) !important;
              border-color: var(--border);
              color: var(--foreground);
              border-radius: 8px;
            }

            .icd-ect-scope .ectComponent .entityDetailsTheCode,
            .icd-ect-scope .ectComponent .entityTheCodeInDetails {
              color: var(--foreground);
            }

            .icd-ect-scope .ctw-window table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.875rem;
            }

            .icd-ect-scope .ctw-window tr {
              border-bottom: 1px solid var(--border);
            }

            .icd-ect-scope .ctw-window td,
            .icd-ect-scope .ctw-window th {
              padding: 0.75rem;
              vertical-align: top;
            }

            .icd-ect-scope .ctw-window a,
            .icd-ect-scope .ctw-window button,
            .icd-ect-scope .ctw-window [role="button"] {
              border-radius: var(--radius-md);
            }

            .icd-ect-scope .ctw-window [class*="chapter"],
            .icd-ect-scope .ctw-window [class*="filter"],
            .icd-ect-scope .ctw-window [class*="word"],
            .icd-ect-scope .ctw-window [class*="hierarchy"] {
              display: none !important;
            }

            @media (max-width: 640px) {
              .icd-ect-scope .ectComponent .entityHead {
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px;
              }

              .icd-ect-scope .ectComponent .entityTheCode {
                flex-basis: 100%;
              }

              .icd-ect-scope .ectComponent .entityTitleAndIcons {
                flex-wrap: wrap;
                row-gap: 6px;
              }

              .icd-ect-scope .ctw-window table,
              .icd-ect-scope .ctw-window tbody,
              .icd-ect-scope .ctw-window tr,
              .icd-ect-scope .ctw-window td {
                display: block;
                width: 100%;
              }

              .icd-ect-scope .ctw-window td {
                padding: 0.625rem;
              }
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </Field>
  );
}
