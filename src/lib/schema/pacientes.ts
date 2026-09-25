import z from "zod";

export const tiposDocumentoIdentidad = [
	"CI",
	"Pasaporte",
] as const;

export const generos = [
	"Masculino",
	"Femenino",
	"Indeterminado",
] as const;

export type Paciente = {
	type: "paciente";
	createdAt?: string;
	updatedAt?: string;
	datosPersonales: {
		nombres: string;
		apellidoPaterno: string;
		apellidoMaterno: string;
		fechaNacimiento: Date;
		documentoIdentidad: (typeof tiposDocumentoIdentidad)[number];
		numeroDocumentoIdentidad: string;
	}
	genero: (typeof generos)[number];
	lugarNacimiento: {
		pais: string;
		departamento: string;
		distrito?: string;
	};
	nacionalidad: string;
	etnia?: string;
	padres?: {
		datosPersonales: {
			nombres: string;
			apellidoPaterno: string;
			apellidoMaterno: string;
			fechaNacimiento: Date;
			documentoIdentidad: (typeof tiposDocumentoIdentidad)[number];
			numeroDocumentoIdentidad: string;
		}

		relacion: string;
		asumeSustento: boolean;
		numeroContacto: string;
	}[];
};

const requiredText = (label: string, max: number) =>
	z.string().trim().min(1, `${label} es obligatorio.`).max(max, `${label} no puede superar ${max} caracteres.`);
const optionalText = (max: number) => z.string().trim().max(max, `No puede superar ${max} caracteres.`).optional();
const personName = (label: string) => requiredText(label, 100).refine((value) => /\p{L}/u.test(value), `${label} debe incluir una letra.`);
const optionalSurname = z.string().trim().max(100, "El segundo apellido no puede superar 100 caracteres.").refine((value) => !value || /\p{L}/u.test(value), "El segundo apellido debe incluir una letra.");

function todayInBolivia() {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/La_Paz",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getPacienteAge(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
	const today = todayInBolivia();
	if (value > today) return null;
	const [year, month, day] = value.split("-").map(Number);
	const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);
	return currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
}

const birthDate = z.string().refine((value) => {
	const age = getPacienteAge(value);
	return age !== null && age <= 125;
}, "Ingresa una fecha real, no futura, con una edad máxima de 125 años.").transform((value) => new Date(`${value}T00:00:00Z`));

export const DatosPersonalesSchema = z.object({
	nombres: personName("El nombre"),
	apellidoPaterno: personName("El apellido paterno"),
	apellidoMaterno: optionalSurname,
	fechaNacimiento: birthDate,
	documentoIdentidad: z.enum(tiposDocumentoIdentidad, "Selecciona el tipo de documento."),
	numeroDocumentoIdentidad: requiredText("El número de documento", 30),
}).superRefine((value, context) => {
	const number = value.numeroDocumentoIdentidad;
	if (number.length < 3 || !/^[A-Za-z0-9-]+$/.test(number)) {
		context.addIssue({ code: "custom", path: ["numeroDocumentoIdentidad"], message: "Usa entre 3 y 30 letras, números o guiones, sin espacios." });
	} else if (value.documentoIdentidad === "CI" && !/\d/.test(number)) {
		context.addIssue({ code: "custom", path: ["numeroDocumentoIdentidad"], message: "El CI debe incluir al menos un dígito." });
	}
});

const guardianSchema = z.object({
	datosPersonales: DatosPersonalesSchema,
	relacion: requiredText("La relación", 80),
	asumeSustento: z.boolean(),
	numeroContacto: requiredText("El número de contacto", 30).refine(
		(value) => /^\+?[0-9()\s-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7 && (value.match(/\d/g)?.length ?? 0) <= 15,
		"Ingresa un teléfono de 7 a 15 dígitos; puedes usar +, espacios, guiones o paréntesis.",
	),
});

export const CreatePacienteSchema = z.object({
	datosPersonales: DatosPersonalesSchema,
	genero: z.enum(generos, "Selecciona el género."),
	lugarNacimiento: z.object({
		pais: requiredText("El país", 100),
		departamento: requiredText("El departamento", 100),
		distrito: optionalText(100),
	}),
	nacionalidad: requiredText("La nacionalidad", 100),
	etnia: optionalText(100),
	padres: z.array(guardianSchema).optional(),
}).superRefine((value, context) => {
	const patientBirth = value.datosPersonales.fechaNacimiento;
	if (!(patientBirth instanceof Date) || Number.isNaN(patientBirth.getTime())) return;
	const age = getPacienteAge(patientBirth.toISOString().slice(0, 10));
	if (age === null) return;
	if (age < 18 && !value.padres?.length) {
		context.addIssue({ code: "custom", path: ["padres"], message: "Agrega al menos un responsable para un paciente menor de edad." });
	}
	value.padres?.forEach((guardian, index) => {
		if (guardian.datosPersonales.fechaNacimiento instanceof Date && guardian.datosPersonales.fechaNacimiento >= patientBirth) {
			context.addIssue({ code: "custom", path: ["padres", index, "datosPersonales", "fechaNacimiento"], message: "El responsable debe ser mayor que el paciente." });
		}
	});
});

export const UpdatePacienteSchema = CreatePacienteSchema.safeExtend({
	id: z.string(),
});
