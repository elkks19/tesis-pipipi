import { ClipboardListIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Anamnesis } from "@/lib/schema/anamnesis";

type AnamnesisSummaryProps = {
  anamnesis?: Anamnesis;
};

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "Sin registro";
  }

  return value ? "Si" : "No";
}

function formatOptional(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Sin registro";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm leading-relaxed">{formatOptional(value)}</span>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {value?.trim() || "Sin registro"}
      </p>
    </div>
  );
}

function DiseaseList({
  emptyText,
  items,
  type,
}: {
  emptyText: string;
  items: Anamnesis["antecedentesPatologicos"]["familiares"] | Anamnesis["antecedentesPatologicos"]["personales"];
  type: "familiares" | "personales";
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div className="rounded-2xl border bg-background p-3" key={index}>
          <p className="text-sm font-medium">
            {item.enfermedad.title || item.enfermedad.code || "Sin nombre"}
          </p>
          <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <span>CIE: {item.enfermedad.code || "Sin codigo"}</span>
            {type === "personales" ? (
              <>
                <span>
                  Diagnostico:{" "}
                  {formatOptional(
                    (item as Anamnesis["antecedentesPatologicos"]["personales"][number])
                      .fechaDiagnostico,
                  )}
                </span>
                <span className="md:col-span-2">
                  Tratamiento:{" "}
                  {formatOptional(
                    (item as Anamnesis["antecedentesPatologicos"]["personales"][number])
                      .tratamiento,
                  )}
                </span>
              </>
            ) : (
              <>
                <span>
                  Parentesco:{" "}
                  {formatOptional(
                    (item as Anamnesis["antecedentesPatologicos"]["familiares"][number])
                      .parentesco,
                  )}
                </span>
                <span>
                  Edad diagnostico:{" "}
                  {formatOptional(
                    (item as Anamnesis["antecedentesPatologicos"]["familiares"][number])
                      .edadDiagnostico,
                  )}
                </span>
                <span>
                  Fallecimiento:{" "}
                  {formatBoolean(
                    (item as Anamnesis["antecedentesPatologicos"]["familiares"][number])
                      .fallecimiento,
                  )}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnamnesisSummary({ anamnesis }: AnamnesisSummaryProps) {
  if (!anamnesis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anamnesis</CardTitle>
          <CardDescription>
            Esta historia aun no tiene datos de anamnesis registrados.
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
            <ClipboardListIcon />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Anamnesis registrada</CardTitle>
            <CardDescription>
              Referencia clinica para completar el examen fisico general.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          <TextBlock label="Motivo de consulta" value={anamnesis.motivoConsulta} />
          <TextBlock
            label="Historia de enfermedad actual"
            value={anamnesis.historiaEnfermedadActual}
          />
        </div>

        <Separator />

        <section className="grid gap-4 md:grid-cols-3">
          <Detail label="Estado civil" value={anamnesis.estadoCivil} />
          <Detail label="Nivel educativo" value={anamnesis.nivelEducativo} />
          <Detail label="Años cursados" value={anamnesis.añosCursados} />
          <Detail label="Situacion laboral" value={anamnesis.situacionLaboral} />
          <Detail
            label="Actividad fisica"
            value={formatBoolean(
              anamnesis.antecedentesNoPatologicos.realizaActividadFisica,
            )}
          />
          <Detail
            label="Frutas y verduras"
            value={anamnesis.antecedentesNoPatologicos.consumoFrutasVerduras}
          />
          <Detail
            label="Tabaco"
            value={anamnesis.antecedentesNoPatologicos.habitoTabaquico}
          />
          <Detail
            label="Alcohol"
            value={anamnesis.antecedentesNoPatologicos.consumoAlcohol}
          />
        </section>

        <Separator />

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              Antecedentes patologicos personales
            </h3>
            <DiseaseList
              emptyText="Sin antecedentes personales registrados."
              items={anamnesis.antecedentesPatologicos.personales}
              type="personales"
            />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Antecedentes familiares</h3>
            <DiseaseList
              emptyText="Sin antecedentes familiares registrados."
              items={anamnesis.antecedentesPatologicos.familiares}
              type="familiares"
            />
          </div>
        </section>

        {anamnesis.antecedentesGinecoObstetricos ? (
          <>
            <Separator />
            <section className="grid gap-4 md:grid-cols-3">
              <Detail
                label="Estadio Tanner"
                value={anamnesis.antecedentesGinecoObstetricos.estadioTanner}
              />
              <Detail
                label="Gestaciones"
                value={anamnesis.antecedentesGinecoObstetricos.gestaciones}
              />
              <Detail
                label="Partos"
                value={anamnesis.antecedentesGinecoObstetricos.partos}
              />
              <Detail
                label="Abortos"
                value={anamnesis.antecedentesGinecoObstetricos.abortos}
              />
              <Detail
                label="Cesareas"
                value={anamnesis.antecedentesGinecoObstetricos.cesareas}
              />
              <Detail
                label="Anticoncepcion"
                value={formatBoolean(
                  anamnesis.antecedentesGinecoObstetricos.terapiaAnticonceptiva,
                )}
              />
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
