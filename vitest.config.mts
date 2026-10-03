import { defineConfig } from "vitest/config";

// `.mts` é obrigatório neste repositório: as funções serverless em /api são
// CommonJS (require/module.exports) e não podem conviver com "type": "module".
// A extensão força o Vite a carregar este ficheiro como ESM nativo.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    },
  },
});
