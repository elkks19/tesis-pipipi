import z from 'zod';

export const tiposParedes = [
	"Regulares",
	"Irregulares",
	"Engrosadas",
	"Delgadas",
] as const;

export const tiposParenquima = [
	"Homogeneo",
	"Heterogeneo",
] as const;

export const tiposEcogenicidad = [
	"Conservada",
	"Aumentada",
	"Disminuida",
] as const;

export type Ecografia = {
	imagen?: {
		key: string;
		nombre: string;
		tipo: string;
		tamano: number;
		url?: string;
		data?: string;
	};
	higado: {
		dimensiones: number;
		hepatomegalia: boolean;
		parenquima: (typeof tiposParenquima)[number];
		diagnostico: string;
	};
	vesiculaBiliar: {
		paredes: (typeof tiposParedes)[number];
		contenidoAnecoico: boolean;
		barroBiliar: boolean;
		calculos: boolean;
		diagnostico: string;
	};
	riñones: {
		derecho: {
			longitud: number;
			parenquima: number;
		}
		izquierdo: {
			longitud: number;
			parenquima: number;
		}
		ecogenicidad: (typeof tiposEcogenicidad)[number];
		relacionCorticoMedular: (typeof tiposEcogenicidad)[number];
		diagnostico: string;
	}
};

export const CreateEcografiaSchema = z.object({
	historiaId: z.string(),
	imagen: z.object({
		key: z.string(),
		nombre: z.string(),
		tipo: z.string(),
		tamano: z.number(),
		url: z.string().optional(),
		data: z.string().optional(),
	}).optional(),
	higado: z.object({
		dimensiones: z.number(),
		hepatomegalia: z.coerce.boolean<boolean>(),
		parenquima: z.enum(tiposParenquima),
		diagnostico: z.string(),
	}),
	vesiculaBiliar: z.object({
		paredes: z.enum(tiposParedes),
		contenidoAnecoico: z.coerce.boolean<boolean>(),
		barroBiliar: z.coerce.boolean<boolean>(),
		calculos: z.coerce.boolean<boolean>(),
		diagnostico: z.string(),
	}),
	riñones: z.object({
		derecho: z.object({
			longitud: z.number(),
			parenquima: z.number(),
		}),
		izquierdo: z.object({
			longitud: z.number(),
			parenquima: z.number(),
		}),
		ecogenicidad: z.enum(tiposEcogenicidad),
		relacionCorticoMedular: z.enum(tiposEcogenicidad),
		diagnostico: z.string(),
	}),
});
