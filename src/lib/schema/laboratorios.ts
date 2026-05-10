import z from "zod";

export const gruposSanguineos = [
	"A+", "A-",
	"B+", "B-",
	"AB+", "AB-",
	"O+", "O-",
] as const;

export type Laboratorios = {
	glicemiaCapilar: string;
	grupoSanguineo: typeof gruposSanguineos[number];
	otrosEstudios?: {
		nombre: string;
		resultado: string;
	}[];
};

export const CreateLaboratoriosSchema = z.object({
	glicemiaCapilar: z.string(),
	grupoSanguineo: z.enum(gruposSanguineos),
	otrosEstudios: z.array(z.object({
		nombre: z.string(),
		resultado: z.string(),
	})).optional(),
});

export const UpdateLaboratoriosSchema = CreateLaboratoriosSchema.extend({
	idHistoria: z.string(),
});
