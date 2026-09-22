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

const measurement = (label: string) => z.number()
	.positive(`${label}: debe ser mayor que cero`)
	.max(1000, `${label}: revisa la unidad`);
const diagnosis = z.string().trim().min(1, "Ingresa el diagnostico").max(3000, "Maximo 3000 caracteres");

export const CreateEcografiaSchema = z.object({
	historiaId: z.string(),
	imagen: z.object({
		key: z.string(),
		nombre: z.string(),
		tipo: z.string(),
		tamano: z.number().nonnegative(),
		url: z.string().optional(),
		data: z.string().optional(),
	}).optional(),
	higado: z.object({
		dimensiones: measurement("Dimension hepatica"),
		hepatomegalia: z.coerce.boolean<boolean>(),
		parenquima: z.enum(tiposParenquima),
		diagnostico: diagnosis,
	}),
	vesiculaBiliar: z.object({
		paredes: z.enum(tiposParedes),
		contenidoAnecoico: z.coerce.boolean<boolean>(),
		barroBiliar: z.coerce.boolean<boolean>(),
		calculos: z.coerce.boolean<boolean>(),
		diagnostico: diagnosis,
	}),
	riñones: z.object({
		derecho: z.object({
			longitud: measurement("Longitud renal derecha"),
			parenquima: measurement("Parenquima renal derecho"),
		}),
		izquierdo: z.object({
			longitud: measurement("Longitud renal izquierda"),
			parenquima: measurement("Parenquima renal izquierdo"),
		}),
		ecogenicidad: z.enum(tiposEcogenicidad),
		relacionCorticoMedular: z.enum(tiposEcogenicidad),
		diagnostico: diagnosis,
	}),
});
