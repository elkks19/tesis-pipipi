import {
  addPdfRect,
  addPdfImage,
  addPdfTableRow,
  addCenteredPdfText,
  wrapPdfTextToWidth,
  addPdfBorder,
  addInstitutionalHeader,
  addPdfText,
  buildSimplePdf,
  createSimplePdfPage,
  type SimplePdfPage,
} from "@/lib/reports/simple-pdf";
import type { Historia, Paciente, Receta, DispensacionReceta } from "@/lib/schema";

const MARGIN = 42;
const CONTENT_WIDTH = 511;
const CONTENT_TOP = 656;
const CONTENT_BOTTOM = 66;
const MUTED_COLOR = "0.3 0.3 0.3";
const SECTION_TONES = [{ accent: "0 0 0", background: "0.83 0.83 0.83" }] as const;

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
  userNames?: Record<string, string>;
  deliveries?: DispensacionReceta[];
  ultrasoundImage?: import("./simple-pdf").PdfImage;
  ultrasoundImageError?: string;
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

  const rawValue = valueToFormat instanceof Date ? valueToFormat.toISOString() : String(valueToFormat);
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
        `Documento: ${responsable.datosPersonales.documentoIdentidad} ${responsable.datosPersonales.numeroDocumentoIdentidad}`,
        `Nacimiento: ${formatCalendarDate(responsable.datosPersonales.fechaNacimiento)}`,
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
            ? `Diagnóstico: ${formatCalendarDate(antecedente.fechaDiagnostico)}`
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
      field("Fecha de última gestación", formatCalendarDate(gineco.fechaUltimaGestacion)),
      field("Fecha de último parto", formatCalendarDate(gineco.fechaUltimoParto)),
      field("Fecha de último aborto", formatCalendarDate(gineco.fechaUltimoAborto)),
      field("Fecha de última cesárea", formatCalendarDate(gineco.fechaUltimaCesarea)),
      field("Edad de menopausia", gineco.edadMenopausia, "años"),
      field("Terapia anticonceptiva", gineco.terapiaAnticonceptiva),
      field("Método anticonceptivo", gineco.metodoAnticonceptivo),
      field("Inicio de vida sexual", gineco.inicioVidaSexual, "años"),
      field("Número de parejas sexuales", gineco.numeroParejasSexuales),
      field("Cirugía pelviana", gineco.cirugiaPelviana),
      field("Fecha de Papanicolaou", formatCalendarDate(gineco.fechaPapanicolau)),
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
      field("Observaciones", (estudio.observaciones ?? []).join(", ")),
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
      ...(estudio.imagen ? [field("Formato de imagen", estudio.imagen.tipo), field("Tamaño del archivo", estudio.imagen.tamano, "bytes")] : []),
      field("Dimensiones del hígado", estudio.higado.dimensiones, "cm"),
      field("Hepatomegalia", estudio.higado.hepatomegalia),
      field("Parénquima hepático", estudio.higado.parenquima),
      field("Diagnóstico hepático", estudio.higado.diagnostico),
      field("Paredes de vesícula biliar", estudio.vesiculaBiliar.paredes),
      field("Contenido anecoico", estudio.vesiculaBiliar.contenidoAnecoico),
      field("Barro biliar", estudio.vesiculaBiliar.barroBiliar),
      field("Cálculos", estudio.vesiculaBiliar.calculos),
      field("Diagnóstico de vesícula", estudio.vesiculaBiliar.diagnostico),
      field("Longitud renal derecha", estudio.riñones.derecho.longitud, "cm"),
      field("Parénquima renal derecho", estudio.riñones.derecho.parenquima, "cm"),
      field("Longitud renal izquierda", estudio.riñones.izquierdo.longitud, "cm"),
      field("Parénquima renal izquierdo", estudio.riñones.izquierdo.parenquima, "cm"),
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
      ...(diagnostico.secundarios ?? []).map((item, index) =>
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
      field("Fecha de prescripción", formatDate(receta.createdAt, true)),
      field("Última actualización de receta", formatDate(receta.updatedAt, true)),
      field("Prescrita por", authorName(data, receta.createdBy)),
      field("Receta actualizada por", authorName(data, receta.updatedBy)),
      field("Entrega completada", receta.entregada),
      field("Fecha de entrega completa", formatDate(receta.entregadaAt, true)),
      field("Entrega completada por", authorName(data, receta.entregadaBy)),
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
      ...(data.deliveries ?? []).flatMap((delivery, index) => [
        field(`Entrega ${index + 1}`, `${formatDate(delivery.createdAt, true)} | Entregado por: ${authorName(data, delivery.createdBy)}`),
        ...delivery.lineas.map((line) => {
          const medicine = receta.medicamentos[line.recetaMedicamentoIndex];
          return field(`Entrega ${index + 1}: ${medicine?.nombre ?? "Medicamento sin referencia"}`, `${line.cantidad} ${medicine?.unidad ?? "unidades"}`);
        }),
      ]),
    ],
  };
}

