import z from "zod";

export type Electrocardiograma = {
	ritmo: string;
	frecuenciaCardiaca: number;
	crecimientoAuriculaDerecha: boolean;
	crecimientoAuriculaIzquierda: boolean;
	crecimientoVentriculoDerecho: boolean;
	crecimientoVentriculoIzquierdo: boolean;
	intervaloPR: number;
	intervaloQTc: number;
	supraInfraDesnivelST: boolean;
	derivacionSupraInfraDesnivelST: string;
	duracionOndaP: number;
	duracionComplejoQRS: number;
	duracionOndaT: number;
	extrasistoleSupraventricular: boolean;
	extrasistoleIntraventricular: boolean;
	diagnostico: string;
};

const milliseconds = (label: string) => z.number()
  .finite(`${label}: ingresa un numero valido`)
  .min(0, `${label}: no puede ser negativo`)
  .max(5000, `${label}: revisa la unidad (ms)`);

export const CreateElectrocardiogramaSchema = z.object({
	ritmo: z.string().trim().min(1, "Ingresa el ritmo").max(200, "Maximo 200 caracteres"),
	frecuenciaCardiaca: z.number().min(20, "Minimo 20 lpm").max(300, "Maximo 300 lpm"),
	crecimientoAuriculaDerecha: z.coerce.boolean<boolean>(),
	crecimientoAuriculaIzquierda: z.coerce.boolean<boolean>(),
	crecimientoVentriculoDerecho: z.coerce.boolean<boolean>(),
	crecimientoVentriculoIzquierdo: z.coerce.boolean<boolean>(),
	intervaloPR: milliseconds("Intervalo PR"),
	intervaloQTc: milliseconds("Intervalo QTc"),
	supraInfraDesnivelST: z.coerce.boolean<boolean>(),
	derivacionSupraInfraDesnivelST: z.string().trim().max(200, "Maximo 200 caracteres"),
	duracionOndaP: milliseconds("Onda P"),
	duracionComplejoQRS: milliseconds("Complejo QRS"),
	duracionOndaT: milliseconds("Onda T"),
	extrasistoleSupraventricular: z.coerce.boolean<boolean>(),
	extrasistoleIntraventricular: z.coerce.boolean<boolean>(),
	diagnostico: z.string().trim().min(1, "Ingresa el diagnostico").max(3000, "Maximo 3000 caracteres"),
}).refine((value) => !value.supraInfraDesnivelST || value.derivacionSupraInfraDesnivelST.length > 0, {
	path: ["derivacionSupraInfraDesnivelST"],
	message: "Indica la derivacion con desnivel ST",
});

export const UpdateElectrocardiogramaSchema = CreateElectrocardiogramaSchema.safeExtend({
	idHistoria: z.string(),
});
