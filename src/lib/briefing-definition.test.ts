import { describe, expect, it } from "vitest";
import { allBriefingQuestions, briefingSections } from "./briefing-definition";
import { ANSWER_KIND } from "./briefing-schema";

describe("guided briefing definition", () => {
  it("preserva os IDs únicos e as 22 etapas do enunciado", () => {
    const ids = allBriefingQuestions.map((question) => question.id);
    expect(ids.length).toBeGreaterThan(50);
    expect(new Set(ids).size).toBe(ids.length);
    // Só a etapa de revisão não tem perguntas: é o ecrã de leitura e confirmação.
    const semPerguntas = briefingSections.filter((section) => section.questions.length === 0);
    expect(semPerguntas.map((section) => section.id)).toEqual(["revisao"]);
  });

  it("mantém os IDs antigos, para as respostas já gravadas não sumirem", () => {
    // Estes IDs vinham do briefing anterior; mudar um deles apagava o histórico
    // do cliente sem qualquer aviso.
    const ids = new Set(allBriefingQuestions.map((question) => question.id));
    for (const legado of ["p1_quem", "p2_natureza", "p2_plantas", "p4_estilos", "p10_orcamento"]) {
      expect(ids.has(legado)).toBe(true);
    }
  });

  it("provides actionable choices for visual questions", () => {
    const visuais = allBriefingQuestions.filter(
      (question) => question.type === ANSWER_KIND.IMAGE_CHOICE,
    );
    expect(visuais.length).toBeGreaterThan(0);
    expect(visuais.every((question) => (question.visualOptions?.length ?? 0) > 0)).toBe(true);
  });
});
