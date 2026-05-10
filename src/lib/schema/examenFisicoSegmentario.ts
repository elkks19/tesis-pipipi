import z from "zod";

export type ExamenFisicoSegmentario = {
	cabeza: string;
	cuello: string;
	aparatoRespiratorio: string;
	aparatoCardiovascular: string;
	abdomenPelvis: string;
	aparatoGenitourinario: string;
	pielFaneras: string;
	sistemaHemolinfopoyetico: string;
	aparatoOsteoartromuscular: string;
	sistemaNerviosoCentral: string;
};

export const CreateExamenFisicoSegmentarioSchema = z.object({
	cabeza: z.string(),
	cuello: z.string(),
	aparatoRespiratorio: z.string(),
	aparatoCardiovascular: z.string(),
	abdomenPelvis: z.string(),
	aparatoGenitourinario: z.string(),
	pielFaneras: z.string(),
	sistemaHemolinfopoyetico: z.string(),
	aparatoOsteoartromuscular: z.string(),
	sistemaNerviosoCentral: z.string(),
});

export const UpdateExamenFisicoSegmentarioSchema = CreateExamenFisicoSegmentarioSchema.extend({
	idHistoria: z.string(),
});
