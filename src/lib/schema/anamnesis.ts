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
		menarca: number;
		ritmoMenstrual: string;

		gestaciones: number;
		partos: number;
		abortos: number;
		cesareas: number;

		fechaUltimaGestacion: string;
		fechaUltimoParto: string;
		fechaUltimoAborto: string;
		fechaUltimaCesarea: string;

		edadMenopausia: number;
		terapiaAnticonceptiva: boolean;
		metodoAnticonceptivo?: string;
		inicioVidaSexual: number;
		numeroParejasSexuales: number;

		cirugiaPelviana: string;
		fechaPapanicolau?: string;
		resultadoPapanicolau?: string;
		colposcopia?: string;
		biopsiaCervical?: string;
	};
};

export const CreateAnamnesisSchema = z.object({
	pacienteId: z.string(),
	estadoCivil: z.enum(estadosCiviles),
	nivelEducativo: z.enum(nivelesEducativos),
	añosCursados: z.number().optional(),
	situacionLaboral: z.string().optional(),
	motivoConsulta: z.string(),
	historiaEnfermedadActual: z.string(),

	antecedentesNoPatologicos: z.object({
		habitoTabaquico: z.enum(habitosTabaco),
		consumoAlcohol: z.enum(consumosAlcohol),
		realizaActividadFisica: z.coerce.boolean<boolean>(),
		consumoFrutasVerduras: z.enum(porcionesFrutasVerduras),
	}),

	antecedentesPatologicos: z.object({
		personales: z.array(
			z.object({
				enfermedad: ICDSchema,
				fechaDiagnostico: z.coerce.date<string>().optional(),
				tratamiento: z.string().optional(),
			})
		),
		familiares: z.array(
			z.object({
				parentesco: z.string(),
				enfermedad: ICDSchema,
				edadDiagnostico: z.number(),
				fallecimiento: z.coerce.boolean<boolean>(),
				edadFallecimiento: z.number().optional(),
			})
		),
	}),

	// TODO: validacion opcional segun el genero
	antecedentesGinecoObstetricos: z.object({
		estadioTanner: z.string(),
		menarca: z.int(),
		ritmoMenstrual: z.string(),

		gestaciones: z.number(),
		partos: z.number(),
		abortos: z.number(),
		cesareas: z.number(),

		fechaUltimaGestacion: z.string(),
		fechaUltimoParto: z.string(),
		fechaUltimoAborto: z.string(),
		fechaUltimaCesarea: z.string(),

		edadMenopausia: z.int(),
		terapiaAnticonceptiva: z.coerce.boolean<boolean>(),
		// TODO: ACA VALIDAR SI ES QUE EL ANTERIOR BOOLEAN ES VERDADERO
		metodoAnticonceptivo: z.string().optional(),
		inicioVidaSexual: z.int(),
		numeroParejasSexuales: z.int(),

		cirugiaPelviana: z.string(),
		fechaPapanicolau: z.coerce.date<string>().optional(),
		// TODO: ACA VALIDAR SI ES QUE LA ANTERIOR FECHA TIENE ALGUN VALOR
		resultadoPapanicolau: z.string().optional(),
		colposcopia: z.string().optional(),
		biopsiaCervical: z.string().optional(),
	}).optional(),
});

export const UpdateAnamnesisSchema = CreateAnamnesisSchema.extend({
	historiaId: z.string(),
}).omit({
	pacienteId: true,
});
