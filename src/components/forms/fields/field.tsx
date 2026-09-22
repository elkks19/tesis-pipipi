import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  name?: string;
  warning?: string;
};

export function Field({ children, className, error, name, warning }: FieldProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-invalid={Boolean(error)}
    >
      {children}
      {error ? (
        <span className="text-xs leading-5 text-destructive" id={name ? `${name}-error` : undefined} role="alert">{error}</span>
      ) : null}
      {!error && warning ? <span className="text-xs leading-5 text-amber-700" id={name ? `${name}-warning` : undefined}>{warning}</span> : null}
    </div>
  );
}
