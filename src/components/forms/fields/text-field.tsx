import type { ComponentProps } from "react";

import { Field } from "@/components/forms/fields/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TextFieldProps = Omit<
  ComponentProps<typeof Input>,
  "onChange" | "value"
> & {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function TextField({
  error,
  label,
  name,
  onChange,
  required,
  value,
  ...props
}: TextFieldProps) {
  return (
    <Field error={error}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
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
