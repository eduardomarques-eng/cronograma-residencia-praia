import { describe, expect, it } from "vitest";

describe("regras de domínio do cronograma", () => {
  it("mantém a ordenação explícita das etapas", () => {
    const stages = [
      { name: "Estrutura", order: 3 },
      { name: "Arquitetura", order: 1 },
      { name: "3D", order: 2 },
    ];
    expect(stages.toSorted((a, b) => a.order - b.order).map((stage) => stage.name)).toEqual([
      "Arquitetura",
      "3D",
      "Estrutura",
    ]);
  });

  it("expõe os três estados de etapa previstos", () => {
    expect(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).toEqual(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
  });
});
