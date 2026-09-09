"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const themeOptions = [
  {
    icon: SunIcon,
    label: "Claro",
    value: "light",
  },
  {
    icon: MoonIcon,
    label: "Oscuro",
    value: "dark",
  },
  {
    icon: MonitorIcon,
    label: "Sistema",
    value: "system",
  },
];

export function SidebarThemeMenuItems() {
  const { setTheme, theme = "system" } = useTheme();

  return (
    <>
      <DropdownMenuLabel>Tema de interfaz</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        onValueChange={(value) => {
          if (isThemeOption(value)) {
            setTheme(value);
          }
        }}
        value={theme}
      >
        {themeOptions.map((option) => {
          const Icon = option.icon;

          return (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <Icon />
              {option.label}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}

function isThemeOption(value: string): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}
