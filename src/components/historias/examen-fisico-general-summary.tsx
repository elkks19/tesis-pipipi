import { ActivityIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ExamenFisicoGeneral } from "@/lib/schema/examenFisicoGeneral";

type ExamenFisicoGeneralSummaryProps = {
  examen?: ExamenFisicoGeneral;
};

function formatNumber(value: number | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin registro";
  }

  return `${value}${suffix ? ` ${suffix}` : ""}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm leading-relaxed">{value}</span>
    </div>
  );
}

function PressureDetail({
  label,
  pressure,
}: {
  label: string;
  pressure?: {
    max: number;
    min: number;
  };
}) {
  return (
    <Detail
      label={label}
      value={
        pressure
          ? `${formatNumber(pressure.max, "mmHg")} / ${formatNumber(
              pressure.min,
              "mmHg",
            )}`
          : "Sin registro"
      }
    />
  );
}

export function ExamenFisicoGeneralSummary({
  examen,
}: ExamenFisicoGeneralSummaryProps) {
  if (!examen) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Examen fisico general</CardTitle>
          <CardDescription>
            Esta historia aun no tiene examen fisico general registrado.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
            <ActivityIcon />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Examen fisico general registrado</CardTitle>
            <CardDescription>
              Signos vitales y antropometria para contextualizar el examen
              segmentario.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section className="grid gap-4 md:grid-cols-3">
          <PressureDetail
            label="Presion arterial derecha"
            pressure={examen.presionArterial.derecha}
          />
          <PressureDetail
            label="Presion arterial izquierda"
            pressure={examen.presionArterial.izquierda}
          />
          <Detail
            label="Presion arterial media"
            value={formatNumber(examen.presionArterialMedia, "mmHg")}
          />
        </section>

        <Separator />

        <section className="grid gap-4 md:grid-cols-4">
          <Detail label="Pulsos" value={formatNumber(examen.pulsos, "lpm")} />
          <Detail
            label="Frecuencia respiratoria"
            value={formatNumber(examen.frecuenciaRespiratoria, "rpm")}
          />
          <Detail
            label="Frecuencia cardiaca"
            value={formatNumber(examen.frecuenciaCardiaca, "lpm")}
          />
          <Detail
            label="Temperatura axilar"
            value={formatNumber(examen.temperaturaAxilar, "C")}
          />
        </section>

        <Separator />

        <section className="grid gap-4 md:grid-cols-4">
          <Detail label="Peso" value={formatNumber(examen.peso, "kg")} />
          <Detail label="Talla" value={formatNumber(examen.talla, "cm")} />
          <Detail label="IMC" value={formatNumber(examen.imc)} />
          <Detail label="Diagnostico IMC" value={examen.diagnosticoIMC} />
          <Detail
            label="Perimetro cintura"
            value={formatNumber(examen.perimetroCintura, "cm")}
          />
          <Detail
            label="Perimetro cadera"
            value={formatNumber(examen.perimetroCadera, "cm")}
          />
          <Detail
            label="Indice cintura/cadera"
            value={formatNumber(examen.indiceCinturaCadera)}
          />
        </section>
      </CardContent>
    </Card>
  );
}
