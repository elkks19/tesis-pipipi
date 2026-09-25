import {
  addPdfRect,
  addPdfText,
  buildSimplePdf,
  createSimplePdfPage,
  wrapPdfText,
  type SimplePdfPage,
} from "@/lib/reports/simple-pdf";
import type { Historia, Paciente, Receta } from "@/lib/schema";

const MARGIN = 42;
const CONTENT_WIDTH = 511;
const PAGE_TOP = 792;
const CONTENT_TOP = 712;
const CONTENT_BOTTOM = 66;
const TEXT_COLOR = "0.09 0.11 0.14";
const MUTED_COLOR = "0.42 0.47 0.52";
const PRIMARY_COLOR = "0.10 0.38 0.58";
const DEEP_BLUE_COLOR = "0.06 0.20 0.31";
const TEAL_COLOR = "0.08 0.55 0.52";
const GREEN_COLOR = "0.20 0.60 0.40";
const ORANGE_COLOR = "0.93 0.48 0.16";
const WHITE_COLOR = "1 1 1";
const SOFT_COLOR = "0.90 0.94 0.96";
const SOFT_TEAL_COLOR = "0.89 0.96 0.95";
const SOFT_GREEN_COLOR = "0.91 0.96 0.92";
const SOFT_ORANGE_COLOR = "0.99 0.94 0.88";
const SECTION_TONES = [
  { accent: PRIMARY_COLOR, background: SOFT_COLOR },
  { accent: TEAL_COLOR, background: SOFT_TEAL_COLOR },
  { accent: GREEN_COLOR, background: SOFT_GREEN_COLOR },
  { accent: ORANGE_COLOR, background: SOFT_ORANGE_COLOR },
] as const;

export type HistoriaDocument = Historia & {
  _id: string;
};

export type PacienteDocument = Paciente & {
  _id?: string;
};

export type RecetaDocument = Receta & {
  _id?: string;
};

export type HistoriaClinicalPdfData = {
  generatedAt: string;
  generatedBy: string;
  historia: HistoriaDocument;
  paciente: PacienteDocument | null;
  receta: RecetaDocument | null;
};

type PdfField = {
  label: string;
  value: string;
};

type PdfSection = {
  fields: PdfField[];
  title: string;
};

function value(value: unknown, fallback = "Sin registro") {
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function formatDate(valueToFormat: unknown, includeTime = false) {
  if (!valueToFormat) {
    return "Sin registro";
  }

  const date = new Date(String(valueToFormat));

  if (Number.isNaN(date.getTime())) {
    return value(valueToFormat);
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/La_Paz",
  }).format(date);
}

function formatCalendarDate(valueToFormat: unknown) {
  if (!valueToFormat) {
    return "Sin registro";
  }

  const rawValue = String(valueToFormat);
  const calendarDate = /^\d{4}-\d{2}-\d{2}/.exec(rawValue)?.[0];

  if (!calendarDate) {
    return formatDate(valueToFormat);
  }

  return formatDate(`${calendarDate}T12:00:00Z`);
}

