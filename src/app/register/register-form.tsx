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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { RegisterFormSchema } from "@/lib/schema/authForms";

type RegisterFormProps = {
  callbackURL: string;
};

function subscribeToHydration() {
  return () => {};
}

const clientState = { ok: false };

export function RegisterForm({ callbackURL }: RegisterFormProps) {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    useHydratedSession();
  const hasMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const isCheckingSession = hasMounted && isSessionPending;
  const formValue = { name, email, password, passwordConfirmation };
  const validation = RegisterFormSchema.safeParse(formValue);
  const { visibleErrors, onBlurCapture, revealErrors } = useInteractiveErrors({
    value: formValue,
    actionState: clientState,
    isPending,
    validationError: validation.success ? undefined : validation.error,
  });

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (session) {
      router.replace(callbackURL);
    }
  }, [callbackURL, hasMounted, router, session]);

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (revealErrors(event)) return;
    setError("");

    setIsPending(true);

    try {
      const result = await authClient.signUp.email({
        callbackURL,
        email,
        name,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "No se pudo crear la cuenta.");
        return;
      }

      toast.success("Cuenta creada correctamente.");
      router.replace(callbackURL);
    } finally {
      setIsPending(false);
    }
  }

  async function handleGoogleRegister() {
    setError("");
    setIsGooglePending(true);

    try {
      const result = await authClient.signIn.social({
        callbackURL,
        provider: "google",
      });

      if (result.error) {
        setError(result.error.message ?? "No se pudo continuar con Google.");
        setIsGooglePending(false);
      }
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "No se pudo continuar con Google.",
      );
      setIsGooglePending(false);
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(callbackURL)}`;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" noValidate onBlurCapture={onBlurCapture} onSubmit={handleRegister}>
            <FieldGroup>
              <Field data-invalid={Boolean(visibleErrors.name)}>
                <FieldLabel htmlFor="name">Nombre completo</FieldLabel>
                <Input
                  autoComplete="name"
                  aria-describedby={visibleErrors.name ? "register-name-error" : undefined}
                  aria-invalid={Boolean(visibleErrors.name)}
                  id="name"
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
                <FieldError id="register-name-error">{visibleErrors.name}</FieldError>
              </Field>
              <Field data-invalid={Boolean(visibleErrors.email)}>
                <FieldLabel htmlFor="email">Correo electronico</FieldLabel>
                <Input
                  autoComplete="email"
                  aria-describedby={visibleErrors.email ? "register-email-error" : undefined}
                  aria-invalid={Boolean(visibleErrors.email)}
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
                <FieldError id="register-email-error">{visibleErrors.email}</FieldError>
              </Field>
              <Field data-invalid={Boolean(visibleErrors.password)}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  autoComplete="new-password"
                  aria-describedby={visibleErrors.password ? "register-password-error" : undefined}
                  aria-invalid={Boolean(visibleErrors.password)}
                  id="password"
                  minLength={8}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <FieldDescription>Usa al menos 8 caracteres.</FieldDescription>
                <FieldError id="register-password-error">{visibleErrors.password}</FieldError>
              </Field>
              <Field data-invalid={Boolean(error || visibleErrors.passwordConfirmation)}>
                <FieldLabel htmlFor="passwordConfirmation">
                  Confirmar contraseña
                </FieldLabel>
                <Input
                  autoComplete="new-password"
                  aria-describedby={error || visibleErrors.passwordConfirmation ? "register-confirmation-error" : undefined}
                  aria-invalid={Boolean(error || visibleErrors.passwordConfirmation)}
                  id="passwordConfirmation"
                  minLength={8}
                  name="passwordConfirmation"
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  required
                  type="password"
                  value={passwordConfirmation}
                />
                <FieldError id="register-confirmation-error">{visibleErrors.passwordConfirmation ?? error}</FieldError>
              </Field>
            </FieldGroup>

            <Button disabled={isPending || isCheckingSession} type="submit">
              {isPending ? <Loader2Icon data-icon="inline-start" /> : null}
              Crear cuenta
            </Button>
          </form>

          <FieldSeparator className="my-6">O</FieldSeparator>

          <Button
            className="w-full"
            disabled={isGooglePending || isCheckingSession}
            onClick={handleGoogleRegister}
            type="button"
            variant="outline"
          >
            {isGooglePending ? <Loader2Icon data-icon="inline-start" /> : null}
            Continuar con Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link className="font-medium text-foreground underline" href={loginHref}>
              Inicia sesion
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
