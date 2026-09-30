import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | Medicina UNIFRANZ",
};

export default function LoginPage() {
  return <LoginForm />;
}
