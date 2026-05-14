"use client";

import { type FormEvent, useEffect, useState } from "react";
import { KeyRoundIcon, Loader2Icon, MailCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function PasswordSetupGate() {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isCheckingAccounts, setIsCheckingAccounts] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [requiresGoogleLink, setRequiresGoogleLink] = useState(false);
  const [hasGoogleAccount, setHasGoogleAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkCredentialAccount() {
      if (!session) {
        setRequiresPassword(false);
        setRequiresGoogleLink(false);
        setHasGoogleAccount(false);
        return;
      }

      setIsCheckingAccounts(true);

      const result = await authClient.listAccounts();

      if (!isMounted) {
        return;
      }

      if (result.error) {
        toast.error(
          result.error.message ??
            "No se pudo verificar si tu cuenta tiene contrasena.",
        );
        setRequiresPassword(false);
        setRequiresGoogleLink(false);
        setHasGoogleAccount(false);
        setIsCheckingAccounts(false);
        return;
      }

      const providerIds =
        result.data?.map((account) => account.providerId) ?? [];
      const hasCredentialAccount = providerIds.includes("credential");
      const hasGoogleAccount = providerIds.includes("google");

      setHasGoogleAccount(hasGoogleAccount);
      setRequiresPassword(!hasCredentialAccount);
      setRequiresGoogleLink(hasCredentialAccount && !hasGoogleAccount);
      setIsCheckingAccounts(false);
    }

    void checkCredentialAccount();

    return () => {
      isMounted = false;
    };
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== passwordConfirmation) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      await authClient.$fetch("/set-password", {
        body: {
          newPassword: password,
        },
        method: "POST",
      });

      toast.success("Contraseña configurada correctamente.");
      setRequiresPassword(false);
      setRequiresGoogleLink(!hasGoogleAccount);
      setPassword("");
      setPasswordConfirmation("");
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "No se pudo configurar la contraseña.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkGoogle() {
    setError("");
    setIsLinkingGoogle(true);

    try {
      const callbackURL = `${window.location.pathname}${window.location.search}`;
      const result = (await authClient.$fetch("/link-social", {
        body: {
          callbackURL,
          provider: "google",
        },
        method: "POST",
      })) as { redirect?: boolean; status?: boolean; url?: string };

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      toast.success("Cuenta institucional vinculada.");
      setIsLinkingGoogle(false);
      setHasGoogleAccount(true);
      setRequiresGoogleLink(false);
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "No se pudo iniciar la vinculacion con Google.",
      );
      setIsLinkingGoogle(false);
    }
  }

  const shouldOpenPassword =
    Boolean(session) &&
    !isSessionPending &&
    !isCheckingAccounts &&
    requiresPassword;
  const shouldOpenGoogle =
    Boolean(session) &&
    !isSessionPending &&
    !isCheckingAccounts &&
    !requiresPassword &&
    requiresGoogleLink;

  return (
    <>
      <Dialog open={shouldOpenPassword} onOpenChange={() => undefined}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRoundIcon />
            </div>
            <DialogTitle>Configura una contrasena</DialogTitle>
            <DialogDescription>
              Esta cuenta ingreso con un proveedor externo. Para sincronizar con
              el servidor local del viaje necesitas una contrasena de acceso.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="password-setup-password">
                  Contrasena
                </FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="password-setup-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <FieldDescription>Usa al menos 8 caracteres.</FieldDescription>
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="password-setup-confirmation">
                  Confirmar contrasena
                </FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="password-setup-confirmation"
                  minLength={8}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  required
                  type="password"
                  value={passwordConfirmation}
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>

            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2Icon data-icon="inline-start" /> : null}
              Guardar contrasena
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={shouldOpenGoogle} onOpenChange={() => undefined}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <MailCheckIcon />
            </div>
            <DialogTitle>Vincula tu cuenta institucional</DialogTitle>
            <DialogDescription>
              Esta cuenta se creo con correo y contrasena. Vincula Google para
              mantener el acceso institucional y evitar cuentas duplicadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {error ? <FieldError>{error}</FieldError> : null}
            <Button disabled={isLinkingGoogle} onClick={handleLinkGoogle}>
              {isLinkingGoogle ? (
                <Loader2Icon data-icon="inline-start" />
              ) : null}
              Vincular con Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
