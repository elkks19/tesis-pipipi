import { describe, expect, test } from "vitest";

import {
  InviteUserFormSchema,
  LoginFormSchema,
  PasswordSetupFormSchema,
  RegisterFormSchema,
} from "../../src/lib/schema/authForms";

describe("formularios de autenticacion", () => {
  test("login exige correo valido y contraseña", () => {
    expect(LoginFormSchema.safeParse({ email: "persona@universidad.edu", password: "secreto" }).success).toBe(true);
    expect(LoginFormSchema.safeParse({ email: "correo-invalido", password: "" }).success).toBe(false);
  });

  test("registro exige contraseña de 8 a 128 caracteres y confirmacion coincidente", () => {
    expect(RegisterFormSchema.safeParse({
      name: "Ana Perez",
      email: "ana@universidad.edu",
      password: "segura123",
      passwordConfirmation: "segura123",
    }).success).toBe(true);
    expect(RegisterFormSchema.safeParse({
      name: "Ana Perez",
      email: "ana@universidad.edu",
      password: "segura123",
      passwordConfirmation: "distinta123",
    }).success).toBe(false);
  });

  test("configuracion de contraseña comparte las mismas reglas", () => {
    expect(PasswordSetupFormSchema.safeParse({ password: "1234567", passwordConfirmation: "1234567" }).success).toBe(false);
    expect(PasswordSetupFormSchema.safeParse({ password: "12345678", passwordConfirmation: "12345678" }).success).toBe(true);
  });

  test("invitacion exige correo y rol", () => {
    expect(InviteUserFormSchema.safeParse({ email: "docente@universidad.edu", role: "docente" }).success).toBe(true);
    expect(InviteUserFormSchema.safeParse({ email: "", role: "" }).success).toBe(false);
  });
});
