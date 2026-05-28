import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { fakerES_MX as faker } from "@faker-js/faker";

const DEFAULT_COUNT = 80;
const DEFAULT_SEED = 20260515;
const PASSWORD_SEED_NOTICE =
  "Si faltan usuarios, corre primero: pnpm run seed:users";

const stationDefinitions = [
  {
    docenteEmail: "docente-anamnesis@tesis.com",
    studentPrefix: "estudiante-anamnesis",
    tipo: "Anamnesis",
  },
  {
    docenteEmail: "docente-efg@tesis.com",
    studentPrefix: "estudiante-efg",
    tipo: "Examen Físico General",
  },
  {
    docenteEmail: "docente-efs@tesis.com",
    studentPrefix: "estudiante-efs",
    tipo: "Examen Físico Segmentario",
  },
  {
    docenteEmail: "docente-ecografia@tesis.com",
    studentPrefix: "estudiante-ecografia",
    tipo: "Ecografía",
  },
  {
    docenteEmail: "docente-electrocardiograma@tesis.com",
    studentPrefix: "estudiante-electrocardiograma",
    tipo: "Electrocardiograma",
  },
  {
    docenteEmail: "docente-espirometria@tesis.com",
    studentPrefix: "estudiante-espirometria",
    tipo: "Espirometría",
  },
  {
    docenteEmail: "docente-laboratorios@tesis.com",
    studentPrefix: "estudiante-laboratorios",
    tipo: "Laboratorios",
  },
  {
    docenteEmail: "docente-diagnostico@tesis.com",
    studentPrefix: "estudiante-diagnostico",
    tipo: "Diagnóstico",
  },
];

const stationFieldByTipo = {
  Anamnesis: "anamnesis",
  Diagnóstico: "diagnostico",
  Ecografía: "ecografia",
  Electrocardiograma: "electrocardiograma",
  Espirometría: "espirometria",
  "Examen Físico General": "examenFisicoGeneral",
  "Examen Físico Segmentario": "examenFisicoSegmentario",
  Laboratorios: "laboratorios",
};

const stationKeyByTipo = {
  Anamnesis: "anamnesis",
  Diagnóstico: "diagnostico",
  Ecografía: "ecografia",
  Electrocardiograma: "electrocardiograma",
  Espirometría: "espirometria",
  "Examen Físico General": "examenFisicoGeneral",
  "Examen Físico Segmentario": "examenFisicoSegmentario",
  Laboratorios: "laboratorios",
};

const enfermedades = [
  { code: "5A11", iNo: "http://id.who.int/icd/entity/1720186636", title: "Diabetes mellitus tipo 2" },
  { code: "BA00", iNo: "http://id.who.int/icd/entity/1937318563", title: "Hipertension esencial" },
  { code: "CA23.0", iNo: "http://id.who.int/icd/entity/1075687717", title: "Asma" },
  { code: "GB61", iNo: "http://id.who.int/icd/entity/1457239955", title: "Infeccion urinaria" },
  { code: "MG30.0", iNo: "http://id.who.int/icd/entity/1581976053", title: "Dolor cronico primario" },
  { code: "DA63", iNo: "http://id.who.int/icd/entity/1179281178", title: "Gastritis" },
];

