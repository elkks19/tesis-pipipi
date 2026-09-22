import z from "zod"
import { ICDSchema, type Enfermedad } from "./enfermedades";

export const estadosCiviles = [
	"Soltero",
	"Casado",
	"Viudo",
	"Unión Libre",
	"Divorciado",
] as const;

export const nivelesEducativos = [
	"Sin educación formal",
	"Primaria concluida",
	"Secundaria concluida",
	"Licenciatura concluida",
	"Especialidad concluida",
	"Maestría concluida",
	"Doctorado concluido",
] as const;

export const habitosTabaco = [
	"Nunca fumo",
	"Anteriormente fumaba",
	"Fumador pasivo",
	"Fumador ligero (menos de 10 cigarrillos al día)",
	"Fumador moderado (entre 10 y 20 cigarrillos al día)",
	"Fumador pesado (más de 20 cigarrillos al día)",
	"Fumador ocasional (fuma solo en ocasiones sociales)",
] as const;

export const consumosAlcohol = [
	"No consume alcohol",
	"Consumo de bajo riesgo (hasta 1 botella de cerveza)",
	"Consumo de riesgo (mas de 2 botellas de cerveza)",
	"Consumo excesivo episodico (3 o mas botellas de cerveza en una ocasión)",
	"Consumo perjudicial (consumo que causa daño a la salud)",
	"Dependencia alcohólica",
	"Consumo compulsivo con perdida de control",
] as const;

export const porcionesFrutasVerduras = [
	"No consume",
	"1 - 2 porciones al día",
	"3 - 4 porciones al día",
	"5 o más porciones al día",
] as const;

export type Anamnesis = {
	estadoCivil: (typeof estadosCiviles)[number];
	nivelEducativo: (typeof nivelesEducativos)[number];
	añosCursados?: number;
	situacionLaboral?: string;
	motivoConsulta: string;
	historiaEnfermedadActual: string;

	antecedentesNoPatologicos: {
		habitoTabaquico: (typeof habitosTabaco)[number];
		consumoAlcohol: (typeof consumosAlcohol)[number];
		realizaActividadFisica: boolean;
		consumoFrutasVerduras: (typeof porcionesFrutasVerduras)[number];
	};

	antecedentesPatologicos: {
		personales: {
			enfermedad: Enfermedad;
			fechaDiagnostico?: Date;
			tratamiento?: string;
		}[];

		familiares: {
			parentesco: string;
			enfermedad: Enfermedad;
			edadDiagnostico: number;
			fallecimiento: boolean;
			edadFallecimiento?: number;
		}[];
	};

	antecedentesGinecoObstetricos?: {
		estadioTanner: string;
		menarca?: number;
		ritmoMenstrual?: string;

		gestaciones: number;
		partos: number;
		abortos: number;
		cesareas: number;

		fechaUltimaGestacion?: string;
		fechaUltimoParto?: string;
		fechaUltimoAborto?: string;
		fechaUltimaCesarea?: string;

		edadMenopausia?: number;
		terapiaAnticonceptiva: boolean;
		metodoAnticonceptivo?: string;
		inicioVidaSexual?: number;
		numeroParejasSexuales?: number;

		cirugiaPelviana?: string;
		fechaPapanicolau?: string;
		resultadoPapanicolau?: string;
		colposcopia?: string;
		biopsiaCervical?: string;
	};
};

const nonEmpty = (label: string, max = 255) => z.string().trim().min(1, `${label} es obligatorio.`).max(max, `${label} no puede superar ${max} caracteres.`);
const optionalText = (max = 1000) => z.string().trim().max(max).optional();
const age = z.int("Ingresa una edad entera.").min(0, "La edad no puede ser negativa.").max(125, "La edad no puede superar 125 años.");
const eventCount = z.int("Ingresa un número entero.").min(0, "No puede ser negativo.").max(50, "No puede superar 50.");

function validDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
}

const dateString = z.string().refine(validDate, "Ingresa una fecha válida que no sea futura.");
const personalDate = dateString.transform((value) => new Date(`${value}T00:00:00Z`));
const positiveAge = z.int("Ingresa una edad entera.").min(1, "La edad debe ser mayor que cero.");

