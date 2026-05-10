import z from "zod";

export const tiposEstacion = [
	"Anamnesis",
	"Examen Físico General",
	"Examen Físico Segmentario",
	"Farmacia",
	"Laboratorios",
	"Electrocardiograma",
	"Espirometría",
	"Ecografía",
	"Recolección de Datos",
	"Diagnóstico",
] as const;

export type Viaje = {
	id: string;
	type: "viaje";
	servicio: string;
	fechaEntrada: string;
	fechaSalida: string;
	establecimiento: {
		nombre: string;
		direccion?: string;
		contacto?: string;
	};
	estaciones: {
		tipo: (typeof tiposEstacion)[number];
		docenteEncargadoId: string;
		estudiantesIds: string[];
	}[];
};

// TODO: MEJORAR ESTE ESUQEMA PORQUE ESTA HECHO BIEN DE LA PATADA
export const CreateViajeSchema = z.object({
	servicio: z.string().trim().min(1),
	fechaEntrada: z.coerce.date<string>()
		.min(new Date(), "La fecha de entrada debe ser en el futuro"),
	fechaSalida: z.coerce.date<string>(),
	establecimiento: z.object({
		nombre: z.string().trim().min(1),
		direccion: z.string().trim().optional(),
		contacto: z.string().trim().optional(),
	}),
	estaciones: z.array(
		z.object({
			tipo: z.enum(tiposEstacion),
			docenteEncargado: z.string(),
			estudiantes: z.array(z.string()),
		})
	),
}).refine((viaje) => viaje.fechaSalida >= viaje.fechaEntrada, {
	message: "La fecha de salida debe ser posterior o igual a la fecha de entrada",
	path: ["fechaSalida"],
}).refine((viaje) => {
	const tipos = viaje.estaciones.map((estacion) => estacion.tipo);

	return new Set(tipos).size === tipos.length;
}, {
	message: "Cada tipo de estacion solo puede seleccionarse una vez",
	path: ["estaciones"],
});

export const UpdateViajeSchema = CreateViajeSchema.extend({
	id: z.string(),
});
