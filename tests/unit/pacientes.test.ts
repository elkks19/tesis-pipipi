import { describe, expect, test } from "vitest";

import { CreatePacienteSchema } from "../../src/lib/schema/pacientes";
import { firstFieldErrors } from "../../src/lib/schema/field-errors";

function patient(fechaNacimiento = "2000-05-10") {
  return {
    datosPersonales: {
      nombres: "Ana María",
      apellidoPaterno: "Quispe",
      apellidoMaterno: "",
      fechaNacimiento,
      documentoIdentidad: "CI",
      numeroDocumentoIdentidad: "1234567-1A",
    },
    genero: "Femenino",
    lugarNacimiento: { pais: "Bolivia", departamento: "La Paz" },
    nacionalidad: "Boliviana",
  };
}

function guardian(fechaNacimiento = "1980-01-01") {
  return {
    datosPersonales: {
      nombres: "Julia",
      apellidoPaterno: "Quispe",
      apellidoMaterno: "",
      fechaNacimiento,
      documentoIdentidad: "Pasaporte",
      numeroDocumentoIdentidad: "AB-12345",
    },
    relacion: "Madre",
    asumeSustento: false,
    numeroContacto: "+591 7654-3210",
  };
}

function errors(value: unknown) {
  const result = CreatePacienteSchema.safeParse(value);
  return result.success ? {} : firstFieldErrors(result.error);
}

describe("registro de pacientes", () => {
  test("acepta un adulto con segundo apellido vacío y fechas transformadas", () => {
    const result = CreatePacienteSchema.safeParse(patient());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.datosPersonales.fechaNacimiento).toBeInstanceOf(Date);
  });

  test("exige documento válido para adultos y menores", () => {
    expect(errors({ ...patient(), datosPersonales: { ...patient().datosPersonales, numeroDocumentoIdentidad: "" } })["datosPersonales.numeroDocumentoIdentidad"]).toBeTruthy();
    expect(errors({ ...patient("2015-01-01"), datosPersonales: { ...patient("2015-01-01").datosPersonales, numeroDocumentoIdentidad: "" }, padres: [guardian()] })["datosPersonales.numeroDocumentoIdentidad"]).toBeTruthy();
    expect(errors({ ...patient(), datosPersonales: { ...patient().datosPersonales, numeroDocumentoIdentidad: "ABCD" } })["datosPersonales.numeroDocumentoIdentidad"]).toBeTruthy();
    expect(CreatePacienteSchema.safeParse({ ...patient(), datosPersonales: { ...patient().datosPersonales, documentoIdentidad: "Pasaporte", numeroDocumentoIdentidad: "ABCD1234" } }).success).toBe(true);
  });

  test("rechaza fechas irreales, futuras y edades superiores a 125", () => {
    for (const fechaNacimiento of ["2023-02-30", "2999-01-01", "1800-01-01"]) {
      expect(errors(patient(fechaNacimiento))["datosPersonales.fechaNacimiento"]).toBeTruthy();
    }
  });

  test("exige responsable para menores y valida sus datos", () => {
    expect(errors(patient("2015-01-01")).padres).toBeTruthy();
    expect(CreatePacienteSchema.safeParse({ ...patient("2015-01-01"), padres: [guardian()] }).success).toBe(true);
    const tooYoung = guardian("2016-01-01");
    expect(errors({ ...patient("2015-01-01"), padres: [tooYoung] })["padres.0.datosPersonales.fechaNacimiento"]).toBeTruthy();
    expect(errors({ ...patient("2015-01-01"), padres: [{ ...guardian(), numeroContacto: "123" }] })["padres.0.numeroContacto"]).toBeTruthy();
  });

  test("conserva responsables ya registrados de un adulto", () => {
    expect(CreatePacienteSchema.safeParse({ ...patient(), padres: [guardian()] }).success).toBe(true);
  });

  test("requiere textos reales y muestra el primer error del campo", () => {
    const result = errors({ ...patient(), datosPersonales: { ...patient().datosPersonales, nombres: " ", apellidoPaterno: "123" }, lugarNacimiento: { pais: " ", departamento: "La Paz" } });
    expect(result["datosPersonales.nombres"]).toBe("El nombre es obligatorio.");
    expect(result["datosPersonales.apellidoPaterno"]).toContain("letra");
    expect(result["lugarNacimiento.pais"]).toBe("El país es obligatorio.");
  });
});
