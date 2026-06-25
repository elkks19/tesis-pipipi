import assert from "node:assert/strict";
import test from "node:test";

import { CreateViajeInventarioItemSchema } from "../../src/lib/schema/farmacia.ts";
import { CreatePacienteSchema } from "../../src/lib/schema/pacientes.ts";
import { CreateViajeSchema } from "../../src/lib/schema/viajes.ts";

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

test("farmacia: exige campos de estandarizacion para medicamentos", () => {
  const result = CreateViajeInventarioItemSchema.safeParse({
    cantidadPlanificada: 20,
    categoria: "medicamento",
    nombre: "Paracetamol",
    unidad: "tabletas",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["principioActivo", "concentracion", "formaFarmaceutica"],
  );
});

test("farmacia: permite insumos sin campos farmacologicos", () => {
  const result = CreateViajeInventarioItemSchema.safeParse({
    cantidadPlanificada: 50,
    categoria: "insumo",
    nombre: "Guantes",
    unidad: "pares",
  });

  assert.equal(result.success, true);
});

test("pacientes: transforma fecha de nacimiento a Date", () => {
  const result = CreatePacienteSchema.safeParse({
    datosPersonales: {
      apellidoMaterno: "Quispe",
      apellidoPaterno: "Mamani",
      documentoIdentidad: "CI",
      fechaNacimiento: "2010-05-10",
      nombres: "Ana",
      numeroDocumentoIdentidad: "1234567",
    },
    genero: "Femenino",
    lugarNacimiento: {
      departamento: "La Paz",
      pais: "Bolivia",
    },
    nacionalidad: "Boliviana",
  });

  assert.equal(result.success, true);
  assert.ok(result.data.datosPersonales.fechaNacimiento instanceof Date);
});

test("viajes: rechaza estaciones duplicadas", () => {
  const result = CreateViajeSchema.safeParse({
    establecimiento: {
      nombre: "Centro de Salud",
    },
    estaciones: [
      {
        docenteEncargado: "docente-1",
        estudiantes: ["estudiante-1"],
        tipo: "Anamnesis",
      },
      {
        docenteEncargado: "docente-2",
        estudiantes: ["estudiante-2"],
        tipo: "Anamnesis",
      },
    ],
    fechaEntrada: tomorrow,
    fechaSalida: dayAfterTomorrow,
    servicio: "Campana rural",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((issue) =>
      issue.message.includes("Cada tipo de estacion"),
    ),
  );
});
