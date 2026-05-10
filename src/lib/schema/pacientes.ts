import z from "zod";

export const tiposDocumentoIdentidad = [
	"CI",
	"Pasaporte",
] as const;

export const generos = [
	"Masculino",
	"Femenino",
	"Indeterminado",
] as const;

export type Paciente = {
	type: "paciente";
	datosPersonales: {
		nombres: string;
		apellidoPaterno: string;
		apellidoMaterno: string;
		fechaNacimiento: Date;
		documentoIdentidad: (typeof tiposDocumentoIdentidad)[number];
		numeroDocumentoIdentidad: string;
	}
	genero: (typeof generos)[number];
	lugarNacimiento: {
		pais: string;
		departamento: string;
		distrito?: string;
	};
	nacionalidad: string;
	etnia?: string;
	padres?: {
		datosPersonales: {
			nombres: string;
			apellidoPaterno: string;
			apellidoMaterno: string;
			fechaNacimiento: Date;
			documentoIdentidad: (typeof tiposDocumentoIdentidad)[number];
			numeroDocumentoIdentidad: string;
		}

		relacion: string;
		asumeSustento: boolean;
		numeroContacto: string;
	}[];
};

export const DatosPersonalesSchema = z.object({
	nombres: z.string(),
	apellidoPaterno: z.string(),
	apellidoMaterno: z.string(),
	fechaNacimiento: z.coerce.date<string>(),
	documentoIdentidad: z.enum(tiposDocumentoIdentidad),
	// TODO: REGEX ACA CREO
	numeroDocumentoIdentidad: z.string(),
})

// TODO: FINISH VALIDATORS FOR LENGTH AND OTHER STUFF
export const CreatePacienteSchema = z.object({
	datosPersonales: DatosPersonalesSchema,
	genero: z.enum(generos),
	lugarNacimiento: z.object({
		pais: z.string(),
		departamento: z.string(),
		distrito: z.string().optional(),
	}),
	nacionalidad: z.string(),
	etnia: z.string().optional(),
	padres: z.array(
		z.object({
			datosPersonales: DatosPersonalesSchema,
			relacion: z.string(),
			asumeSustento: z.coerce.boolean<boolean>(),
			numeroContacto: z.string(),
		})
	).optional(),
})

export const UpdatePacienteSchema = CreatePacienteSchema.extend({
	id: z.string(),
});
