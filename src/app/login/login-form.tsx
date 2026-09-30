"use client";

import Link from "next/link";
import Image from "next/image";
import loginImage from "../../../public/login.png";
import { type SubmitEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, Loader2Icon, LockKeyholeIcon, MailIcon, StethoscopeIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import styles from "./login.module.css";
import { useRaspberryEnvironment } from "@/components/auth/environment-context";
import { authClient } from "@/lib/auth-client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { LoginFormSchema } from "@/lib/schema/authForms";

const loginRedirectPath = "/";
const clientState = { ok: false };

function subscribeToHydration() {
  return () => {};
}

export function LoginForm() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } =
    useHydratedSession();
  const hasMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const raspberry = useRaspberryEnvironment();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isEmailPending, setIsEmailPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isCheckingSession = hasMounted && isSessionPending;
  const formValue = { email, password };
  const validation = LoginFormSchema.safeParse(formValue);
  const { visibleErrors, onBlurCapture, revealErrors } = useInteractiveErrors({
    value: formValue,
    actionState: clientState,
    isPending: isEmailPending,
    validationError: validation.success ? undefined : validation.error,
  });

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
    if (revealErrors(event)) return;
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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel} aria-labelledby="login-title">
          <div className={styles.brand}>
            <div><p className={styles.brandName}>UNIFRANZ</p><p className={styles.brandCareer}>Carrera de Medicina</p></div>
          </div>
          <div className={styles.formContent}>
            <p className={styles.eyebrow}>Sistema de atención clínica</p>
            <h1 id="login-title" className={styles.heading}>Bienvenido<br />de nuevo.</h1>
            <p className={styles.intro}>Ingresa a tu espacio de aprendizaje y atención.</p>
          <form
            action="/login"
            className="flex flex-col gap-6"
            method="post"
            noValidate
            onBlurCapture={onBlurCapture}
            onSubmit={handleEmailLogin}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(visibleErrors.email)}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <InputGroup className="h-12 rounded-xl">
                <InputGroupAddon><MailIcon aria-hidden="true" /></InputGroupAddon>
                <InputGroupInput
                  autoComplete="email"
                  aria-describedby={visibleErrors.email ? "login-email-error" : undefined}
                  aria-invalid={Boolean(visibleErrors.email)}
                  id="email"
                  name="email"
                  placeholder="tu.correo@ejemplo.com"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
                </InputGroup>
                <FieldError id="login-email-error">{visibleErrors.email}</FieldError>
              </Field>
              <Field data-invalid={Boolean(error || visibleErrors.password)}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <InputGroup className="h-12 rounded-xl">
                <InputGroupAddon><LockKeyholeIcon aria-hidden="true" /></InputGroupAddon>
                <InputGroupInput
                  autoComplete="current-password"
                  aria-describedby={error || visibleErrors.password ? "login-password-error" : undefined}
                  aria-invalid={Boolean(error || visibleErrors.password)}
                  id="password"
                  name="password"
                  placeholder="Ingresa tu contraseña"
                  onChange={(event) => { setPassword(event.target.value); setError(""); }}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <InputGroupAddon align="inline-end"><InputGroupButton type="button" size="icon-sm" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</InputGroupButton></InputGroupAddon>
                </InputGroup>
                <FieldError id="login-password-error">{visibleErrors.password ?? error}</FieldError>
              </Field>
            </FieldGroup>

            <Button
              className="h-12 w-full rounded-xl"
              disabled={isEmailPending || isCheckingSession}
              type="submit"
            >
              {isEmailPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              {isEmailPending ? "Ingresando…" : isCheckingSession ? "Verificando sesión…" : "Iniciar sesión"}
              {!isEmailPending && !isCheckingSession ? <ArrowRightIcon data-icon="inline-end" /> : null}
            </Button>
          </form>

          {raspberry ? <p className="mt-4 text-sm text-muted-foreground">Usa tu contraseña sincronizada. Las cuentas y contraseñas se administran en la nube.</p> : <p className={styles.register}>
            ¿Aún no tienes una cuenta?{" "}
            <Link
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
              href="/register"
            >
              Regístrate
            </Link>
          </p>}
          </div>
          <p className={styles.footer}>Formación médica con compromiso humano.</p>
        </section>
        <aside className={styles.visualPanel} aria-label="Medicina UNIFRANZ">
          <Image src={loginImage} alt="Profesional de medicina frente a una interfaz de tecnología clínica" fill sizes="(max-width: 767px) 100vw, 55vw" preload className={styles.medicalImage} />
          <div className={styles.imageShade} />
          <div className={styles.visualTop}><StethoscopeIcon size={20} aria-hidden="true" /><span>Medicina · UNIFRANZ</span></div>
          <div className={styles.visualCopy}>
            <span className={styles.accentLine} aria-hidden="true" />
            <p className={styles.visualEyebrow}>Conocimiento que se convierte en cuidado</p>
            <h2>Aprender para<br /><span>transformar vidas.</span></h2>
            <p className={styles.visualDescription}>Un espacio para acompañar cada atención, conectar al equipo y poner a las personas en el centro.</p>
          </div>
          <p className={styles.visualFooter}>Universidad Franz Tamayo <span>Medicina</span></p>
        </aside>
      </div>
    </main>
  );
}
