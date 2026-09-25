import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  basePath: string;
  query: string;
  pagination: { page: number; pageSize: number; hasNext: boolean; pacientes: unknown[] };
  selected?: boolean;
  footer?: boolean;
};

export function PacienteListNavigation({ basePath, query, pagination, selected, footer }: Props) {
  const { page, pageSize, hasNext, pacientes } = pagination;
  function href(targetPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `${basePath}/create-historia?${params}`;
  }

  if (selected) {
    return <Button asChild variant="outline" size="sm" className="self-start">
      <Link href={href(page)}><ChevronLeftIcon data-icon="inline-start" />Volver al listado</Link>
    </Button>;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        {!footer && <h2 className="text-base font-semibold">{query ? "Resultados de búsqueda" : "Pacientes registrados"}</h2>}
        <p className="text-sm text-muted-foreground" role="status">
          {pacientes.length ? `Mostrando ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + pacientes.length} · Página ${page}` : `Sin pacientes en esta página · Página ${page}`}
        </p>
      </div>
      {footer ? (
        <nav aria-label="Paginación de pacientes" className="flex items-center gap-2">
          {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(page - 1)}><ChevronLeftIcon data-icon="inline-start" />Anterior</Link></Button> : <Button disabled variant="outline" size="sm"><ChevronLeftIcon data-icon="inline-start" />Anterior</Button>}
          {hasNext ? <Button asChild variant="outline" size="sm"><Link href={href(page + 1)}>Siguiente<ChevronRightIcon data-icon="inline-end" /></Link></Button> : <Button disabled variant="outline" size="sm">Siguiente<ChevronRightIcon data-icon="inline-end" /></Button>}
        </nav>
      ) : (
        <Button asChild size="sm"><Link href={`${basePath}/create-paciente`}><PlusIcon data-icon="inline-start" />Nuevo paciente</Link></Button>
      )}
    </div>
  );
}
