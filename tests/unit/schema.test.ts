import { describe, expect, test } from "vitest";

import { CreateViajeInventarioItemSchema } from "../../src/lib/schema/farmacia";
import { CreatePacienteSchema } from "../../src/lib/schema/pacientes";
import { CreateViajeSchema } from "../../src/lib/schema/viajes";

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

describe("esquemas clinicos y operativos", () => {
  test("farmacia: exige campos de estandarizacion para medicamentos", () => {
    const result = CreateViajeInventarioItemSchema.safeParse({
      cantidadPlanificada: 20,
      categoria: "medicamento",
      nombre: "Paracetamol",
      unidad: "tabletas",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("El medicamento incompleto no debia ser valido");
    }

    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "principioActivo",
      "concentracion",
      "formaFarmaceutica",
    ]);
  });

  test("farmacia: permite insumos sin campos farmacologicos", () => {
    const result = CreateViajeInventarioItemSchema.safeParse({
      cantidadPlanificada: 50,
      categoria: "insumo",
      nombre: "Guantes",
      unidad: "pares",
    });

    expect(result.success).toBe(true);
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

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("El paciente completo debia ser valido");
    }

    expect(result.data.datosPersonales.fechaNacimiento).toBeInstanceOf(Date);
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

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("El viaje con estaciones duplicadas no debia ser valido");
    }

    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("Cada tipo de estacion"),
      ),
    ).toBe(true);
  });
});
