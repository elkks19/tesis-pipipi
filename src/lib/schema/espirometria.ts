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

const volume = (label: string) => z.number().min(0, `${label}: no puede ser negativo`).max(20, `${label}: revisa la unidad`);
const percent = (label: string) => z.number().min(0, `${label}: no puede ser negativo`).max(400, `${label}: revisa el porcentaje`);

export const CreateEspirometriaSchema = z.object({
	FEV1: volume("FEV1"),
	porcentajeFEVteorico: percent("FEV teorico"),
	FVC: volume("FVC"),
	porcentajeFVCteorico: percent("FVC teorico"),
	FEV1FVC: z.number().min(0, "FEV1/FVC no puede ser negativo").max(100, "FEV1/FVC no puede superar 100"),
	porcentajeFEV1FVCteorico: percent("FEV1/FVC teorico"),
	flujoEspiratorioPicoPEF: z.number().min(0, "PEF no puede ser negativo").max(2000, "PEF: revisa la unidad"),
	porcentajePEFteorico: percent("PEF teorico"),
	fuenteDatosTeoricos: z.string().trim().max(200, "Maximo 200 caracteres").optional(),
	observaciones: z.array(z.enum(tiposObservaciones)),
	diagnostico: z.string().trim().min(1, "Ingresa el diagnostico").max(3000, "Maximo 3000 caracteres"),
});

export const UpdateEspirometriaSchema = CreateEspirometriaSchema.extend({
	idHistoria: z.string(),
});
