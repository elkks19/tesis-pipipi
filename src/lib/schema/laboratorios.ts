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
	glicemiaCapilar: z.string().trim().min(1, "Ingresa la glicemia capilar").max(100, "Maximo 100 caracteres"),
	grupoSanguineo: z.enum(gruposSanguineos),
	otrosEstudios: z.array(z.object({
		nombre: z.string().trim().min(1, "Ingresa el nombre del estudio").max(150, "Maximo 150 caracteres"),
		resultado: z.string().trim().min(1, "Ingresa el resultado").max(2000, "Maximo 2000 caracteres"),
	})).optional(),
});

export const UpdateLaboratoriosSchema = CreateLaboratoriosSchema.extend({
	idHistoria: z.string(),
});
