import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
      globals: {
        process: "readonly",
        HTMLButtonElement: "readonly",
        Request: "readonly",
        FormData: "readonly",
        fetch: "readonly",
        window: "readonly",
        Buffer: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-console": "warn",
      "no-undef": "error",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "legacy/**"]),
]);
