"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const loginRedirectPath = "/";

function subscribeToHydration() {
  return () => {};
}

export function LoginForm() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const hasMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isEmailPending, setIsEmailPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const isCheckingSession = hasMounted && isSessionPending;

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const url = new URL(window.location.href);
    const sensitiveParams = ["password", "passwordConfirmation"];
    const hasSensitiveParam = sensitiveParams.some((param) =>
      url.searchParams.has(param),
    );

    if (hasSensitiveParam) {
      for (const param of sensitiveParams) {
        url.searchParams.delete(param);
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    if (session) {
      router.replace(loginRedirectPath);
    }
  }, [hasMounted, router, session]);

  async function handleEmailLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsEmailPending(true);

    try {
      const result = await authClient.signIn.email({
        callbackURL: loginRedirectPath,
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "No se pudo iniciar sesion.");
        return;
      }

      toast.success("Sesion iniciada correctamente.");
      router.replace(loginRedirectPath);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesion.",
      );
    } finally {
      setIsEmailPending(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setIsGooglePending(true);

    try {
      const result = await authClient.signIn.social({
        callbackURL: loginRedirectPath,
        provider: "google",
      });

      if (result.error) {
        setError(result.error.message ?? "No se pudo iniciar sesion con Google.");
        setIsGooglePending(false);
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesion con Google.",
      );
      setIsGooglePending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesion</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action="/login"
            className="flex flex-col gap-6"
            method="post"
            onSubmit={handleEmailLogin}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="email">Correo electronico</FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>

            <Button
              disabled={isEmailPending || isCheckingSession}
              type="submit"
            >
              {isEmailPending ? <Loader2Icon data-icon="inline-start" /> : null}
              Entrar
            </Button>
          </form>

          <FieldSeparator className="my-6">O</FieldSeparator>

          <Button
            className="w-full"
            disabled={isGooglePending || isCheckingSession}
            onClick={handleGoogleLogin}
            type="button"
            variant="outline"
          >
            {isGooglePending ? <Loader2Icon data-icon="inline-start" /> : null}
            Continuar con Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/register"
            >
              Crea una
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
