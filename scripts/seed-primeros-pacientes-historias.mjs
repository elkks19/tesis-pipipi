import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function enfermedad(code, iNo, title) {
  return { code, iNo, title };
}

const gastritis = enfermedad(
  "DA63",
  "http://id.who.int/icd/entity/1179281178",
  "Gastritis",
);
const reflujo = enfermedad(
  "DA42",
  "http://id.who.int/icd/entity/1437305011",
  "Reflujo gastroesofagico",
);
const hipertension = enfermedad(
  "BA00",
  "http://id.who.int/icd/entity/1937318563",
  "Hipertension esencial",
);
const dislipidemia = enfermedad(
  "5B7Z",
  "http://id.who.int/icd/entity/202538872",
  "Dislipidemia",
);

const profiles = [
  [
    {
      attendedAt: "2025-08-18T09:20:00.000-04:00",
      motivo: "Dolor epigastrico y acidez despues de las comidas",
      evolucion:
        "Cuadro de tres meses de evolucion con ardor epigastrico posprandial, distension abdominal y nausea ocasional. Niega hematemesis, melena y perdida de peso.",
      personal: gastritis,
      tratamiento: "Omeprazol 20 mg por via oral y medidas higienico-dieteticas.",
      presion: { sistolica: 118, diastolica: 76 },
      frecuenciaCardiaca: 74,
      peso: 64,
      talla: 1.66,
      imc: 23.2,
      glicemia: "91 mg/dL",
      grupoSanguineo: "O+",
      principal: gastritis,
      secundarios: [],
      plan: "Evitar irritantes gastricos, fraccionar comidas y realizar control clinico en cuatro semanas.",
    },
    {
      attendedAt: "2026-02-09T10:10:00.000-04:00",
      motivo: "Control por persistencia de pirosis nocturna",
      evolucion:
        "Refiere mejoria del dolor epigastrico, pero persiste pirosis dos veces por semana al acostarse. No presenta signos de alarma digestiva.",
      personal: reflujo,
      tratamiento: "Omeprazol 20 mg antes del desayuno por cuatro semanas.",
      presion: { sistolica: 116, diastolica: 74 },
      frecuenciaCardiaca: 72,
      peso: 63.5,
      talla: 1.66,
      imc: 23,
      glicemia: "89 mg/dL",
      grupoSanguineo: "O+",
      principal: reflujo,
      secundarios: [gastritis],
      plan: "Continuar tratamiento, elevar cabecera, evitar cenas tardias y reevaluar en seis semanas.",
    },
  ],
  [
    {
      attendedAt: "2025-09-02T08:45:00.000-04:00",
      motivo: "Cefalea occipital y control de presion arterial",
      evolucion:
        "Presenta cefalea opresiva intermitente y cifras elevadas de presion registradas en domicilio durante dos semanas. Niega dolor toracico, disnea y deficit neurologico.",
      personal: hipertension,
      tratamiento: "Inicio de medidas no farmacologicas y control domiciliario de presion.",
      presion: { sistolica: 158, diastolica: 96 },
      frecuenciaCardiaca: 82,
      peso: 82,
      talla: 1.7,
      imc: 28.4,
      glicemia: "106 mg/dL",
      grupoSanguineo: "A+",
      principal: hipertension,
      secundarios: [],
      plan: "Reducir sodio, registrar presion dos veces al dia y acudir a control medico en siete dias.",
    },
    {
      attendedAt: "2026-03-16T11:30:00.000-04:00",
      motivo: "Seguimiento de hipertension arterial",
      evolucion:
        "Acude con registro domiciliario. Refiere buena adherencia al tratamiento y menor frecuencia de cefalea. Niega efectos adversos y signos de alarma.",
      personal: hipertension,
      tratamiento: "Lisinopril 10 mg por via oral cada 24 horas.",
      presion: { sistolica: 136, diastolica: 84 },
      frecuenciaCardiaca: 76,
      peso: 80.8,
      talla: 1.7,
      imc: 28,
      glicemia: "101 mg/dL",
      grupoSanguineo: "A+",
      principal: hipertension,
      secundarios: [dislipidemia],
      plan: "Mantener tratamiento, actividad fisica progresiva y solicitar perfil lipidico de control en tres meses.",
    },
  ],
];

