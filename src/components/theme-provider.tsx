"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  theme: Theme;
};

const STORAGE_KEY = "tesis-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    return readStoredTheme() ?? defaultTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return resolveTheme(readStoredTheme() ?? defaultTheme);
  });

  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function syncTheme() {
      const nextResolvedTheme = resolveTheme(theme);

      document.documentElement.classList.toggle(
        "dark",
        nextResolvedTheme === "dark",
      );
      document.documentElement.style.colorScheme = nextResolvedTheme;
      setResolvedTheme(nextResolvedTheme);
    }

    syncTheme();
    media.addEventListener("change", syncTheme);

    return () => media.removeEventListener("change", syncTheme);
  }, [theme]);

  const value = useMemo(
    () => ({
      resolvedTheme,
      setTheme: (nextTheme: Theme) => {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
        setThemeState(nextTheme);
      },
      theme,
    }),
    [resolvedTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider.");
  }

  return context;
}

function readStoredTheme() {
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(value) ? value : null;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}
