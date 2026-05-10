import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
};

export function Field({ children, className, error }: FieldProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-invalid={Boolean(error)}
    >
      {children}
      {error ? (
        <span className="text-xs leading-5 text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
