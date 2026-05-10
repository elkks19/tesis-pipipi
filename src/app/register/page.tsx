import type { Metadata } from "next";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

type RegisterPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getSafeNextPath(next: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/estudiante/anamnesis/create-historia";
  }

  return next;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const callbackURL = getSafeNextPath(getParam(params.next));

  return <RegisterForm callbackURL={callbackURL} />;
}
