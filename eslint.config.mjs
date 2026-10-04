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
        clearTimeout: "readonly",
        // Tópico 4A — o briefing grava áudio e envia ficheiros do browser.
        // Declarar os globais um a um é o padrão do projecto: um `/* global */`
        // em cada ficheiro seria mais fácil de errar.
        File: "readonly",
        Blob: "readonly",
        navigator: "readonly",
        MediaRecorder: "readonly",
        MediaStream: "readonly",
        MediaStreamTrack: "readonly",
        HTMLInputElement: "readonly",
        HTMLAudioElement: "readonly",
        AbortController: "readonly",
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
