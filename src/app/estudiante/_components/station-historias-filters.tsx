"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Field } from "@/components/forms/fields";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

type StationHistoriasFiltersProps = {
  id: string;
  query: string;
};

export function StationHistoriasFilters({
  id,
  query,
}: StationHistoriasFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState(query);

  const nextQuery = useMemo(() => {
    const params = new URLSearchParams();
    const trimmedValue = value.trim();

    if (trimmedValue) {
      params.set("q", trimmedValue);
    }

    return params.toString();
  }, [value]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [nextQuery, pathname, router]);

  return (
    <Field>
      <Label htmlFor={id}>Buscar historia</Label>
      <InputGroup className="max-w-2xl">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          autoComplete="off"
          id={id}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Numero de documento, nombres o apellidos"
          type="search"
          value={value}
        />
        {value ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Limpiar busqueda"
              onClick={() => setValue("")}
              size="icon-xs"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Field>
  );
}
