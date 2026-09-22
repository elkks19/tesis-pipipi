import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z.string().trim().min(1, "Ingresa el correo electronico").email("Ingresa un correo valido"),
  password: z.string().min(1, "Ingresa la contraseña").max(128, "La contraseña no puede superar 128 caracteres"),
});

export const RegisterFormSchema = LoginFormSchema.extend({
  name: z.string().trim().min(2, "Ingresa el nombre completo").max(100, "El nombre no puede superar 100 caracteres"),
  password: z.string().min(8, "Usa al menos 8 caracteres").max(128, "La contraseña no puede superar 128 caracteres"),
  passwordConfirmation: z.string(),
}).refine((value) => value.password === value.passwordConfirmation, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirmation"],
});

export const PasswordSetupFormSchema = z.object({
  password: z.string().min(8, "Usa al menos 8 caracteres").max(128, "La contraseña no puede superar 128 caracteres"),
  passwordConfirmation: z.string(),
}).refine((value) => value.password === value.passwordConfirmation, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirmation"],
});

export const InviteUserFormSchema = z.object({
  email: z.string().trim().min(1, "Ingresa el correo electronico").email("Ingresa un correo valido"),
  role: z.string().trim().min(1, "Selecciona un rol"),
});
