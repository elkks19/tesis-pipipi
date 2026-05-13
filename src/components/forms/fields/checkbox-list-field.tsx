import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { Field } from "./field";

type CheckboxListFieldProps<T extends string> = {
  label: string;
  name: string;
  onChange: (value: T[]) => void;
  options: readonly T[];
  value: T[];
};

export function CheckboxListField<T extends string>({
  label,
  name,
  onChange,
  options,
  value,
}: CheckboxListFieldProps<T>) {
  function toggle(option: T, checked: boolean) {
    onChange(
      checked
        ? [...value, option]
        : value.filter((current) => current !== option),
    );
  }

  return (
    <Field>
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            className="flex min-h-10 items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm"
            key={option}
          >
            <Checkbox
              checked={value.includes(option)}
              name={name}
              onCheckedChange={(nextValue) =>
                toggle(option, nextValue === true)
              }
              value={option}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}