function safeFilePart(valueToFormat: string) {
  return valueToFormat
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getPacienteName(paciente: PacienteDocument | null) {
  if (!paciente) {
    return "Paciente sin datos de identidad";
  }

  return [
    paciente.datosPersonales.nombres,
    paciente.datosPersonales.apellidoPaterno,
    paciente.datosPersonales.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatCie(item: unknown) {
  if (!item || typeof item !== "object") {
    return "Sin registro";
  }

  const cie = item as { code?: string; iNo?: string; title?: string };

  return [cie.title, cie.code, cie.iNo].filter(Boolean).join(" - ") || "Sin registro";
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(" | ");
}

function field(label: string, fieldValue: unknown, suffix?: string): PdfField {
  const formatted = value(fieldValue);

  return {
    label,
    value: suffix && formatted !== "Sin registro" ? `${formatted} ${suffix}` : formatted,
  };
}

function buildPacienteSection(data: HistoriaClinicalPdfData): PdfSection {
  const paciente = data.paciente;
  const datos = paciente?.datosPersonales;
  const lugar = paciente
    ? [
        paciente.lugarNacimiento.distrito,
        paciente.lugarNacimiento.departamento,
        paciente.lugarNacimiento.pais,
      ]
        .filter(Boolean)
        .join(", ")
    : "Sin registro";
  const responsables = paciente?.padres?.map((responsable, index) => {
    const nombre = [
      responsable.datosPersonales.nombres,
      responsable.datosPersonales.apellidoPaterno,
      responsable.datosPersonales.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ");

    return field(
      `Responsable ${index + 1}`,
      joinParts([
        nombre,
        responsable.relacion,
        responsable.numeroContacto,
        responsable.asumeSustento ? "Asume sustento" : "No asume sustento",
      ]),
    );
  }) ?? [];

  return {
    title: "Datos del paciente",
    fields: [
      field("Nombre completo", getPacienteName(paciente)),
      field(
        "Documento",
        datos
          ? `${datos.documentoIdentidad} ${datos.numeroDocumentoIdentidad}`
          : undefined,
      ),
      field("Fecha de nacimiento", formatCalendarDate(datos?.fechaNacimiento)),
      field("Género", paciente?.genero),
      field("Nacionalidad", paciente?.nacionalidad),
      field("Etnia", paciente?.etnia),
      field("Lugar de nacimiento", lugar),
      field("Fecha de registro", formatDate(paciente?.createdAt, true)),
      field("Última actualización del paciente", formatDate(paciente?.updatedAt, true)),
      ...responsables,
    ],
  };
}

function buildHistoriaSection(data: HistoriaClinicalPdfData): PdfSection {
  const complementaryLabels: Record<string, string> = {
    ecografia: "Ecografía",
    electrocardiograma: "Electrocardiograma",
    espirometria: "Espirometría",
    laboratorios: "Laboratorios",
  };
  const requestedStudies = Object.entries(
    data.historia.examenesComplementariosSolicitados ?? {},
  )
    .filter(([, requested]) => requested)
    .map(([key]) => complementaryLabels[key] ?? key)
    .join(", ");

  return {
    title: "Identificación de la historia",
    fields: [
      field("Historia", data.historia._id),
      field("Fecha de atención", formatDate(data.historia.createdAt, true)),
      field("Última actualización", formatDate(data.historia.updatedAt, true)),
      field("Viaje o campaña", data.historia.viajeId),
      field("Estudios complementarios solicitados", requestedStudies),
    ],
  };
}

function buildAnamnesisSection(historia: HistoriaDocument): PdfSection | null {
  const anamnesis = historia.anamnesis;

  if (!anamnesis) {
    return null;
  }

  const personales = anamnesis.antecedentesPatologicos?.personales ?? [];
  const familiares = anamnesis.antecedentesPatologicos?.familiares ?? [];
  const gineco = anamnesis.antecedentesGinecoObstetricos;
  const noPatologicos = anamnesis.antecedentesNoPatologicos;
  const fields: PdfField[] = [
    field("Motivo de consulta", anamnesis.motivoConsulta),
    field("Historia de la enfermedad actual", anamnesis.historiaEnfermedadActual),
    field("Estado civil", anamnesis.estadoCivil),
    field("Nivel educativo", anamnesis.nivelEducativo),
    field("Años cursados", anamnesis.añosCursados),
    field("Situación laboral", anamnesis.situacionLaboral),
    field("Hábito tabáquico", noPatologicos?.habitoTabaquico),
    field("Consumo de alcohol", noPatologicos?.consumoAlcohol),
    field("Actividad física", noPatologicos?.realizaActividadFisica),
    field("Consumo de frutas y verduras", noPatologicos?.consumoFrutasVerduras),
    ...personales.map((antecedente, index) =>
      field(
        `Antecedente personal ${index + 1}`,
        joinParts([
          formatCie(antecedente.enfermedad),
          antecedente.fechaDiagnostico
            ? `Diagnóstico: ${formatDate(antecedente.fechaDiagnostico)}`
            : undefined,
          antecedente.tratamiento
            ? `Tratamiento: ${antecedente.tratamiento}`
            : undefined,
        ]),
      ),
    ),
    ...familiares.map((antecedente, index) =>
      field(
        `Antecedente familiar ${index + 1}`,
        joinParts([
          antecedente.parentesco,
          formatCie(antecedente.enfermedad),
          `Edad de diagnóstico: ${antecedente.edadDiagnostico}`,
          antecedente.fallecimiento ? "Fallecido" : "No fallecido",
          antecedente.edadFallecimiento !== undefined
            ? `Edad de fallecimiento: ${antecedente.edadFallecimiento}`
            : undefined,
        ]),
      ),
    ),
  ];

  if (gineco) {
    fields.push(
      field("Estadio de Tanner", gineco.estadioTanner),
      field("Menarca", gineco.menarca, "años"),
      field("Ritmo menstrual", gineco.ritmoMenstrual),
      field("Gestaciones", gineco.gestaciones),
      field("Partos", gineco.partos),
      field("Abortos", gineco.abortos),
      field("Cesáreas", gineco.cesareas),
      field("Fecha de última gestación", formatDate(gineco.fechaUltimaGestacion)),
      field("Fecha de último parto", formatDate(gineco.fechaUltimoParto)),
      field("Fecha de último aborto", formatDate(gineco.fechaUltimoAborto)),
      field("Fecha de última cesárea", formatDate(gineco.fechaUltimaCesarea)),
      field("Edad de menopausia", gineco.edadMenopausia, "años"),
      field("Terapia anticonceptiva", gineco.terapiaAnticonceptiva),
      field("Método anticonceptivo", gineco.metodoAnticonceptivo),
      field("Inicio de vida sexual", gineco.inicioVidaSexual, "años"),
      field("Número de parejas sexuales", gineco.numeroParejasSexuales),
      field("Cirugía pelviana", gineco.cirugiaPelviana),
      field("Fecha de Papanicolaou", formatDate(gineco.fechaPapanicolau)),
      field("Resultado de Papanicolaou", gineco.resultadoPapanicolau),
      field("Colposcopia", gineco.colposcopia),
      field("Biopsia cervical", gineco.biopsiaCervical),
    );
  }

  return { fields, title: "Anamnesis" };
}

function buildGeneralExamSection(historia: HistoriaDocument): PdfSection | null {
  const examen = historia.examenFisicoGeneral;

  if (!examen) {
    return null;
  }

  return {
    title: "Examen físico general",
    fields: [
      field(
        "Presión arterial derecha",
        `${examen.presionArterial.derecha.max}/${examen.presionArterial.derecha.min}`,
        "mmHg",
      ),
      field(
        "Presión arterial izquierda",
        `${examen.presionArterial.izquierda.max}/${examen.presionArterial.izquierda.min}`,
        "mmHg",
      ),
      field("Presión arterial media", examen.presionArterialMedia, "mmHg"),
      field("Pulsos", examen.pulsos, "lpm"),
      field("Frecuencia respiratoria", examen.frecuenciaRespiratoria, "rpm"),
      field("Frecuencia cardíaca", examen.frecuenciaCardiaca, "lpm"),
      field("Temperatura axilar", examen.temperaturaAxilar, "°C"),
      field("Peso", examen.peso, "kg"),
      field("Talla", examen.talla, "cm"),
      field("Índice de masa corporal", examen.imc),
      field("Diagnóstico IMC", examen.diagnosticoIMC),
      field("Perímetro de cintura", examen.perimetroCintura, "cm"),
      field("Perímetro de cadera", examen.perimetroCadera, "cm"),
      field("Índice cintura/cadera", examen.indiceCinturaCadera),
    ],
  };
}

function buildSegmentalExamSection(historia: HistoriaDocument): PdfSection | null {
  const examen = historia.examenFisicoSegmentario;

  if (!examen) {
    return null;
  }

  return {
    title: "Examen físico segmentario",
    fields: [
      field("Cabeza", examen.cabeza),
      field("Cuello", examen.cuello),
      field("Aparato respiratorio", examen.aparatoRespiratorio),
      field("Aparato cardiovascular", examen.aparatoCardiovascular),
      field("Abdomen y pelvis", examen.abdomenPelvis),
      field("Aparato genitourinario", examen.aparatoGenitourinario),
      field("Piel y faneras", examen.pielFaneras),
      field("Sistema hemolinfopoyético", examen.sistemaHemolinfopoyetico),
      field("Aparato osteoartromuscular", examen.aparatoOsteoartromuscular),
      field("Sistema nervioso central", examen.sistemaNerviosoCentral),
    ],
  };
}

function buildElectrocardiogramSection(historia: HistoriaDocument): PdfSection | null {
  const estudio = historia.electrocardiograma;

  if (!estudio) {
    return null;
  }

  return {
    title: "Electrocardiograma",
    fields: [
      field("Ritmo", estudio.ritmo),
      field("Frecuencia cardíaca", estudio.frecuenciaCardiaca, "lpm"),
      field("Crecimiento de aurícula derecha", estudio.crecimientoAuriculaDerecha),
      field("Crecimiento de aurícula izquierda", estudio.crecimientoAuriculaIzquierda),
      field("Crecimiento de ventrículo derecho", estudio.crecimientoVentriculoDerecho),
      field("Crecimiento de ventrículo izquierdo", estudio.crecimientoVentriculoIzquierdo),
      field("Intervalo PR", estudio.intervaloPR, "ms"),
      field("Intervalo QTc", estudio.intervaloQTc, "ms"),
      field("Desnivel ST", estudio.supraInfraDesnivelST),
      field("Derivación del desnivel ST", estudio.derivacionSupraInfraDesnivelST),
      field("Duración de onda P", estudio.duracionOndaP, "ms"),
      field("Duración del complejo QRS", estudio.duracionComplejoQRS, "ms"),
      field("Duración de onda T", estudio.duracionOndaT, "ms"),
      field("Extrasístole supraventricular", estudio.extrasistoleSupraventricular),
      field("Extrasístole intraventricular", estudio.extrasistoleIntraventricular),
      field("Diagnóstico electrocardiográfico", estudio.diagnostico),
    ],
  };
}

function buildSpirometrySection(historia: HistoriaDocument): PdfSection | null {
  const estudio = historia.espirometria;

  if (!estudio) {
    return null;
  }

  return {
    title: "Espirometría",
    fields: [
      field("FEV1", estudio.FEV1, "L"),
      field("FEV1 teórico", estudio.porcentajeFEVteorico, "%"),
      field("FVC", estudio.FVC, "L"),
      field("FVC teórico", estudio.porcentajeFVCteorico, "%"),
      field("FEV1/FVC", estudio.FEV1FVC, "%"),
      field("FEV1/FVC teórico", estudio.porcentajeFEV1FVCteorico, "%"),
      field("Flujo espiratorio pico PEF", estudio.flujoEspiratorioPicoPEF),
      field("PEF teórico", estudio.porcentajePEFteorico, "%"),
      field("Fuente de datos teóricos", estudio.fuenteDatosTeoricos),
      field("Observaciones", estudio.observaciones.join(", ")),
      field("Diagnóstico espirométrico", estudio.diagnostico),
    ],
  };
}

function buildUltrasoundSection(historia: HistoriaDocument): PdfSection | null {
  const estudio = historia.ecografia;

  if (!estudio) {
    return null;
  }

  return {
    title: "Ecografía",
    fields: [
      field("Imagen adjunta", estudio.imagen?.nombre),
      field("Dimensiones del hígado", estudio.higado.dimensiones),
      field("Hepatomegalia", estudio.higado.hepatomegalia),
      field("Parénquima hepático", estudio.higado.parenquima),
      field("Diagnóstico hepático", estudio.higado.diagnostico),
      field("Paredes de vesícula biliar", estudio.vesiculaBiliar.paredes),
      field("Contenido anecoico", estudio.vesiculaBiliar.contenidoAnecoico),
      field("Barro biliar", estudio.vesiculaBiliar.barroBiliar),
      field("Cálculos", estudio.vesiculaBiliar.calculos),
      field("Diagnóstico de vesícula", estudio.vesiculaBiliar.diagnostico),
      field("Longitud renal derecha", estudio.riñones.derecho.longitud),
      field("Parénquima renal derecho", estudio.riñones.derecho.parenquima),
      field("Longitud renal izquierda", estudio.riñones.izquierdo.longitud),
      field("Parénquima renal izquierdo", estudio.riñones.izquierdo.parenquima),
      field("Ecogenicidad renal", estudio.riñones.ecogenicidad),
      field("Relación córtico-medular", estudio.riñones.relacionCorticoMedular),
      field("Diagnóstico renal", estudio.riñones.diagnostico),
    ],
  };
}

function buildLaboratorySection(historia: HistoriaDocument): PdfSection | null {
  const estudios = historia.laboratorios;

  if (!estudios) {
    return null;
  }

  return {
    title: "Laboratorios",
    fields: [
      field("Glicemia capilar", estudios.glicemiaCapilar),
      field("Grupo sanguíneo", estudios.grupoSanguineo),
      ...(estudios.otrosEstudios ?? []).map((estudio, index) =>
        field(`Estudio adicional ${index + 1}: ${estudio.nombre}`, estudio.resultado),
      ),
    ],
  };
}

function buildDiagnosisSection(historia: HistoriaDocument): PdfSection | null {
  const diagnostico = historia.diagnostico;

  if (!diagnostico) {
    return null;
  }

  return {
    title: "Diagnóstico y plan",
    fields: [
      field("Diagnóstico principal", formatCie(diagnostico.principal)),
      ...diagnostico.secundarios.map((item, index) =>
        field(`Diagnóstico secundario ${index + 1}`, formatCie(item)),
      ),
      field("Plan de trabajo", diagnostico.planTrabajo),
    ],
  };
}

function buildPrescriptionSection(data: HistoriaClinicalPdfData): PdfSection | null {
  const receta = data.receta ?? data.historia.receta ?? null;

  if (!receta) {
    return null;
  }

  return {
    title: "Receta médica",
    fields: [
      field("Indicaciones generales", receta.indicacionesGenerales),
      ...receta.medicamentos.map((medicamento, index) =>
        field(
          `Medicamento ${index + 1}: ${medicamento.nombre}`,
          joinParts([
            medicamento.principioActivo,
            medicamento.concentracion,
            medicamento.formaFarmaceutica,
            `Dosis: ${medicamento.dosis}`,
            `Frecuencia: ${medicamento.frecuencia}`,
            `Duración: ${medicamento.duracion}`,
            medicamento.viaAdministracion
              ? `Vía: ${medicamento.viaAdministracion}`
              : undefined,
            medicamento.cantidad !== undefined
              ? `Cantidad: ${medicamento.cantidad} ${medicamento.unidad ?? ""}`.trim()
              : undefined,
            medicamento.indicaciones
              ? `Indicaciones: ${medicamento.indicaciones}`
              : undefined,
          ]),
        ),
      ),
    ],
  };
}

function buildSections(data: HistoriaClinicalPdfData) {
  return [
    buildPacienteSection(data),
    buildHistoriaSection(data),
    buildAnamnesisSection(data.historia),
    buildGeneralExamSection(data.historia),
    buildSegmentalExamSection(data.historia),
    buildElectrocardiogramSection(data.historia),
    buildSpirometrySection(data.historia),
    buildUltrasoundSection(data.historia),
    buildLaboratorySection(data.historia),
    buildDiagnosisSection(data.historia),
    buildPrescriptionSection(data),
  ].filter((section): section is PdfSection => Boolean(section));
}

class ClinicalPdfWriter {
  private currentPage: SimplePdfPage;
  private cursorY = CONTENT_TOP;
  private readonly pages: SimplePdfPage[] = [];
  private sectionIndex = 0;
  private currentTone: (typeof SECTION_TONES)[number] = SECTION_TONES[0];

  constructor(private readonly data: HistoriaClinicalPdfData) {
    this.currentPage = this.startPage(true);
  }

  addSection(section: PdfSection) {
    this.currentTone = SECTION_TONES[this.sectionIndex % SECTION_TONES.length];
    this.sectionIndex += 1;
    this.ensureSpace(46);
    this.addSectionHeading(section.title);

    for (const sectionField of section.fields) {
      this.addField(section.title, sectionField);
    }
  }

  finish() {
    this.pages.forEach((page, index) => {
      addPdfRect(page, MARGIN, 48, CONTENT_WIDTH, 1, TEAL_COLOR);
      addPdfText(
        page,
        `Generado: ${formatDate(this.data.generatedAt, true)} por ${this.data.generatedBy}`,
        MARGIN,
        32,
        7,
        MUTED_COLOR,
      );
      addPdfRect(page, 482, 20, 71, 22, DEEP_BLUE_COLOR);
      addPdfText(page, `Página ${index + 1} de ${this.pages.length}`, 494, 28, 7, WHITE_COLOR, "bold");
    });

    return buildSimplePdf(this.pages);
  }

  private startPage(isFirstPage = false) {
    const page = createSimplePdfPage();
    const patientName = getPacienteName(this.data.paciente);
    const document = this.data.paciente
      ? `${this.data.paciente.datosPersonales.documentoIdentidad} ${this.data.paciente.datosPersonales.numeroDocumentoIdentidad}`
      : this.data.historia.pacienteId;

    this.pages.push(page);
    addPdfRect(page, 0, 730, 595, 112, DEEP_BLUE_COLOR);
    addPdfRect(page, 0, 730, 595, 5, TEAL_COLOR);
    addPdfText(page, "HISTORIA CLÍNICA", MARGIN, PAGE_TOP + 10, 8, SOFT_TEAL_COLOR, "bold");
    addPdfText(page, patientName.slice(0, 60), MARGIN, PAGE_TOP - 10, 18, WHITE_COLOR, "bold");
    addPdfText(page, document, MARGIN, PAGE_TOP - 31, 9, SOFT_COLOR);
    addPdfText(page, "ATENCIÓN", 403, PAGE_TOP + 10, 7, SOFT_TEAL_COLOR, "bold");
    addPdfText(
      page,
      formatDate(this.data.historia.createdAt, true),
      403,
      PAGE_TOP - 8,
      8,
      WHITE_COLOR,
      "bold",
    );

    if (isFirstPage) {
      this.addOverview(page);
      this.cursorY = 628;
    } else {
      this.cursorY = CONTENT_TOP;
    }

    return page;
  }

  private addOverview(page: SimplePdfPage) {
    const diagnosis = value(
      this.data.historia.diagnostico?.principal?.title,
      "Sin diagnóstico",
    );
    const clinicalSections = Math.max(buildSections(this.data).length - 2, 0);
    const cards = [
      {
        accent: PRIMARY_COLOR,
        background: SOFT_COLOR,
        label: "FECHA DE ATENCIÓN",
        value: formatDate(this.data.historia.createdAt),
      },
      {
        accent: TEAL_COLOR,
        background: SOFT_TEAL_COLOR,
        label: "DIAGNÓSTICO PRINCIPAL",
        value: diagnosis,
      },
      {
        accent: ORANGE_COLOR,
        background: SOFT_ORANGE_COLOR,
        label: "SECCIONES CON DATOS",
        value: `${clinicalSections} bloques clínicos`,
      },
    ];

    cards.forEach((card, index) => {
      const x = MARGIN + index * 174;

      addPdfRect(page, x, 650, 163, 58, card.background);
      addPdfRect(page, x, 650, 4, 58, card.accent);
      addPdfText(page, card.label, x + 13, 690, 7, card.accent, "bold");
      addPdfText(page, card.value.slice(0, 27), x + 13, 669, 9, TEXT_COLOR, "bold");
    });
  }

  private addSectionHeading(title: string) {
    addPdfRect(
      this.currentPage,
      MARGIN,
      this.cursorY - 6,
      CONTENT_WIDTH,
      24,
      this.currentTone.background,
    );
    addPdfRect(
      this.currentPage,
      MARGIN,
      this.cursorY - 6,
      5,
      24,
      this.currentTone.accent,
    );
    addPdfText(
      this.currentPage,
      title,
      MARGIN + 14,
      this.cursorY + 2,
      11,
      this.currentTone.accent,
      "bold",
    );
    this.cursorY -= 34;
  }

  private addField(sectionTitle: string, sectionField: PdfField) {
    const lines = wrapPdfText(sectionField.value, 92);

    this.ensureSpace(38, sectionTitle);
    addPdfText(
      this.currentPage,
      sectionField.label,
      MARGIN + 9,
      this.cursorY,
      8,
      this.currentTone.accent,
      "bold",
    );
    this.cursorY -= 14;

    lines.forEach((line, index) => {
      if (this.cursorY < CONTENT_BOTTOM + 16) {
        this.currentPage = this.startPage();
        this.addSectionHeading(`${sectionTitle} (continuación)`);
        addPdfText(
          this.currentPage,
          `${sectionField.label} (continuación)`,
          MARGIN + 9,
          this.cursorY,
          8,
          this.currentTone.accent,
          "bold",
        );
        this.cursorY -= 14;
      }

      addPdfText(
        this.currentPage,
        line || " ",
        MARGIN + 9,
        this.cursorY,
        9,
        TEXT_COLOR,
      );
      this.cursorY -= 12;

      if (index === lines.length - 1) {
        this.cursorY -= 7;
      }
    });
  }

  private ensureSpace(requiredHeight: number, continuationTitle?: string) {
    if (this.cursorY - requiredHeight >= CONTENT_BOTTOM) {
      return;
    }

    this.currentPage = this.startPage();

    if (continuationTitle) {
      this.addSectionHeading(`${continuationTitle} (continuación)`);
    }
  }
}

export function getHistoriaClinicalPdfFileName(data: HistoriaClinicalPdfData) {
  const document = safeFilePart(
    data.paciente?.datosPersonales.numeroDocumentoIdentidad ?? "sin-documento",
  );
  const name = safeFilePart(getPacienteName(data.paciente)) || "paciente";
  const createdAt = data.historia.createdAt
    ? new Date(data.historia.createdAt)
    : null;
  const date = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toISOString().slice(0, 10)
    : "sin-fecha";

  return `historia-clinica-${document}-${name}-${date}.pdf`;
}

export function renderHistoriaClinicalPdf(data: HistoriaClinicalPdfData) {
  const writer = new ClinicalPdfWriter(data);

  buildSections(data).forEach((section) => writer.addSection(section));

  return writer.finish();
}
