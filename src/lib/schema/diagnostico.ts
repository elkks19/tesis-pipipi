import z from 'zod';

export type DiagnosticoCie11 = {
	code: string;
	iNo: string;
	title: string;
};

export type Diagnostico = {
	principal: DiagnosticoCie11;
	secundarios: DiagnosticoCie11[];
	planTrabajo: string;
	recetaId?: string;
};

const DiagnosticoCie11Schema = z.object({
	code: z.string(),
	iNo: z.string().min(1),
	title: z.string().min(1),
});

export const CreateDiagnosticoSchema = z.object({
	historiaId: z.string(),
	principal: DiagnosticoCie11Schema,
	secundarios: z.array(DiagnosticoCie11Schema),
	planTrabajo: z.string(),
	recetaId: z.string().optional(),
});

export const UpdateDiagnosticoSchema = CreateDiagnosticoSchema;
