import z from 'zod';

export type Diagnostico = {
	principal: string;
	// TODO: ARRAY?
	secundarios: string;
	planTrabajo: string;
	recetaId?: string;
};

export const CreateDiagnosticoSchema = z.object({
	historiaId: z.string(),
	principal: z.string(),
	secundarios: z.string(),
	planTrabajo: z.string(),
	recetaId: z.string().optional(),
});

export const UpdateDiagnosticoSchema = CreateDiagnosticoSchema;
