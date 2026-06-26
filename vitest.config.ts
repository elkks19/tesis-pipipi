import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      exclude: [
        ".next/**",
        "coverage/**",
        "data-science/**",
        "docs/**",
        "node_modules/**",
        "tests/**",
      ],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
    },
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
