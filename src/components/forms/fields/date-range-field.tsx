"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Field } from "@/components/forms/fields/field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRangeFieldProps = {
  endName: string;
  error?: string;
  label: string;
  onChange: (value: { from: string; to: string }) => void;
  required?: boolean;
  startName: string;
  value: {
    from: string;
    to: string;
  };
};

function parseDate(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRangeLabel(value: DateRangeFieldProps["value"]) {
  if (!value.from && !value.to) {
    return "Seleccione un rango";
  }

  if (value.from && !value.to) {
    return `${formatDateLabel(value.from)} - Seleccione salida`;
  }

  if (!value.from && value.to) {
    return `Seleccione entrada - ${formatDateLabel(value.to)}`;
  }

  return `${formatDateLabel(value.from)} - ${formatDateLabel(value.to)}`;
}

export function DateRangeField({
  endName,
  error,
  label,
  onChange,
  required,
  startName,
  value,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = {
    from: parseDate(value.from),
    to: parseDate(value.to),
  };

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) {
      onChange({ from: "", to: "" });
      return;
    }

    const nextFrom = formatDateValue(range.from);

    if (!value.from || value.to) {
      onChange({
        from: nextFrom,
        to: "",
      });
      return;
    }

    const nextTo = range.to ? formatDateValue(range.to) : nextFrom;

    onChange({
      from: nextFrom,
      to: nextTo,
    });
    setOpen(false);
  }

  return (
    <Field error={error}>
      <Label htmlFor={startName}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <input name={startName} required={required} type="hidden" value={value.from} />
      <input name={endName} required={required} type="hidden" value={value.to} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-invalid={Boolean(error)}
            className={cn(
              "h-10 justify-start rounded-md font-normal",
              !value.from && !value.to && "text-muted-foreground",
            )}
            id={startName}
            type="button"
            variant="outline"
          >
            <CalendarIcon data-icon="inline-start" />
            {formatRangeLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            captionLayout="dropdown"
            mode="range"
            onSelect={handleSelect}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