function buildHistoria({ patientId, profile, viajeId }) {
  const presion = {
    max: profile.presion.sistolica,
    min: profile.presion.diastolica,
  };

  return {
    type: "historia",
    createdAt: profile.attendedAt,
    updatedAt: profile.attendedAt,
    pacienteId: patientId,
    ...(viajeId ? { viajeId } : {}),
    examenesComplementariosSolicitados: {
      ecografia: false,
      electrocardiograma: false,
      espirometria: false,
      laboratorios: true,
    },
    anamnesis: {
      estadoCivil: "Soltero",
      nivelEducativo: "Secundaria concluida",
      añosCursados: 12,
      situacionLaboral: "Independiente",
      motivoConsulta: profile.motivo,
      historiaEnfermedadActual: profile.evolucion,
      antecedentesNoPatologicos: {
        habitoTabaquico: "Nunca fumo",
        consumoAlcohol: "No consume alcohol",
        realizaActividadFisica: true,
        consumoFrutasVerduras: "3 - 4 porciones al día",
      },
      antecedentesPatologicos: {
        personales: [
          {
            enfermedad: profile.personal,
            fechaDiagnostico: "2024-04-15T00:00:00.000Z",
            tratamiento: profile.tratamiento,
          },
        ],
        familiares: [
          {
            parentesco: "Madre",
            enfermedad: hipertension,
            edadDiagnostico: 52,
            fallecimiento: false,
          },
        ],
      },
    },
    examenFisicoGeneral: {
      presionArterial: { derecha: presion, izquierda: presion },
      presionArterialMedia: Math.round(
        (profile.presion.sistolica + profile.presion.diastolica * 2) / 3,
      ),
      pulsos: profile.frecuenciaCardiaca,
      frecuenciaRespiratoria: 18,
      frecuenciaCardiaca: profile.frecuenciaCardiaca,
      temperaturaAxilar: 36.5,
      peso: profile.peso,
      talla: profile.talla,
      imc: profile.imc,
      perimetroCadera: 98,
      perimetroCintura: 88,
      indiceCinturaCadera: 0.9,
      diagnosticoIMC: profile.imc >= 25 ? "Sobrepeso" : "No tiene desnutrición",
    },
    examenFisicoSegmentario: {
      cabeza: "Normocefalo, mucosas hidratadas.",
      cuello: "Movil, sin adenopatias ni ingurgitacion yugular.",
      aparatoRespiratorio: "Murmullo vesicular conservado, sin ruidos agregados.",
      aparatoCardiovascular: "Ruidos cardiacos ritmicos, sin soplos audibles.",
      abdomenPelvis: "Blando, depresible, sin signos de irritacion peritoneal.",
      aparatoGenitourinario: "Sin hallazgos patologicos referidos.",
      pielFaneras: "Piel normocoloreada, sin lesiones activas.",
      sistemaHemolinfopoyetico: "Sin adenopatias palpables.",
      aparatoOsteoartromuscular: "Fuerza y movilidad conservadas.",
      sistemaNerviosoCentral: "Consciente, orientado, sin deficit focal.",
    },
    laboratorios: {
      glicemiaCapilar: profile.glicemia,
      grupoSanguineo: profile.grupoSanguineo,
      otrosEstudios: [
        { nombre: "Hemoglobina", resultado: "14.2 g/dL" },
        { nombre: "Creatinina", resultado: "0.9 mg/dL" },
      ],
    },
    diagnostico: {
      principal: profile.principal,
      secundarios: profile.secundarios,
      planTrabajo: profile.plan,
    },
  };
}

function patientName(patient) {
  const data = patient.datosPersonales ?? {};
  return [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
    .filter(Boolean)
    .join(" ");
}

loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.COUCHDB_URL) {
  throw new Error("COUCHDB_URL debe estar configurado.");
}

globalThis.self = globalThis.self ?? globalThis;
const { default: PouchDB } = await import("pouchdb/dist/pouchdb.js");
const { default: PouchDBFind } = await import("pouchdb-find");
PouchDB.plugin(PouchDBFind);

const db = new PouchDB(process.env.COUCHDB_URL);
await db.createIndex({
  index: {
    ddoc: "idx_pacientes_listado",
    fields: ["type", "_id"],
    name: "idx_pacientes_listado",
  },
});
await db.createIndex({
  index: {
    ddoc: "idx_demo_viajes_listado",
    fields: ["type", "_id"],
    name: "idx_demo_viajes_listado",
  },
});

const [patientResult, tripResult] = await Promise.all([
  db.find({
    limit: 2,
    selector: { type: "paciente" },
    sort: [{ type: "asc" }, { _id: "asc" }],
    use_index: "idx_pacientes_listado",
  }),
  db.find({
    limit: 2,
    selector: { type: "viaje" },
    sort: [{ type: "asc" }, { _id: "asc" }],
    use_index: "idx_demo_viajes_listado",
  }),
]);

if (patientResult.docs.length < 2) {
  throw new Error("Se necesitan al menos dos pacientes registrados.");
}

const patientUpdates = patientResult.docs
  .map((patient, index) => {
    const createdAt =
      patient.createdAt ??
      new Date(
        new Date(profiles[index][0].attendedAt).getTime() - 24 * 60 * 60 * 1000,
      ).toISOString();

    return {
      ...patient,
      createdAt,
      updatedAt: patient.updatedAt ?? createdAt,
    };
  });
const patientUpdateResponse = await db.bulkDocs(patientUpdates);
const patientUpdateFailures = patientUpdateResponse.filter(
  (item) => "error" in item,
);

if (patientUpdateFailures.length > 0) {
  console.error(patientUpdateFailures);
  throw new Error(
    `No se pudieron actualizar ${patientUpdateFailures.length} pacientes demo.`,
  );
}

const docs = [];
for (const [patientIndex, patient] of patientResult.docs.entries()) {
  for (const [visitIndex, profile] of profiles[patientIndex].entries()) {
    const _id = `historia:demo-primeros-pacientes:${patientIndex + 1}:${visitIndex + 1}`;
    const existing = await db.get(_id).catch((error) => {
      if (error?.status === 404) return null;
      throw error;
    });

    docs.push({
      _id,
      ...(existing?._rev ? { _rev: existing._rev } : {}),
      ...buildHistoria({
        patientId: patient._id,
        profile,
        viajeId: tripResult.docs[visitIndex]?._id,
      }),
    });
  }
}

const response = await db.bulkDocs(docs);
const failures = response.filter((item) => "error" in item);
if (failures.length > 0) {
  console.error(failures);
  throw new Error(`No se pudieron guardar ${failures.length} historias demo.`);
}

console.log(
  JSON.stringify(
    {
      historiasGuardadas: docs.length,
      pacientes: patientResult.docs.map((patient) => ({
        id: patient._id,
        nombre: patientName(patient),
      })),
    },
    null,
    2,
  ),
);
