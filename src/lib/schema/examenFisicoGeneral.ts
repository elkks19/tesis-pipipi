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

const measured = (label: string, min: number, max: number, missing?: string) => z.number({
  error: missing ?? `Ingresa un valor válido para ${label.toLowerCase()}.`,
})
  .finite(`Revisa el valor de ${label.toLowerCase()}.`)
  .min(min, `${label}: el valor mínimo permitido es ${min}.`)
  .max(max, `${label}: el valor máximo permitido es ${max}.`);

const pressure = z.object({
  min: measured("Presión diastólica (mmHg)", 20, 250),
  max: measured("Presión sistólica (mmHg)", 40, 350),
}).refine((value) => value.max > value.min, {
  path: ["max"],
  message: "La presión sistólica debe ser mayor que la diastólica.",
});

export const CreateExamenFisicoGeneralSchema = z.object({
	presionArterial: z.object({
		derecha: pressure,
		izquierda: pressure,
	}),
	presionArterialMedia: measured("Presión arterial media (mmHg)", 20, 350, "Registra la presión arterial para calcular la media."),
	pulsos: measured("Pulsos (lpm)", 20, 300),
	frecuenciaRespiratoria: measured("Frecuencia respiratoria (rpm)", 2, 100),
	frecuenciaCardiaca: measured("Frecuencia cardíaca (lpm)", 20, 300),
	temperaturaAxilar: measured("Temperatura axilar (°C)", 25, 45),
	peso: measured("Peso (kg)", 0.1, 500),
	talla: measured("Talla (cm)", 20, 250),
	imc: measured("IMC", 1, 200, "Ingresa peso y talla para calcular el IMC."),
	perimetroCadera: measured("Perímetro de cadera (cm)", 5, 300),
	perimetroCintura: measured("Perímetro de cintura (cm)", 5, 300),
	indiceCinturaCadera: measured("Índice cintura/cadera", 0.05, 10, "Ingresa los perímetros de cintura y cadera para calcular el índice."),
	diagnosticoIMC: z.enum(diagnosticosIMC, { error: "Selecciona un diagnóstico IMC." }),
});

export const UpdateExamenFisicoGeneralSchema = CreateExamenFisicoGeneralSchema.extend({
	idHistoria: z.string(),
});
