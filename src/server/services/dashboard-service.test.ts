import { describe, expect, it } from "vitest";
import { progressByDiscipline, stageCompletion } from "./dashboard-service";

describe("regra única de progresso", () => {
  it("usa o advancement guardado na etapa", () => {
    expect(stageCompletion({ completion: 0, status: "NOT_STARTED" })).toBe(0);
    expect(stageCompletion({ completion: 40, status: "IN_PROGRESS" })).toBe(40);
  });

  it("etapa concluída conta sempre 100, mesmo com percentagem por fechar", () => {
    expect(stageCompletion({ completion: 60, status: "COMPLETED" })).toBe(100);
  });

  it("limita percentagens fora de 0–100", () => {
    expect(stageCompletion({ completion: -30, status: "IN_PROGRESS" })).toBe(0);
    expect(stageCompletion({ completion: 180, status: "IN_PROGRESS" })).toBe(100);
  });

  it("agrupa por disciplina e devolve a média", () => {
    const result = progressByDiscipline([
      { discipline: "Arquitetura", completion: 100, status: "COMPLETED" },
      { discipline: "Arquitetura", completion: 50, status: "IN_PROGRESS" },
      { discipline: "Instalações", completion: 25, status: "IN_PROGRESS" },
    ]);
    expect(result).toEqual([
      { discipline: "Arquitetura", progress: 75 },
      { discipline: "Instalações", progress: 25 },
    ]);
  });

  it("etapas sem disciplina caem em 'Geral' em vez de desaparecerem", () => {
    const result = progressByDiscipline([
      { discipline: null, completion: 30, status: "IN_PROGRESS" },
      { discipline: "  ", completion: 70, status: "IN_PROGRESS" },
    ]);
    expect(result).toEqual([{ discipline: "Geral", progress: 50 }]);
  });

  it("ordena disciplinas alfabeticamente em pt-BR (resultado estável)", () => {
    const result = progressByDiscipline([
      { discipline: "Instalações", completion: 10, status: "IN_PROGRESS" },
      { discipline: "Arquitetura", completion: 10, status: "IN_PROGRESS" },
      { discipline: "Estrutural", completion: 10, status: "IN_PROGRESS" },
    ]);
    expect(result.map((r) => r.discipline)).toEqual(["Arquitetura", "Estrutural", "Instalações"]);
  });

  it("sem etapas devolve lista vazia em vez de NaN", () => {
    expect(progressByDiscipline([])).toEqual([]);
  });
});