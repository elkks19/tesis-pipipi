import type { ComponentProps } from "react";

import { Field } from "@/components/forms/fields/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps = Omit<
  ComponentProps<typeof Textarea>,
  "onChange" | "value"
> & {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function TextareaField({
  error,
  label,
  name,
  onChange,
  required,
  value,
  ...props
}: TextareaFieldProps) {
  return (
    <Field error={error}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Textarea
        aria-invalid={Boolean(error)}
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
        {...props}
      />
    </Field>
  );
}