function authorName(data: HistoriaClinicalPdfData, id?: string) {
  return id ? data.userNames?.[id] ?? "Usuario no disponible" : "Sin responsable registrado";
}

function withStationAuthors(data: HistoriaClinicalPdfData, section: PdfSection | null, station: { created_by?: string; updated_by?: string } | undefined) {
  if (!section || !station) return section;
  return { ...section, fields: [field("Registrado por", authorName(data, station.created_by)), field("Última edición por", authorName(data, station.updated_by)), ...section.fields] };
}

function buildSections(data: HistoriaClinicalPdfData) {
  return [
    buildPacienteSection(data),
    buildHistoriaSection(data),
    withStationAuthors(data, buildAnamnesisSection(data.historia), data.historia.anamnesis),
    withStationAuthors(data, buildGeneralExamSection(data.historia), data.historia.examenFisicoGeneral),
    withStationAuthors(data, buildSegmentalExamSection(data.historia), data.historia.examenFisicoSegmentario),
    withStationAuthors(data, buildElectrocardiogramSection(data.historia), data.historia.electrocardiograma),
    withStationAuthors(data, buildSpirometrySection(data.historia), data.historia.espirometria),
    withStationAuthors(data, buildUltrasoundSection(data.historia), data.historia.ecografia),
    withStationAuthors(data, buildLaboratorySection(data.historia), data.historia.laboratorios),
    withStationAuthors(data, buildDiagnosisSection(data.historia), data.historia.diagnostico),
    buildPrescriptionSection(data),
  ].filter((section): section is PdfSection => Boolean(section));
}

class ClinicalPdfWriter {
  private currentPage: SimplePdfPage;
  private cursorY = CONTENT_TOP;
  private readonly pages: SimplePdfPage[] = [];
  private sectionIndex = 0;
  private currentTone: (typeof SECTION_TONES)[number] = SECTION_TONES[0];

  constructor(private readonly data: HistoriaClinicalPdfData, private readonly reportTitle = "HISTORIA CLÍNICA", private readonly registeredBy?: string, private readonly period?: string, private readonly responsibleLabel = "Responsable en la estación") {
    this.currentPage = this.startPage();
  }

