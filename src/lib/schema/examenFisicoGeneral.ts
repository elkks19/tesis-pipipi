import z from "zod";

export const diagnosticosIMC = [
	"No tiene desnutrición",
	"Riesgo de desnutrición",
	"Desnutrición moderada",
	"Desnutrición grave",
	"Sobrepeso",
	"Obesidad"
] as const;

export type ExamenFisicoGeneral = {
	presionArterial: {
		derecha: {
			min: number;
			max: number;
		};
		izquierda: {
			min: number;
			max: number;
		};
	};
	// TODO: VER SI ES QUE VALE LA PENA PONERLE ACA UN REGEX PARA ALGO COMO mmHg O ALGO ASI
	presionArterialMedia: number;
	pulsos: number;
	frecuenciaRespiratoria: number;
	frecuenciaCardiaca: number;
	temperaturaAxilar: number;
	peso: number;
	talla: number;
	imc: number;
	perimetroCadera: number;
	perimetroCintura: number;
	indiceCinturaCadera: number;
	diagnosticoIMC: string;
};

export const CreateExamenFisicoGeneralSchema = z.object({
	presionArterial: z.object({
		derecha: z.object({
			min: z.number(),
			max: z.number(),
		}),
		izquierda: z.object({
			min: z.number(),
			max: z.number(),
		}),
	}),
	presionArterialMedia: z.number(),
	pulsos: z.number(),
	frecuenciaRespiratoria: z.number(),
	frecuenciaCardiaca: z.number(),
	temperaturaAxilar: z.number(),
	peso: z.number(),
	talla: z.number(),
	imc: z.number(),
	perimetroCadera: z.number(),
	perimetroCintura: z.number(),
	indiceCinturaCadera: z.number(),
	diagnosticoIMC: z.enum(diagnosticosIMC),
});

export const UpdateExamenFisicoGeneralSchema = CreateExamenFisicoGeneralSchema.extend({
	idHistoria: z.string(),
});
