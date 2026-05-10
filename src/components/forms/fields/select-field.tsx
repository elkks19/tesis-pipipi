import { Field } from "@/components/forms/fields/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SelectFieldProps<T extends string> = {
  error?: string;
  label: string;
  name: string;
  onChange: (value: T) => void;
  options: readonly T[];
  placeholder?: string;
  required?: boolean;
  value?: T | "";
};

export function SelectField<T extends string>({
  error,
  label,
  name,
  onChange,
  options,
  placeholder = "Seleccione una opcion",
  required,
  value,
}: SelectFieldProps<T>) {
  return (
    <Field error={error}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select
        name={name}
        onValueChange={(nextValue) => onChange(nextValue as T)}
        required={required}
        value={value ?? ""}
      >
        <SelectTrigger aria-invalid={Boolean(error)} id={name}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