const ginecoSchema = z.object({
	estadioTanner: z.enum(["1", "2", "3", "4", "5", "No evaluado"], "Selecciona una etapa de Tanner válida."),
	menarca: positiveAge.optional(),
	ritmoMenstrual: optionalText(),
	gestaciones: eventCount,
	partos: eventCount,
	abortos: eventCount,
	cesareas: eventCount,
	fechaUltimaGestacion: dateString.optional(),
	fechaUltimoParto: dateString.optional(),
	fechaUltimoAborto: dateString.optional(),
	fechaUltimaCesarea: dateString.optional(),
	edadMenopausia: positiveAge.optional(),
	terapiaAnticonceptiva: z.boolean(),
	metodoAnticonceptivo: optionalText(),
	inicioVidaSexual: positiveAge.optional(),
	numeroParejasSexuales: z.int("Ingresa un número entero.").min(0, "No puede ser negativo.").optional(),
	cirugiaPelviana: optionalText(),
	fechaPapanicolau: dateString.optional(),
	resultadoPapanicolau: optionalText(),
	colposcopia: optionalText(),
	biopsiaCervical: optionalText(),
}).superRefine((value, context) => {
	for (const field of ["partos", "abortos", "cesareas"] as const) {
		if (value[field] > value.gestaciones) context.addIssue({ code: "custom", path: [field], message: "No puede superar las gestaciones." });
	}
	for (const [dateField, countField] of [
		["fechaUltimoParto", "partos"],
		["fechaUltimoAborto", "abortos"],
		["fechaUltimaCesarea", "cesareas"],
	] as const) {
		if (value[dateField] && value[countField] === 0) context.addIssue({ code: "custom", path: [dateField], message: "Registra primero el evento correspondiente." });
	}
	if (value.fechaUltimaGestacion && value.gestaciones === 0) context.addIssue({ code: "custom", path: ["fechaUltimaGestacion"], message: "Registra primero una gestación." });
	if (value.terapiaAnticonceptiva && !value.metodoAnticonceptivo) context.addIssue({ code: "custom", path: ["metodoAnticonceptivo"], message: "Indica el método anticonceptivo." });
});

export const CreateAnamnesisSchema = z.object({
	pacienteId: nonEmpty("El paciente"),
	estadoCivil: z.enum(estadosCiviles, "Selecciona el estado civil."),
	nivelEducativo: z.enum(nivelesEducativos, "Selecciona el nivel educativo."),
	añosCursados: z.int("Ingresa un número entero.").min(0, "No puede ser negativo.").optional(),
	situacionLaboral: optionalText(),
	motivoConsulta: nonEmpty("El motivo de consulta", 500),
	historiaEnfermedadActual: nonEmpty("La historia de enfermedad actual", 10000),

	antecedentesNoPatologicos: z.object({
		habitoTabaquico: z.enum(habitosTabaco, "Selecciona el hábito tabáquico."),
		consumoAlcohol: z.enum(consumosAlcohol, "Selecciona el consumo de alcohol."),
		realizaActividadFisica: z.boolean(),
		consumoFrutasVerduras: z.enum(porcionesFrutasVerduras, "Selecciona el consumo de frutas y verduras."),
	}),

	antecedentesPatologicos: z.object({
		personales: z.array(
			z.object({
				enfermedad: ICDSchema.refine((value) => Boolean(value.iNo.trim() && value.title.trim()), "Selecciona una enfermedad CIE-11."),
				fechaDiagnostico: personalDate.optional(),
				tratamiento: optionalText(2000),
			})
		),
		familiares: z.array(
			z.object({
				parentesco: nonEmpty("El parentesco"),
				enfermedad: ICDSchema.refine((value) => Boolean(value.iNo.trim() && value.title.trim()), "Selecciona una enfermedad CIE-11."),
				edadDiagnostico: age,
				fallecimiento: z.boolean(),
				edadFallecimiento: age.optional(),
			}).superRefine((value, context) => {
				if (value.edadFallecimiento !== undefined && value.edadFallecimiento < value.edadDiagnostico) context.addIssue({ code: "custom", path: ["edadFallecimiento"], message: "No puede ser menor que la edad de diagnóstico." });
			})
		),
	}),

	antecedentesGinecoObstetricos: ginecoSchema.optional(),
});

export function getAnamnesisSchemaForPatient(fechaNacimiento: Date | string) {
	const birthDate = new Date(fechaNacimiento);
	const now = new Date();
	let patientAge = now.getUTCFullYear() - birthDate.getUTCFullYear();
	const birthdayThisYear = Date.UTC(now.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
	if (now.getTime() < birthdayThisYear) patientAge -= 1;
	return CreateAnamnesisSchema.superRefine((value, context) => {
		if (!Number.isNaN(birthDate.getTime())) {
			if (value.añosCursados !== undefined && value.añosCursados > patientAge) context.addIssue({ code: "custom", path: ["añosCursados"], message: "No puede superar la edad del paciente." });
			for (const field of ["menarca", "edadMenopausia", "inicioVidaSexual"] as const) {
				const ageValue = value.antecedentesGinecoObstetricos?.[field];
				if (ageValue !== undefined && ageValue > patientAge) context.addIssue({ code: "custom", path: ["antecedentesGinecoObstetricos", field], message: "No puede superar la edad del paciente." });
			}
			value.antecedentesPatologicos.personales.forEach((item, index) => {
				if (item.fechaDiagnostico && item.fechaDiagnostico < birthDate) context.addIssue({ code: "custom", path: ["antecedentesPatologicos", "personales", index, "fechaDiagnostico"], message: "No puede ser anterior al nacimiento del paciente." });
			});
		}
	});
}

export const UpdateAnamnesisSchema = CreateAnamnesisSchema.extend({
	historiaId: z.string(),
}).omit({
	pacienteId: true,
});