  addSection(section: PdfSection) {
    if (this.sectionIndex > 0) this.cursorY -= 30;
    this.currentTone = SECTION_TONES[this.sectionIndex % SECTION_TONES.length];
    this.sectionIndex += 1;
    this.ensureSpace(80);
    this.addSectionHeading(section.title);

    for (const sectionField of section.fields) {
      this.addField(section.title, sectionField);
    }
    if (section.title === "Ecografía") {
      const image = this.data.ultrasoundImage;
      if (image) {
        const scale = Math.min(CONTENT_WIDTH / image.width, 330 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        this.ensureSpace(height + 20, section.title);
        this.cursorY -= height + 10;
        addPdfImage(this.currentPage, image, MARGIN + (CONTENT_WIDTH - width) / 2, this.cursorY, width, height);
      } else if (this.data.ultrasoundImageError) {
        this.addField(section.title, field("Imagen del estudio", this.data.ultrasoundImageError));
      }
    }
  }

  finish() {
    return buildSimplePdf(this.pages);
  }

  getPages() {
    return this.pages;
  }

  private startPage() {
    const page = createSimplePdfPage();
    const patientName = getPacienteName(this.data.paciente);
    const document = this.data.paciente
      ? `${this.data.paciente.datosPersonales.documentoIdentidad} ${this.data.paciente.datosPersonales.numeroDocumentoIdentidad}`
      : this.data.historia.pacienteId;

    this.pages.push(page);
    let y = addInstitutionalHeader(page, this.reportTitle) - 6;
    for (const text of [
      `Generado en: ${formatDate(this.data.generatedAt, true)}`,
      `Solicitado por: ${this.data.generatedBy}`,
      `Paciente: ${patientName} | ${document}`,
      `Fecha de atenci\u00f3n: ${formatDate(this.data.historia.createdAt, true)}`,
      ...(this.registeredBy ? [`${this.responsibleLabel}: ${this.registeredBy}`] : []),
      ...(this.period ? [`Período seleccionado: ${this.period}`] : []),
    ]) {
      for (const line of wrapPdfTextToWidth(text, CONTENT_WIDTH, 9)) {
        addPdfText(page, line, MARGIN, y, 9, MUTED_COLOR);
        y -= 13;
      }
    }
    this.cursorY = y - 22;
    return page;
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
    addPdfBorder(this.currentPage, MARGIN, this.cursorY - 6, CONTENT_WIDTH, 24);
    addCenteredPdfText(this.currentPage, title, this.cursorY + 2, 11, "bold");
    this.cursorY -= 6;
  }

  private addField(sectionTitle: string, sectionField: PdfField) {
    const widths = [155, CONTENT_WIDTH - 155];
    const labels = wrapPdfTextToWidth(sectionField.label, widths[0] - 14, 9, "bold");
    const values = wrapPdfTextToWidth(sectionField.value, widths[1] - 14, 9);
    let offset = 0;
    const lineCount = Math.max(labels.length, values.length);
    // Keep normal rows together; split only rows taller than an entire page.
    const fullHeight = lineCount * 12 + 12;
    if (fullHeight <= 540) this.ensureSpace(fullHeight, sectionTitle);
    while (offset < lineCount) {
      this.ensureSpace(36, sectionTitle);
      const capacity = Math.max(1, Math.floor((this.cursorY - CONTENT_BOTTOM - 12) / 12));
      const count = Math.min(capacity, lineCount - offset);
      const rowLabels = labels.slice(offset, offset + count);
      if (offset > 0 && rowLabels.length === 0) rowLabels.push("(continuaci\u00f3n)");
      this.cursorY = addPdfTableRow(this.currentPage, [rowLabels, values.slice(offset, offset + count)], widths, this.cursorY, { labelColumn: true });
      offset += count;
      if (offset < lineCount) {
        this.currentPage = this.startPage();
        this.addSectionHeading(`${sectionTitle} (continuaci\u00f3n)`);
      }
    }
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

/** Only patient identity and the selected station are included in this export. */
function stationClinicalPages(data: HistoriaClinicalPdfData, stationKey: import("@/lib/station-histories").StationKey, label: string, registeredBy: string, period?: string) {
  const sections = {
    anamnesis: () => buildAnamnesisSection(data.historia),
    examenFisicoGeneral: () => buildGeneralExamSection(data.historia),
    examenFisicoSegmentario: () => buildSegmentalExamSection(data.historia),
    electrocardiograma: () => buildElectrocardiogramSection(data.historia),
    espirometria: () => buildSpirometrySection(data.historia),
    ecografia: () => buildUltrasoundSection(data.historia),
    laboratorios: () => buildLaboratorySection(data.historia),
    diagnostico: () => buildDiagnosisSection(data.historia),
    farmacia: () => buildPrescriptionSection(data),
  };
  const writer = new ClinicalPdfWriter(data, `Reporte de ${label}`, registeredBy, period);
  writer.addSection(buildPacienteSection(data));
  const station = stationKey === "farmacia" ? undefined : data.historia[stationKey];
  const section = withStationAuthors(data, sections[stationKey](), station);
  writer.addSection(section ?? { title: label, fields: [{ label: "Estado", value: "Pendiente de registro en esta estación" }] });
  return writer.getPages();
}

export function renderStationClinicalPdf(data: HistoriaClinicalPdfData, stationKey: import("@/lib/station-histories").StationKey, label: string, registeredBy: string, period?: string) {
  return buildSimplePdf(stationClinicalPages(data, stationKey, label, registeredBy, period));
}

export function renderPatientStationClinicalPdf(entries: { data: HistoriaClinicalPdfData; registeredBy: string }[], stationKey: import("@/lib/station-histories").StationKey, label: string, period: string, complete = false) {
  // Each visit starts on a new page; the final document has continuous numbering.
  const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.MAX_SAFE_INTEGER;
  const sorted = [...entries].sort((a, b) => timestamp(a.data.historia.createdAt) - timestamp(b.data.historia.createdAt));
  return buildSimplePdf(sorted.flatMap(({ data, registeredBy }) => {
    if (!complete) return stationClinicalPages(data, stationKey, label, registeredBy, period);
    const writer = new ClinicalPdfWriter(data, "Historial clínico completo", registeredBy, period, "Historia registrada por");
    buildSections(data).forEach((section) => writer.addSection(section));
    return writer.getPages();
  }));
}
