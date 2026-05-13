import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesion",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getSafeNextPath(next: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/estudiante";
  }

  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackURL = getSafeNextPath(getParam(params.next));

  return <LoginForm callbackURL={callbackURL} />;
}
