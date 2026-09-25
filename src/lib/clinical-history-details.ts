import type { Historia } from "./schema/historia";

type FieldSpec = readonly [path: string, label: string];
export type ClinicalDetailGroup = { title: string; items: { label: string; value: string }[] };

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) =>
    current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Sin registrar";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.length ? value.map(display).join(", ") : "Sin registros";
  if (value instanceof Date) return value.toISOString().slice(0, 10).split("-").reverse().join("/");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return value.slice(0, 10).split("-").reverse().join("/");
  return String(value);
}

function group(title: string, data: unknown, fields: readonly FieldSpec[]): ClinicalDetailGroup {
  return { title, items: fields.map(([path, label]) => ({ label, value: display(readPath(data, path)) })) };
}

const disease: FieldSpec[] = [["enfermedad.title", "Enfermedad"], ["enfermedad.code", "Código CIE-11"]];

export function getClinicalDetailGroups(historia: Historia, station: string): ClinicalDetailGroup[] {
  if (station === "anamnesis" && historia.anamnesis) {
    const a = historia.anamnesis;
    const groups = [
      group("Consulta actual", a, [["motivoConsulta", "Motivo de consulta"], ["historiaEnfermedadActual", "Historia de enfermedad actual"]]),
      group("Contexto social", a, [["estadoCivil", "Estado civil"], ["nivelEducativo", "Nivel educativo"], ["añosCursados", "Años cursados"], ["situacionLaboral", "Situación laboral"]]),
      group("Hábitos y estilo de vida", a.antecedentesNoPatologicos, [["habitoTabaquico", "Hábito tabáquico"], ["consumoAlcohol", "Consumo de alcohol"], ["realizaActividadFisica", "Actividad física"], ["consumoFrutasVerduras", "Consumo de frutas y verduras"]]),
    ];
    const personales = a.antecedentesPatologicos?.personales ?? [];
    const familiares = a.antecedentesPatologicos?.familiares ?? [];
    groups.push(...(personales.length ? personales.map((item, index) => group(`Antecedente personal ${index + 1}`, item, [...disease, ["fechaDiagnostico", "Fecha de diagnóstico"], ["tratamiento", "Tratamiento"]])) : [{ title: "Antecedentes personales", items: [{ label: "Registros", value: "Sin antecedentes registrados" }] }]));
    groups.push(...(familiares.length ? familiares.map((item, index) => group(`Antecedente familiar ${index + 1}`, item, [["parentesco", "Parentesco"], ...disease, ["edadDiagnostico", "Edad de diagnóstico (años)"], ["fallecimiento", "Fallecimiento"], ["edadFallecimiento", "Edad de fallecimiento (años)"]])) : [{ title: "Antecedentes familiares", items: [{ label: "Registros", value: "Sin antecedentes registrados" }] }]));
    if (a.antecedentesGinecoObstetricos) {
      const g = a.antecedentesGinecoObstetricos;
      groups.push(
        group("Desarrollo y ciclo menstrual", g, [["estadioTanner", "Estadio Tanner"], ["menarca", "Menarca (años)"], ["ritmoMenstrual", "Ritmo menstrual"], ["edadMenopausia", "Edad de menopausia (años)"]]),
        group("Antecedentes obstétricos", g, [["gestaciones", "Gestaciones"], ["partos", "Partos"], ["abortos", "Abortos"], ["cesareas", "Cesáreas"], ["fechaUltimaGestacion", "Última gestación"], ["fechaUltimoParto", "Último parto"], ["fechaUltimoAborto", "Último aborto"], ["fechaUltimaCesarea", "Última cesárea"]]),
        group("Salud sexual y ginecológica", g, [["terapiaAnticonceptiva", "Terapia anticonceptiva"], ["metodoAnticonceptivo", "Método anticonceptivo"], ["inicioVidaSexual", "Inicio de vida sexual (años)"], ["numeroParejasSexuales", "Número de parejas sexuales"], ["cirugiaPelviana", "Cirugía pelviana"], ["fechaPapanicolau", "Fecha de Papanicolau"], ["resultadoPapanicolau", "Resultado de Papanicolau"], ["colposcopia", "Colposcopia"], ["biopsiaCervical", "Biopsia cervical"]]),
      );
    }
    return groups;
  }
  if (station === "examenFisicoGeneral" && historia.examenFisicoGeneral) return [
    group("Signos vitales", historia.examenFisicoGeneral, [["presionArterial.derecha.max", "Presión derecha · sistólica (mmHg)"], ["presionArterial.derecha.min", "Presión derecha · diastólica (mmHg)"], ["presionArterial.izquierda.max", "Presión izquierda · sistólica (mmHg)"], ["presionArterial.izquierda.min", "Presión izquierda · diastólica (mmHg)"], ["presionArterialMedia", "Presión arterial media (mmHg)"], ["pulsos", "Pulsos"], ["frecuenciaCardiaca", "Frecuencia cardíaca (lpm)"], ["frecuenciaRespiratoria", "Frecuencia respiratoria (rpm)"], ["temperaturaAxilar", "Temperatura axilar (°C)"]]),
    group("Antropometría", historia.examenFisicoGeneral, [["peso", "Peso (kg)"], ["talla", "Talla (cm)"], ["imc", "IMC"], ["diagnosticoIMC", "Diagnóstico de IMC"], ["perimetroCadera", "Perímetro de cadera (cm)"], ["perimetroCintura", "Perímetro de cintura (cm)"], ["indiceCinturaCadera", "Índice cintura/cadera"]]),
  ];
  if (station === "examenFisicoSegmentario" && historia.examenFisicoSegmentario) return [group("Revisión por sistemas", historia.examenFisicoSegmentario, [["cabeza", "Cabeza"], ["cuello", "Cuello"], ["aparatoRespiratorio", "Aparato respiratorio"], ["aparatoCardiovascular", "Aparato cardiovascular"], ["abdomenPelvis", "Abdomen y pelvis"], ["aparatoGenitourinario", "Aparato genitourinario"], ["pielFaneras", "Piel y faneras"], ["sistemaHemolinfopoyetico", "Sistema hemolinfopoyético"], ["aparatoOsteoartromuscular", "Aparato osteoartromuscular"], ["sistemaNerviosoCentral", "Sistema nervioso central"]])];
  if (station === "electrocardiograma" && historia.electrocardiograma) return [
    group("Ritmo e intervalos", historia.electrocardiograma, [["ritmo", "Ritmo"], ["frecuenciaCardiaca", "Frecuencia cardíaca (lpm)"], ["intervaloPR", "Intervalo PR (ms)"], ["intervaloQTc", "Intervalo QTc (ms)"], ["duracionOndaP", "Duración de onda P (ms)"], ["duracionComplejoQRS", "Duración de complejo QRS (ms)"], ["duracionOndaT", "Duración de onda T (ms)"]]),
    group("Hallazgos y diagnóstico", historia.electrocardiograma, [["crecimientoAuriculaDerecha", "Crecimiento de aurícula derecha"], ["crecimientoAuriculaIzquierda", "Crecimiento de aurícula izquierda"], ["crecimientoVentriculoDerecho", "Crecimiento de ventrículo derecho"], ["crecimientoVentriculoIzquierdo", "Crecimiento de ventrículo izquierdo"], ["supraInfraDesnivelST", "Supra/infra desnivel ST"], ["derivacionSupraInfraDesnivelST", "Derivación del desnivel ST"], ["extrasistoleSupraventricular", "Extrasístole supraventricular"], ["extrasistoleIntraventricular", "Extrasístole intraventricular"], ["diagnostico", "Diagnóstico"]]),
  ];
  if (station === "espirometria" && historia.espirometria) return [group("Resultados de espirometría", historia.espirometria, [["FEV1", "FEV1"], ["porcentajeFEVteorico", "FEV1 teórico (%)"], ["FVC", "FVC"], ["porcentajeFVCteorico", "FVC teórico (%)"], ["FEV1FVC", "FEV1/FVC"], ["porcentajeFEV1FVCteorico", "FEV1/FVC teórico (%)"], ["flujoEspiratorioPicoPEF", "Flujo espiratorio pico (PEF)"], ["porcentajePEFteorico", "PEF teórico (%)"], ["fuenteDatosTeoricos", "Fuente de datos teóricos"], ["observaciones", "Observaciones"], ["diagnostico", "Diagnóstico"]])];
  if (station === "ecografia" && historia.ecografia) return [
    group("Hígado", historia.ecografia.higado, [["dimensiones", "Dimensiones (mm)"], ["hepatomegalia", "Hepatomegalia"], ["parenquima", "Parénquima"], ["diagnostico", "Diagnóstico"]]),
    group("Vesícula biliar", historia.ecografia.vesiculaBiliar, [["paredes", "Paredes"], ["contenidoAnecoico", "Contenido anecoico"], ["barroBiliar", "Barro biliar"], ["calculos", "Cálculos"], ["diagnostico", "Diagnóstico"]]),
    group("Riñones", historia.ecografia.riñones, [["derecho.longitud", "Longitud derecha (mm)"], ["derecho.parenquima", "Parénquima derecho (mm)"], ["izquierdo.longitud", "Longitud izquierda (mm)"], ["izquierdo.parenquima", "Parénquima izquierdo (mm)"], ["ecogenicidad", "Ecogenicidad"], ["relacionCorticoMedular", "Relación corticomedular"], ["diagnostico", "Diagnóstico"]]),
    group("Imagen adjunta", historia.ecografia.imagen, [["nombre", "Nombre del archivo"], ["tipo", "Tipo de archivo"], ["tamano", "Tamaño (bytes)"]]),
  ];
  return [];
}
