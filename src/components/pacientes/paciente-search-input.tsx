"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type PacienteSearchInputProps = {
  initialValue: string;
};

export function PacienteSearchInput({
  initialValue,
}: PacienteSearchInputProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = value.trim();
      const currentQuery = searchParams.get("q") ?? "";

      if (nextQuery === currentQuery) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());

      if (nextQuery) {
        nextParams.set("q", nextQuery);
      } else {
        nextParams.delete("q");
      }

      nextParams.delete("pacienteId");

      const nextSearch = nextParams.toString();
      const nextHref = nextSearch ? `${pathname}?${nextSearch}` : pathname;

      startTransition(() => {
        router.replace(nextHref, { scroll: false });
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, searchParams, value, startTransition]);

  return (
    <InputGroup className="max-w-xl">
      <InputGroupInput
        aria-label="Buscar paciente"
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar por CI, nombres o apellidos"
        type="search"
        value={value}
      />
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
    </InputGroup>
  );
}
