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

const measured = (label: string, min: number, max: number) => z.number()
  .finite(`${label}: ingresa un numero valido`)
  .min(min, `${label}: minimo ${min}`)
  .max(max, `${label}: maximo ${max}`);

const pressure = z.object({
  min: measured("Presion diastolica (mmHg)", 20, 250),
  max: measured("Presion sistolica (mmHg)", 40, 350),
}).refine((value) => value.max > value.min, {
  path: ["max"],
  message: "La sistolica debe ser mayor que la diastolica",
});

export const CreateExamenFisicoGeneralSchema = z.object({
	presionArterial: z.object({
		derecha: pressure,
		izquierda: pressure,
	}),
	presionArterialMedia: measured("Presion arterial media (mmHg)", 20, 350),
	pulsos: measured("Pulsos (lpm)", 20, 300),
	frecuenciaRespiratoria: measured("Frecuencia respiratoria (rpm)", 2, 100),
	frecuenciaCardiaca: measured("Frecuencia cardiaca (lpm)", 20, 300),
	temperaturaAxilar: measured("Temperatura axilar (C)", 25, 45),
	peso: measured("Peso (kg)", 0.1, 500),
	talla: measured("Talla (cm)", 20, 250),
	imc: measured("IMC", 1, 200),
	perimetroCadera: measured("Perimetro cadera (cm)", 5, 300),
	perimetroCintura: measured("Perimetro cintura (cm)", 5, 300),
	indiceCinturaCadera: measured("Indice cintura/cadera", 0.05, 10),
	diagnosticoIMC: z.enum(diagnosticosIMC),
});

export const UpdateExamenFisicoGeneralSchema = CreateExamenFisicoGeneralSchema.extend({
	idHistoria: z.string(),
});
