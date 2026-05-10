import z from "zod";

export type Enfermedad = {
	iNo: string;
	code: string;
	title: string;
};

export const ICDSchema = z.object({
	iNo: z.string(),
	code: z.string(),
	title: z.string(),
});

