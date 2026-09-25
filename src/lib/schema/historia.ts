import type { Anamnesis } from "./anamnesis"
import type { Diagnostico } from "./diagnostico";
import type { Ecografia } from "./ecografia";
import type { Electrocardiograma } from "./electrocardiograma";
import type { Espirometria } from "./espirometria";
import type { ExamenFisicoGeneral } from "./examenFisicoGeneral";
import type { ExamenFisicoSegmentario } from "./examenFisicoSegmentario";
import type { Receta } from "./farmacia";
import type { Laboratorios } from "./laboratorios";

export type AuditFields = {
	created_by: string;
	updated_by: string;
};

export type ExamenesComplementariosSolicitados = {
	ecografia: boolean;
	laboratorios: boolean;
	espirometria: boolean;
	electrocardiograma: boolean;
};

export type ReporteHistoriaFile = {
	generatedAt: string;
	key: string;
	nombre: string;
	tamano: number;
	tipo: string;
	url: string;
};

export type Historia = {
	type: "historia";

	created_by?: string;
	createdAt?: string;
	updatedAt?: string;
	pacienteId: string;
	viajeId?: string;
	reporteHistoria?: ReporteHistoriaFile;
	reportesHistoria?: ReporteHistoriaFile[];
	examenesComplementariosSolicitados?: ExamenesComplementariosSolicitados;
	anamnesis?: Anamnesis & Partial<AuditFields>;
	examenFisicoGeneral?: ExamenFisicoGeneral & Partial<AuditFields>;
	examenFisicoSegmentario?: ExamenFisicoSegmentario & Partial<AuditFields>;
	electrocardiograma?: Electrocardiograma & Partial<AuditFields>;
	espirometria?: Espirometria & Partial<AuditFields>;
	ecografia?: Ecografia & Partial<AuditFields>;
	laboratorios?: Laboratorios & Partial<AuditFields>;
	diagnostico?: Diagnostico & Partial<AuditFields>;
	receta?: Receta;
}
