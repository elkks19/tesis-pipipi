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

export const CreateElectrocardiogramaSchema = z.object({
	ritmo: z.string(),
	frecuenciaCardiaca: z.number(),
	crecimientoAuriculaDerecha: z.coerce.boolean<boolean>(),
	crecimientoAuriculaIzquierda: z.coerce.boolean<boolean>(),
	crecimientoVentriculoDerecho: z.coerce.boolean<boolean>(),
	crecimientoVentriculoIzquierdo: z.coerce.boolean<boolean>(),
	intervaloPR: z.number(),
	intervaloQTc: z.number(),
	supraInfraDesnivelST: z.coerce.boolean<boolean>(),
	derivacionSupraInfraDesnivelST: z.string(),
	duracionOndaP: z.number(),
	duracionComplejoQRS: z.number(),
	duracionOndaT: z.number(),
	extrasistoleSupraventricular: z.coerce.boolean<boolean>(),
	extrasistoleIntraventricular: z.coerce.boolean<boolean>(),
	diagnostico: z.string(),
});

export const UpdateElectrocardiogramaSchema = CreateElectrocardiogramaSchema.extend({
	idHistoria: z.string(),
});

