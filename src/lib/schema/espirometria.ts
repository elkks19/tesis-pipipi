import z from "zod";

export const tiposObservaciones = [
	"Buena maniobra",
	"Comienzo lento",
	"Poco esfuerzo"
] as const;

export type Espirometria = {
	FEV1: number;
	porcentajeFEVteorico: number;
	FVC: number;
	porcentajeFVCteorico: number;
	FEV1FVC: number;
	porcentajeFEV1FVCteorico: number;
	flujoEspiratorioPicoPEF: number;
	porcentajePEFteorico: number;
	fuenteDatosTeoricos?: string;
	observaciones: typeof tiposObservaciones[number][];
	diagnostico: string;
};

export const CreateEspirometriaSchema = z.object({
	FEV1: z.number(),
	porcentajeFEVteorico: z.number(),
	FVC: z.number(),
	porcentajeFVCteorico: z.number(),
	FEV1FVC: z.number(),
	porcentajeFEV1FVCteorico: z.number(),
	flujoEspiratorioPicoPEF: z.number(),
	porcentajePEFteorico: z.number(),
	fuenteDatosTeoricos: z.string().optional(),
	observaciones: z.array(z.enum(tiposObservaciones)),
	diagnostico: z.string(),
});

export const UpdateEspirometriaSchema = CreateEspirometriaSchema.extend({
	idHistoria: z.string(),
});
