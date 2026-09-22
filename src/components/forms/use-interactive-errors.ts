"use client";

import { useCallback, useState, type FocusEvent, type FormEvent } from "react";
import type { ZodError } from "zod";

import { firstFieldErrors } from "@/lib/schema/field-errors";

type ActionState = { ok: boolean; errors?: Record<string, string> };

export function useInteractiveErrors<T extends object, S extends ActionState>({
  value,
  actionState,
  isPending,
  validationError,
}: {
  value: T;
  actionState: S;
  isPending: boolean;
  validationError?: ZodError;
}) {
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<{ value: T; actionState: S } | null>(null);
  const errors = validationError ? firstFieldErrors(validationError) : {};
  const serverErrors = submission?.value === value && submission.actionState !== actionState
    ? actionState.errors ?? {}
    : {};
  const visibleErrors = Object.fromEntries(
    Object.entries({ ...serverErrors, ...errors }).filter(
      ([path]) => !isPending && !actionState.ok && (submitted || touched.has(path)),
    ),
  );

  function onBlurCapture(event: FocusEvent<HTMLFormElement>) {
    const control = event.target as HTMLElement;
    const path = control.getAttribute("name") || control.id;
    if (path) setTouched((current) => new Set(current).add(path));
  }

  function focusFirstError(form: HTMLFormElement) {
    const firstPath = Object.keys(errors)[0];
    if (firstPath) {
      requestAnimationFrame(() => {
        const invalid = Array.from(form.querySelectorAll<HTMLElement>('[aria-invalid="true"]'))
          .find((element) => element.getClientRects().length > 0);
        const named = Array.from(form.elements).find(
          (element) => element.getAttribute("name") === firstPath || element.id === firstPath,
        );
        (invalid ?? (named as HTMLElement | undefined))?.focus();
      });
    }
  }

  function revealErrors(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    if (!validationError) {
      setSubmission({ value, actionState });
      return false;
    }

    event.preventDefault();
    focusFirstError(event.currentTarget);
    return true;
  }

  function clearTouched(prefix: string) {
    setTouched((current) => new Set([...current].filter((path) => !path.startsWith(prefix))));
  }

  const resetErrors = useCallback(() => {
    setTouched(new Set());
    setSubmitted(false);
    setSubmission(null);
  }, []);

  return {
    visibleErrors, onBlurCapture, revealErrors, clearTouched, resetErrors,
    showAllErrors: (form?: HTMLFormElement | null) => {
      setSubmitted(true);
      if (form && validationError) focusFirstError(form);
    },
    showWarning: (path: string) => !isPending && !actionState.ok && (submitted || touched.has(path)),
  };
}
