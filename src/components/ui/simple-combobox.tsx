"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SimpleComboboxOption = {
  description?: string;
  label: string;
  value: string;
};

export function SimpleCombobox({
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  emptyLabel = "Sin resultados",
  onValueChange,
  options,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar",
  value,
}: {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  emptyLabel?: string;
  onValueChange: (value: string) => void;
  options: SimpleComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(
        normalizedQuery,
      ),
    );
  }, [options, query]);

  function selectValue(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-expanded={open}
          className="h-9 justify-between bg-muted/20 px-3 text-left text-sm font-normal shadow-none hover:bg-muted/35"
          role="combobox"
          size="sm"
          variant="ghost"
        >
          <span className="min-w-0 truncate">
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronsUpDownIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
        </InputGroup>
        <div className="mt-3 max-h-72 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-md px-3 py-2.5 text-left text-base hover:bg-accent",
                    selected && "bg-primary/10 text-primary",
                  )}
                  key={option.value}
                  onClick={() => selectValue(option.value)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="block truncate text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {selected ? <CheckIcon aria-hidden="true" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
