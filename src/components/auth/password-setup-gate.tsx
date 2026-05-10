"use client";

import { type FormEvent, useEffect, useState } from "react";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkCredentialAccount() {
      if (!session) {
        setRequiresPassword(false);
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
        setIsCheckingAccounts(false);
        return;
      }

      const hasCredentialAccount =
        result.data?.some((account) => account.providerId === "credential") ??
        false;

      setRequiresPassword(!hasCredentialAccount);
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

  const shouldOpen =
    Boolean(session) &&
    !isSessionPending &&
    !isCheckingAccounts &&
    requiresPassword;

  return (
    <Dialog open={shouldOpen} onOpenChange={() => undefined}>
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
  );
}