const estadosCiviles = ["Soltero", "Casado", "Viudo", "Unión Libre", "Divorciado"];
const nivelesEducativos = [
  "Sin educación formal",
  "Primaria concluida",
  "Secundaria concluida",
  "Licenciatura concluida",
  "Especialidad concluida",
  "Maestría concluida",
  "Doctorado concluido",
];
const habitosTabaco = [
  "Nunca fumo",
  "Anteriormente fumaba",
  "Fumador pasivo",
  "Fumador ligero (menos de 10 cigarrillos al día)",
  "Fumador moderado (entre 10 y 20 cigarrillos al día)",
  "Fumador ocasional (fuma solo en ocasiones sociales)",
];
const consumosAlcohol = [
  "No consume alcohol",
  "Consumo de bajo riesgo (hasta 1 botella de cerveza)",
  "Consumo de riesgo (mas de 2 botellas de cerveza)",
  "Consumo excesivo episodico (3 o mas botellas de cerveza en una ocasión)",
];
const porcionesFrutasVerduras = [
  "No consume",
  "1 - 2 porciones al día",
  "3 - 4 porciones al día",
  "5 o más porciones al día",
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));

  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function dateValue(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function pick(array) {
  return faker.helpers.arrayElement(array);
}

function maybe(probability = 0.5) {
  return faker.number.float({ max: 1, min: 0 }) < probability;
}

function rounded(value, fractionDigits = 1) {
  return Number(value.toFixed(fractionDigits));
}

function getUsersByEmail() {
  const databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite";
  const database = new Database(databasePath, { readonly: true });

  try {
    const rows = database
      .prepare('SELECT id, name, email, role FROM "user"')
      .all();

    return new Map(rows.map((row) => [row.email, row]));
  } finally {
    database.close();
  }
}

function requireUser(usersByEmail, email) {
  const user = usersByEmail.get(email);

  if (!user) {
    throw new Error(`No existe usuario ${email}. ${PASSWORD_SEED_NOTICE}`);
  }

  return user;
}

function getStationAssignments(usersByEmail) {
  return stationDefinitions.map((station) => {
    const docente = requireUser(usersByEmail, station.docenteEmail);
    const estudiantes = [1, 2, 3, 4].map((index) =>
      requireUser(usersByEmail, `${station.studentPrefix}-${index}@tesis.com`),
    );

    return {
      docente,
      estudiantes,
      tipo: station.tipo,
    };
  });
}

function stationStudent(assignments, tipo, index) {
  const station = assignments.find((item) => item.tipo === tipo);

  if (!station) {
    throw new Error(`No existe asignacion para ${tipo}.`);
  }

  return station.estudiantes[index % station.estudiantes.length];
}

function stationAssignment(assignments, tipo) {
  const station = assignments.find((item) => item.tipo === tipo);

  if (!station) {
    throw new Error(`No existe asignacion para ${tipo}.`);
  }

  return station;
}

function buildViaje(assignments) {
  const today = new Date();
  const viajeId = "viaje:seed:historias";

  return {
    _id: viajeId,
    id: viajeId,
    type: "viaje",
    servicio: "atencion clinica general",
    fechaEntrada: dateValue(addDays(today, -1)),
    fechaSalida: dateValue(addDays(today, 14)),
    establecimiento: {
      nombre: "Centro de Salud de prueba",
      direccion: "Av. los palmos 123",
      contacto: "77887788",
    },
    estaciones: assignments.map((station) => ({
      tipo: station.tipo,
      docenteEncargadoId: station.docente.id,
      estudiantesIds: station.estudiantes.map((student) => student.id),
    })),
  };
}

function buildPaciente(index) {
  const sex = maybe() ? "female" : "male";
  const firstName = faker.person.firstName(sex);
  const lastName = faker.person.lastName();
  const secondLastName = faker.person.lastName();
  const birthDate = faker.date.birthdate({ max: 82, min: 18, mode: "age" });
  const numeroDocumento = String(5000000 + index).padStart(7, "0");

  return {
    _id: `paciente:seed:${index}`,
    type: "paciente",
    datosPersonales: {
      nombres: firstName,
      apellidoPaterno: lastName,
      apellidoMaterno: secondLastName,
      fechaNacimiento: dateValue(birthDate),
      documentoIdentidad: "CI",
      numeroDocumentoIdentidad: numeroDocumento,
    },
    genero: sex === "female" ? "Femenino" : "Masculino",
    lugarNacimiento: {
      pais: "Bolivia",
      departamento: pick(["La Paz", "Cochabamba", "Santa Cruz", "Oruro", "Potosi"]),
      distrito: pick(["Distrito 1", "Distrito 2", "Distrito 3", "Distrito 4"]),
    },
    nacionalidad: "Boliviana",
    etnia: pick(["Mestiza", "Aymara", "Quechua", "Guarani", "No declara"]),
  };
}

function audit(user) {
  return {
    created_by: user.id,
    updated_by: user.id,
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function valuesAreEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function flatten(value, prefix = "") {
  const fields = new Map();

  if (!isRecord(value)) {
    if (prefix) {
      fields.set(prefix, value);
    }

    return fields;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "created_by" || key === "updated_by") {
      continue;
    }

    const pathName = prefix ? `${prefix}.${key}` : key;

    if (isRecord(nestedValue)) {
      for (const [nestedPath, nestedLeafValue] of flatten(
        nestedValue,
        pathName,
      )) {
        fields.set(nestedPath, nestedLeafValue);
      }
    } else {
      fields.set(pathName, nestedValue);
    }
  }

  return fields;
}

function buildChanges(before, after) {
  const beforeFields = flatten(before);
  const afterFields = flatten(after);
  const keys = new Set([...beforeFields.keys(), ...afterFields.keys()]);

  return [...keys]
    .filter((key) => !valuesAreEqual(beforeFields.get(key), afterFields.get(key)))
    .sort()
    .map((key) => ({
      after: afterFields.get(key),
      before: beforeFields.get(key),
      field: key,
    }));
}

function seedTimestamp(index, offsetMinutes) {
  const base = new Date();
  base.setHours(7, 0, 0, 0);
  base.setDate(base.getDate() - Math.min(6, Math.floor(index / 14)));

  return new Date(base.getTime() + offsetMinutes * 60_000).toISOString();
}

function activityId(index, stationKey, action, sequence) {
  return `actividad:seed:${String(index).padStart(4, "0")}:${stationKey}:${action}:${String(sequence).padStart(2, "0")}`;
}

function buildActivity({
  action,
  actorId,
  after,
  before,
  createdAt,
  historia,
  id,
  pacienteId,
  stationKey,
  subject,
  viajeId,
}) {
  const changes = buildChanges(before, after);

  return {
    _id: id,
    type: "actividad",
    action,
    actorId,
    changedFields: changes.map((change) => change.field),
    changes,
    createdAt,
    ...(historia?._id ? { historiaId: historia._id } : {}),
    pacienteId,
    stationKey,
    subject,
    viajeId,
  };
}

function buildAnamnesis(user, paciente) {
  const personales = maybe(0.65)
    ? [
        {
          enfermedad: pick(enfermedades),
          fechaDiagnostico: dateValue(faker.date.past({ years: 8 })),
          tratamiento: pick(["Control medico", "Tratamiento regular", "Sin tratamiento actual"]),
        },
      ]
    : [];
  const familiares = maybe(0.45)
    ? [
        {
          parentesco: pick(["Madre", "Padre", "Hermano", "Abuela"]),
          enfermedad: pick(enfermedades),
          edadDiagnostico: faker.number.int({ max: 70, min: 25 }),
          fallecimiento: maybe(0.2),
          edadFallecimiento: maybe(0.15) ? faker.number.int({ max: 85, min: 45 }) : undefined,
        },
      ]
    : [];
  const gineco =
    paciente.genero === "Femenino"
      ? {
          estadioTanner: pick(["IV", "V"]),
          menarca: faker.number.int({ max: 15, min: 10 }),
          ritmoMenstrual: pick(["Regular", "Irregular"]),
          gestaciones: faker.number.int({ max: 5, min: 0 }),
          partos: faker.number.int({ max: 4, min: 0 }),
          abortos: faker.number.int({ max: 2, min: 0 }),
          cesareas: faker.number.int({ max: 3, min: 0 }),
          fechaUltimaGestacion: dateValue(faker.date.past({ years: 10 })),
          fechaUltimoParto: dateValue(faker.date.past({ years: 12 })),
          fechaUltimoAborto: dateValue(faker.date.past({ years: 12 })),
          fechaUltimaCesarea: dateValue(faker.date.past({ years: 12 })),
          edadMenopausia: faker.number.int({ max: 55, min: 45 }),
          terapiaAnticonceptiva: maybe(),
          metodoAnticonceptivo: pick(["Oral", "Inyectable", "DIU", "Barrera"]),
          inicioVidaSexual: faker.number.int({ max: 25, min: 15 }),
          numeroParejasSexuales: faker.number.int({ max: 6, min: 1 }),
          cirugiaPelviana: pick(["Niega", "Cesarea previa", "Legrado uterino"]),
          fechaPapanicolau: dateValue(faker.date.past({ years: 3 })),
          resultadoPapanicolau: pick(["Normal", "Inflamatorio", "Pendiente"]),
          colposcopia: pick(["No realizada", "Normal", "Pendiente"]),
          biopsiaCervical: pick(["No realizada", "Sin alteraciones"]),
        }
      : undefined;

  return {
    ...audit(user),
    estadoCivil: pick(estadosCiviles),
    nivelEducativo: pick(nivelesEducativos),
    añosCursados: faker.number.int({ max: 18, min: 0 }),
    situacionLaboral: pick(["Independiente", "Dependiente", "Estudiante", "Labores de casa", "Desempleado"]),
    motivoConsulta: pick([
      "Control general durante campaña de salud",
      "Cefalea ocasional y cansancio",
      "Dolor abdominal intermitente",
      "Tos y disnea de esfuerzo",
      "Seguimiento de enfermedad cronica",
    ]),
    historiaEnfermedadActual: faker.lorem.paragraph({ max: 4, min: 2 }),
    antecedentesNoPatologicos: {
      habitoTabaquico: pick(habitosTabaco),
      consumoAlcohol: pick(consumosAlcohol),
      realizaActividadFisica: maybe(),
      consumoFrutasVerduras: pick(porcionesFrutasVerduras),
    },
    antecedentesPatologicos: {
      personales,
      familiares,
    },
    ...(gineco ? { antecedentesGinecoObstetricos: gineco } : {}),
  };
}

function buildExamenFisicoGeneral(user) {
  const talla = faker.number.float({ fractionDigits: 2, max: 1.9, min: 1.48 });
  const peso = faker.number.float({ fractionDigits: 1, max: 98, min: 45 });
  const imc = rounded(peso / (talla * talla), 1);

  return {
    ...audit(user),
    presionArterial: {
      derecha: {
        max: faker.number.int({ max: 145, min: 95 }),
        min: faker.number.int({ max: 95, min: 60 }),
      },
      izquierda: {
        max: faker.number.int({ max: 145, min: 95 }),
        min: faker.number.int({ max: 95, min: 60 }),
      },
    },
    presionArterialMedia: faker.number.int({ max: 115, min: 75 }),
    pulsos: faker.number.int({ max: 92, min: 60 }),
    frecuenciaRespiratoria: faker.number.int({ max: 24, min: 14 }),
    frecuenciaCardiaca: faker.number.int({ max: 105, min: 58 }),
    temperaturaAxilar: faker.number.float({ fractionDigits: 1, max: 37.4, min: 35.8 }),
    peso,
    talla,
    imc,
    perimetroCadera: faker.number.int({ max: 118, min: 78 }),
    perimetroCintura: faker.number.int({ max: 112, min: 65 }),
    indiceCinturaCadera: faker.number.float({ fractionDigits: 2, max: 1.05, min: 0.72 }),
    diagnosticoIMC:
      imc >= 30
        ? "Obesidad"
        : imc >= 25
          ? "Sobrepeso"
          : "No tiene desnutrición",
  };
}

function buildExamenFisicoSegmentario(user) {
  return {
    ...audit(user),
    cabeza: pick(["Normocefalo, mucosas hidratadas", "Sin hallazgos patologicos aparentes"]),
    cuello: pick(["Movil, sin adenopatias", "Sin ingurgitacion yugular"]),
    aparatoRespiratorio: pick(["Murmullo vesicular conservado", "Sin ruidos agregados"]),
    aparatoCardiovascular: pick(["Ruidos cardiacos ritmicos", "Sin soplos audibles"]),
    abdomenPelvis: pick(["Blando, depresible, no doloroso", "Ruidos hidroaereos presentes"]),
    aparatoGenitourinario: pick(["Sin datos patologicos referidos", "Puño percusion negativa"]),
    pielFaneras: pick(["Piel normocoloreada", "Sin lesiones activas visibles"]),
    sistemaHemolinfopoyetico: pick(["Sin adenopatias palpables", "Sin visceromegalias"]),
    aparatoOsteoartromuscular: pick(["Tono y fuerza conservados", "Arcos de movimiento conservados"]),
    sistemaNerviosoCentral: pick(["Consciente, orientado", "Pares craneales sin alteraciones aparentes"]),
  };
}

function buildElectrocardiograma(user) {
  return {
    ...audit(user),
    ritmo: pick(["Sinusal", "Sinusal regular", "Taquicardia sinusal"]),
    frecuenciaCardiaca: faker.number.int({ max: 105, min: 58 }),
    crecimientoAuriculaDerecha: maybe(0.08),
    crecimientoAuriculaIzquierda: maybe(0.1),
    crecimientoVentriculoDerecho: maybe(0.07),
    crecimientoVentriculoIzquierdo: maybe(0.12),
    intervaloPR: faker.number.int({ max: 200, min: 120 }),
    intervaloQTc: faker.number.int({ max: 460, min: 360 }),
    supraInfraDesnivelST: maybe(0.08),
    derivacionSupraInfraDesnivelST: pick(["No evidente", "DII", "V2-V3", "V5-V6"]),
    duracionOndaP: faker.number.int({ max: 120, min: 70 }),
    duracionComplejoQRS: faker.number.int({ max: 110, min: 70 }),
    duracionOndaT: faker.number.int({ max: 180, min: 100 }),
    extrasistoleSupraventricular: maybe(0.08),
    extrasistoleIntraventricular: maybe(0.08),
    diagnostico: pick(["Trazado dentro de parametros normales", "Cambios inespecificos de repolarizacion", "Taquicardia sinusal"]),
  };
}

function buildEspirometria(user) {
  return {
    ...audit(user),
    FEV1: faker.number.float({ fractionDigits: 2, max: 4.2, min: 1.5 }),
    porcentajeFEVteorico: faker.number.int({ max: 105, min: 65 }),
    FVC: faker.number.float({ fractionDigits: 2, max: 5.1, min: 2.0 }),
    porcentajeFVCteorico: faker.number.int({ max: 108, min: 70 }),
    FEV1FVC: faker.number.float({ fractionDigits: 2, max: 0.91, min: 0.62 }),
    porcentajeFEV1FVCteorico: faker.number.int({ max: 105, min: 70 }),
    flujoEspiratorioPicoPEF: faker.number.float({ fractionDigits: 2, max: 9.5, min: 3.2 }),
    porcentajePEFteorico: faker.number.int({ max: 110, min: 60 }),
    fuenteDatosTeoricos: pick(["NHANES III", "GLI 2012", "Referencia local"]),
    observaciones: faker.helpers.arrayElements(["Buena maniobra", "Comienzo lento", "Poco esfuerzo"], { max: 2, min: 1 }),
    diagnostico: pick(["Patron normal", "Probable patron obstructivo leve", "Calidad aceptable de maniobra"]),
  };
}

function buildEcografia(user, index) {
  return {
    ...audit(user),
    imagen: {
      key: `seed/ecografias/ecografia-${index}.png`,
      nombre: `ecografia-${index}.png`,
      tipo: "image/png",
      tamano: faker.number.int({ max: 950000, min: 120000 }),
    },
    higado: {
      dimensiones: faker.number.float({ fractionDigits: 1, max: 17, min: 12 }),
      hepatomegalia: maybe(0.12),
      parenquima: pick(["Homogeneo", "Heterogeneo"]),
      diagnostico: pick(["Sin alteraciones ecograficas evidentes", "Esteatosis hepatica leve", "Higado de aspecto conservado"]),
    },
    vesiculaBiliar: {
      paredes: pick(["Regulares", "Irregulares", "Engrosadas", "Delgadas"]),
      contenidoAnecoico: maybe(0.8),
      barroBiliar: maybe(0.12),
      calculos: maybe(0.08),
      diagnostico: pick(["Vesicula sin litiasis", "Barro biliar escaso", "Paredes conservadas"]),
    },
    riñones: {
      derecho: {
        longitud: faker.number.float({ fractionDigits: 1, max: 12.5, min: 9.0 }),
        parenquima: faker.number.float({ fractionDigits: 1, max: 2.2, min: 1.1 }),
      },
      izquierdo: {
        longitud: faker.number.float({ fractionDigits: 1, max: 12.5, min: 9.0 }),
        parenquima: faker.number.float({ fractionDigits: 1, max: 2.2, min: 1.1 }),
      },
      ecogenicidad: pick(["Conservada", "Aumentada", "Disminuida"]),
      relacionCorticoMedular: pick(["Conservada", "Aumentada", "Disminuida"]),
      diagnostico: pick(["Riñones sin dilatacion pielocalicial", "Cambios parenquimatosos leves", "Relacion corticomedular conservada"]),
    },
  };
}

function buildLaboratorios(user) {
  return {
    ...audit(user),
    glicemiaCapilar: `${faker.number.int({ max: 180, min: 68 })} mg/dL`,
    grupoSanguineo: pick(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    otrosEstudios: [
      {
        nombre: "Hemoglobina",
        resultado: `${faker.number.float({ fractionDigits: 1, max: 17, min: 10 })} g/dL`,
      },
      {
        nombre: "Creatinina",
        resultado: `${faker.number.float({ fractionDigits: 2, max: 1.4, min: 0.5 })} mg/dL`,
      },
    ],
  };
}

function buildDiagnostico(user) {
  const principal = pick(enfermedades);
  const secundarios = faker.helpers.arrayElements(
    enfermedades.filter((enfermedad) => enfermedad.code !== principal.code),
    { max: 2, min: 1 },
  );

  return {
    ...audit(user),
    principal,
    secundarios,
    planTrabajo: pick([
      "Educacion sanitaria, control por consulta externa y seguimiento en centro de salud.",
      "Medidas higienico dieteticas, control de signos de alarma y reevaluacion.",
      "Solicitar control complementario segun disponibilidad y seguimiento medico.",
    ]),
  };
}

function buildUpdatedStationBefore(stationKey, after) {
  const before = clone(after);

  if (!before) {
    return before;
  }

  switch (stationKey) {
    case "anamnesis":
      before.motivoConsulta = "Control general durante campaña de salud";
      before.historiaEnfermedadActual = "Paciente acude para valoracion inicial.";
      if (before.antecedentesNoPatologicos) {
        before.antecedentesNoPatologicos.realizaActividadFisica = false;
      }
      break;
    case "examenFisicoGeneral":
      before.peso = rounded(Number(before.peso ?? 70) - 1.4, 1);
      before.imc = rounded(Number(before.imc ?? 24) - 0.4, 1);
      before.frecuenciaCardiaca = Math.max(
        55,
        Number(before.frecuenciaCardiaca ?? 75) - 4,
      );
      break;
    case "examenFisicoSegmentario":
      before.aparatoRespiratorio = "Murmullo vesicular conservado";
      before.abdomenPelvis = "Blando, depresible";
      break;
    case "ecografia":
      if (before.higado) {
        before.higado.diagnostico = "Pendiente de correlacion clinica";
      }
      if (before.vesiculaBiliar) {
        before.vesiculaBiliar.diagnostico = "Pendiente de informe final";
      }
      break;
    case "electrocardiograma":
      before.diagnostico = "Trazado pendiente de validacion";
      before.frecuenciaCardiaca = Math.max(
        55,
        Number(before.frecuenciaCardiaca ?? 75) - 5,
      );
      break;
    case "espirometria":
      before.diagnostico = "Maniobra pendiente de interpretacion";
      before.observaciones = ["Registro inicial"];
      break;
    case "laboratorios":
      before.glicemiaCapilar = `${faker.number.int({ max: 120, min: 70 })} mg/dL`;
      before.otrosEstudios = [];
      break;
    case "diagnostico":
      before.planTrabajo = "Pendiente de definir conducta final.";
      before.secundarios = [];
      break;
  }

  return before;
}

function buildUpdatedPatientBefore(paciente) {
  const before = clone(paciente);

  before.datosPersonales.nombres = faker.person.firstName(
    paciente.genero === "Femenino" ? "female" : "male",
  );
  before.nacionalidad = "Boliviana";

  return before;
}

function getIncompleteIndexes(count) {
  const incompleteCount = Math.max(1, Math.round(count * 0.05));
  const indexes = new Set();

  while (indexes.size < incompleteCount) {
    indexes.add(faker.number.int({ max: count, min: 1 }));
  }

  return indexes;
}

function omitRandomStations(historia) {
  const removableFields = [
    "examenFisicoGeneral",
    "examenFisicoSegmentario",
    "ecografia",
    "electrocardiograma",
    "espirometria",
    "laboratorios",
    "diagnostico",
  ];
  const fieldsToRemove = faker.helpers.arrayElements(removableFields, {
    max: 3,
    min: 1,
  });

  for (const field of fieldsToRemove) {
    delete historia[field];
  }

  return fieldsToRemove;
}

async function deleteSeedDocs(db) {
  const seedGroups = [
    { prefix: "actividad:seed:", type: "actividad" },
    { prefix: "historia:seed:", type: "historia" },
    { prefix: "paciente:seed:", type: "paciente" },
    { prefix: "viaje:seed:", type: "viaje" },
  ];
  const docsToDelete = [];

  await db.createIndex({
    index: {
      ddoc: "idx_type",
      fields: ["type"],
      name: "idx_type",
    },
  });

  for (const group of seedGroups) {
    let bookmark;

    do {
      const result = await db.find({
        bookmark,
        limit: 500,
        selector: {
          type: group.type,
        },
        use_index: "idx_type",
      });

      bookmark = result.bookmark;

      docsToDelete.push(
        ...result.docs
          .filter((doc) => doc._id?.startsWith(group.prefix))
          .map((doc) => ({
            _deleted: true,
            _id: doc._id,
            _rev: doc._rev,
          })),
      );

      if (result.docs.length < 500) {
        break;
      }
    } while (bookmark);
  }

  if (docsToDelete.length > 0) {
    await db.bulkDocs(docsToDelete);
  }

  return docsToDelete.length;
}

async function createPouchDb() {
  globalThis.self = globalThis.self ?? globalThis;

  const { default: PouchDB } = await import("pouchdb/dist/pouchdb.js");
  const { default: PouchDBFind } = await import("pouchdb-find");

  PouchDB.plugin(PouchDBFind);

  return new PouchDB(process.env.COUCHDB_URL);
}

loadEnvFile(path.join(process.cwd(), ".env"));

const count = Number.parseInt(getArg("count", String(DEFAULT_COUNT)), 10);
const seed = Number.parseInt(getArg("seed", String(DEFAULT_SEED)), 10);
const dryRun = hasFlag("dry-run");

if (!Number.isFinite(count) || count < 1) {
  throw new Error("--count debe ser un entero mayor a 0.");
}

if (!dryRun && !process.env.COUCHDB_URL) {
  throw new Error("COUCHDB_URL debe estar configurado.");
}

faker.seed(seed);

const usersByEmail = getUsersByEmail();
const assignments = getStationAssignments(usersByEmail);
const viaje = buildViaje(assignments);
const incompleteIndexes = getIncompleteIndexes(count);
const docs = [viaje];
const incompleteSummary = [];
let activityCount = 0;
let updateActivityCount = 0;

for (let index = 1; index <= count; index += 1) {
  const paciente = buildPaciente(index);
  const anamnesisUser = stationStudent(assignments, "Anamnesis", index);
  const efgUser = stationStudent(assignments, "Examen Físico General", index);
  const efsUser = stationStudent(assignments, "Examen Físico Segmentario", index);
  const ecografiaUser = stationStudent(assignments, "Ecografía", index);
  const electroUser = stationStudent(assignments, "Electrocardiograma", index);
  const espiroUser = stationStudent(assignments, "Espirometría", index);
  const labUser = stationStudent(assignments, "Laboratorios", index);
  const diagnosticoUser = stationStudent(assignments, "Diagnóstico", index);
  const anamnesisAssignment = stationAssignment(assignments, "Anamnesis");
  const historia = {
    _id: `historia:seed:${index}`,
    type: "historia",
    created_by: anamnesisUser.id,
    pacienteId: paciente._id,
    viajeId: viaje._id,
    examenesComplementariosSolicitados: {
      ecografia: true,
      laboratorios: true,
      espirometria: true,
      electrocardiograma: true,
    },
    anamnesis: buildAnamnesis(anamnesisUser, paciente),
    examenFisicoGeneral: buildExamenFisicoGeneral(efgUser),
    examenFisicoSegmentario: buildExamenFisicoSegmentario(efsUser),
    ecografia: buildEcografia(ecografiaUser, index),
    electrocardiograma: buildElectrocardiograma(electroUser),
    espirometria: buildEspirometria(espiroUser),
    laboratorios: buildLaboratorios(labUser),
    diagnostico: buildDiagnostico(diagnosticoUser),
  };

  if (incompleteIndexes.has(index)) {
    const removedFields = omitRandomStations(historia);
    incompleteSummary.push({
      historiaId: historia._id,
      removedFields,
    });
  }

  const stationActivities = [
    {
      assignment: anamnesisAssignment,
      field: "anamnesis",
      key: "anamnesis",
      user: anamnesisUser,
    },
    {
      assignment: stationAssignment(assignments, "Examen Físico General"),
      field: "examenFisicoGeneral",
      key: "examenFisicoGeneral",
      user: efgUser,
    },
    {
      assignment: stationAssignment(assignments, "Examen Físico Segmentario"),
      field: "examenFisicoSegmentario",
      key: "examenFisicoSegmentario",
      user: efsUser,
    },
    {
      assignment: stationAssignment(assignments, "Ecografía"),
      field: "ecografia",
      key: "ecografia",
      user: ecografiaUser,
    },
    {
      assignment: stationAssignment(assignments, "Electrocardiograma"),
      field: "electrocardiograma",
      key: "electrocardiograma",
      user: electroUser,
    },
    {
      assignment: stationAssignment(assignments, "Espirometría"),
      field: "espirometria",
      key: "espirometria",
      user: espiroUser,
    },
    {
      assignment: stationAssignment(assignments, "Laboratorios"),
      field: "laboratorios",
      key: "laboratorios",
      user: labUser,
    },
    {
      assignment: stationAssignment(assignments, "Diagnóstico"),
      field: "diagnostico",
      key: "diagnostico",
      user: diagnosticoUser,
    },
  ];
  const pacienteCreatedAt = seedTimestamp(index, 1);

  docs.push(
    buildActivity({
      action: "created",
      actorId: anamnesisUser.id,
      after: paciente,
      before: undefined,
      createdAt: pacienteCreatedAt,
      historia,
      id: activityId(index, "anamnesis", "created-paciente", 1),
      pacienteId: paciente._id,
      stationKey: "anamnesis",
      subject: "paciente",
      viajeId: viaje._id,
    }),
  );
  activityCount += 1;

  if (index % 4 === 0) {
    const beforePaciente = buildUpdatedPatientBefore(paciente);

    docs.push(
      buildActivity({
        action: "updated",
        actorId: anamnesisAssignment.docente.id,
        after: paciente,
        before: beforePaciente,
        createdAt: seedTimestamp(index, 3),
        historia,
        id: activityId(index, "anamnesis", "updated-paciente", 1),
        pacienteId: paciente._id,
        stationKey: "anamnesis",
        subject: "paciente",
        viajeId: viaje._id,
      }),
    );
    activityCount += 1;
    updateActivityCount += 1;
  }

  stationActivities.forEach((station, stationIndex) => {
    const stationValue = historia[station.field];

    if (!stationValue) {
      return;
    }

    docs.push(
      buildActivity({
        action: "created",
        actorId: station.user.id,
        after: stationValue,
        before: undefined,
        createdAt: seedTimestamp(index, 10 + stationIndex * 8),
        historia,
        id: activityId(index, station.key, "created", 1),
        pacienteId: paciente._id,
        stationKey: station.key,
        subject: "historia",
        viajeId: viaje._id,
      }),
    );
    activityCount += 1;

    if (index % 3 !== 0 && !maybe(0.18)) {
      return;
    }

    const updateActor =
      index % 5 === 0 ? station.assignment.docente : station.user;
    const beforeStation = buildUpdatedStationBefore(station.key, stationValue);

    stationValue.updated_by = updateActor.id;

    docs.push(
      buildActivity({
        action: "updated",
        actorId: updateActor.id,
        after: stationValue,
        before: beforeStation,
        createdAt: seedTimestamp(index, 14 + stationIndex * 8),
        historia,
        id: activityId(index, station.key, "updated", 1),
        pacienteId: paciente._id,
        stationKey: station.key,
        subject: "historia",
        viajeId: viaje._id,
      }),
    );
    activityCount += 1;
    updateActivityCount += 1;
  });

  docs.push(paciente, historia);
}

let removed = 0;

if (!dryRun) {
  const db = await createPouchDb();
  removed = await deleteSeedDocs(db);

  const response = await db.bulkDocs(docs);
  const failures = response.filter((item) => "error" in item);

  if (failures.length > 0) {
    console.error(failures);
    throw new Error(`No se pudieron guardar ${failures.length} documentos.`);
  }
}

console.log(
  JSON.stringify(
    {
      count,
      deletedSeedDocs: removed,
      dryRun,
      incompleteCount: incompleteIndexes.size,
      incompletePercent: `${Math.round((incompleteIndexes.size / count) * 100)}%`,
      incompleteSummary,
      insertedDocs: docs.length,
      seededActivities: activityCount,
      seededUpdateActivities: updateActivityCount,
      seed,
      stationKeys: stationKeyByTipo,
      stationFields: stationFieldByTipo,
      viajeId: viaje._id,
    },
    null,
    2,
  ),
);
