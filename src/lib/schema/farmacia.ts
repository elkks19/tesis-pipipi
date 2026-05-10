export type Receta = {
	type: "receta";

	medicamentos: {
		nombre: string;
		dosis: string;
		frecuencia: string;
		duracion: string;
	}[];
};
