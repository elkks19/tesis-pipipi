import type { Anamnesis } from "./anamnesis"
import type { Diagnostico } from "./diagnostico";
import type { Ecografia } from "./ecografia";
import type { Electrocardiograma } from "./electrocardiograma";
import type { Espirometria } from "./espirometria";
import type { ExamenFisicoGeneral } from "./examenFisicoGeneral";
import type { ExamenFisicoSegmentario } from "./examenFisicoSegmentario";
import type { Receta } from "./farmacia";
import type { Laboratorios } from "./laboratorios";

export type Historia = {
	type: "historia";

	pacienteId: string;
	viajeId?: string;
	anamnesis?: Anamnesis;
	examenFisicoGeneral?: ExamenFisicoGeneral;
	examenFisicoSegmentario?: ExamenFisicoSegmentario;
	electrocardiograma?: Electrocardiograma;
	espirometria?: Espirometria;
	ecografia?: Ecografia;
	laboratorios?: Laboratorios;
	diagnostico?: Diagnostico;
	receta?: Receta;
}
