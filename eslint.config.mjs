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
        HTMLFormElement: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        URL: "readonly",
        FormData: "readonly",
        fetch: "readonly",
        window: "readonly",
        Buffer: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        // Globais da Web Crypto, disponíveis no runtime do Next.js (Node e edge).
        crypto: "readonly",
      },
    },
    rules: {
      "no-console": "warn",
      "no-undef": "error",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "legacy/**"]),
]);
