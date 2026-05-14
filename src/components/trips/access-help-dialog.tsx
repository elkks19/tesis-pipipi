"use client";

import type { ReactNode } from "react";
import {
  CalendarClockIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AccessHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <CircleHelpIcon data-icon="inline-start" />
          Como funciona el acceso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Como funciona el acceso</DialogTitle>
          <DialogDescription>
            El bloqueo es intencional para evitar registros fuera de viaje.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <StepItem
            icon={<CalendarClockIcon />}
            text="Revisa las fechas del proximo viaje asignado."
            title="Fechas"
          />
          <StepItem
            icon={<ShieldCheckIcon />}
            text="Cuando el viaje inicie, el sistema habilitara tu estacion."
            title="Acceso"
          />
          <StepItem
            icon={<ClipboardListIcon />}
            text="Si falta un viaje, pide al administrador revisar tu asignacion."
            title="Asignacion"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepItem({
  icon,
  text,
  title,
}: {
  icon: ReactNode;
  text: string;
  title: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-muted">
        {icon}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm leading-5 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
