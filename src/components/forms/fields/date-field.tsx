"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

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

type DateFieldProps = {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
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
    return "Seleccione una fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function DateField({
  error,
  label,
  name,
  onChange,
  required,
  value,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <Field error={error} name={name}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <input name={name} required={required} type="hidden" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-describedby={error ? `${name}-error` : undefined}
            aria-invalid={Boolean(error)}
            className={cn(
              "h-10 justify-start rounded-md font-normal",
              !value && "text-muted-foreground",
            )}
            id={name}
            type="button"
            variant="outline"
          >
            <CalendarIcon data-icon="inline-start" />
            {formatDateLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            captionLayout="dropdown"
            mode="single"
            onSelect={(date) => {
              if (!date) {
                return;
              }

              onChange(formatDateValue(date));
              setOpen(false);
            }}
            selected={parseDate(value)}
          />
          {!required && value ? (
            <Button className="m-2" onClick={() => { onChange(""); setOpen(false); }} size="sm" type="button" variant="ghost">
              Quitar fecha
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </Field>
  );
}
