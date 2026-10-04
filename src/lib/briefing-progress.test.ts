import { describe, expect, it } from "vitest";
import { computeBriefingProgress } from "./briefing-progress";
import { ANSWER_SOURCE, type StoredAnswers } from "./briefing-answers";
import type { BriefingQuestion } from "./briefing-schema";

/**
 * Tópico 4A — progresso real.
 *
 * O teste central é o das condicionais. A versão anterior contava TODAS as
 * perguntas, o que fazia um cliente sem cachorro ver "faltam 2" para sempre
 * porque "detalhes sobre animais" nunca se aplicava a ele.
 */
const AGORA = "2026-10-05T12:00:00.000Z";
const r = (valor: unknown): StoredAnswers[string] => ({
  value: valor,
  source: ANSWER_SOURCE.CLIENT,
  updatedAt: AGORA,
});

const SECCAO = {
  id: "teste",
  step: 1,
  title: "Secção de teste",
  summary: "Secção usada só pelos testes de progresso.",
  questions: [] as BriefingQuestion[],
};

function perguntas(...lista: BriefingQuestion[]): BriefingQuestion[] {
  return lista;
}

const OBRIGATORIA: BriefingQuestion = {
  id: "q_obrigatoria",
  type: "LONG_TEXT",
  text: "Obrigatória",
  required: true,
};
const OPCIONAL: BriefingQuestion = { id: "q_opcional", type: "SHORT_TEXT", text: "Opcional" };
const CONDICIONAL: BriefingQuestion = {
  id: "q_condicional",
  type: "LONG_TEXT",
  text: "Só se tem cachorro",
  showIf: [{ questionId: "gato", kind: "includes", value: "cachorro" }],
};
const GATOS: BriefingQuestion = { id: "gato", type: "MULTI_SELECT", text: "Animais" };

const LISTA = perguntas(OBRIGATORIA, OPCIONAL, CONDICIONAL, GATOS);
const SECCOES = [{ ...SECCAO, questions: LISTA }];

describe("progresso do briefing", () => {
  it("começa a zero e sem pendentes quando nada foi respondido", () => {
    const p = computeBriefingProgress({}, LISTA, SECCOES);
    expect(p.percent).toBe(0);
    expect(p.requiredPending).toBe(1);
    expect(p.applicable).toBe(3);
    // A condicional não se aplica: 4 perguntas existem, 3 são relevantes.
    expect(p.notApplicable).toBe(1);
  });

  it("responde a uma pergunta e o progresso reflecte-o", () => {
    const p = computeBriefingProgress({ [OBRIGATORIA.id]: r("texto") }, LISTA, SECCOES);
    expect(p.percent).toBe(33);
    expect(p.requiredPending).toBe(0);
    expect(p.requiredAnswered).toBe(1);
  });

  it("uma resposta vazia não conta como respondida", () => {
    const p = computeBriefingProgress({ [OBRIGATORIA.id]: r("   ") }, LISTA, SECCOES);
    expect(p.requiredPending).toBe(1);
  });

  it("a condicional passa a contar quando a condição se cumpre", () => {
    const comCachorro = {
      [OBRIGATORIA.id]: r("texto"),
      [GATOS.id]: r(["cachorro"]),
    };
    const p = computeBriefingProgress(comCachorro, LISTA, SECCOES);
    expect(p.notApplicable).toBe(0);
    expect(p.applicable).toBe(4);
    expect(p.percent).toBe(50);
  });

  it("separa obrigatório pendente de opcional pendente", () => {
    const p = computeBriefingProgress({}, LISTA, SECCOES);
    expect(p.requiredPending).toBe(1);
    expect(p.optionalPending).toBe(2);
    expect(p.missingRequired).toEqual([OBRIGATORIA.id]);
  });

  it("calcula o progresso de cada etapa", () => {
    const p = computeBriefingProgress({ [OBRIGATORIA.id]: r("texto") }, LISTA, SECCOES);
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].applicable).toBe(3);
    expect(p.sections[0].requiredPending).toBe(0);
  });

  it("uma lista vazia não divide por zero", () => {
    const p = computeBriefingProgress({}, [], []);
    expect(p.percent).toBe(0);
    expect(p.applicable).toBe(0);
  });
});