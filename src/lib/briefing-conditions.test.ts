import { describe, expect, it } from "vitest";
import { meetsAll, meetsCondition } from "./briefing-conditions";
import type { BriefingCondition } from "./briefing-schema";

/**
 * Tópico 4A — condicionais.
 *
 * O ponto destes testes é a lateralidade: uma condição que o motor não percebe
 * tem de MOSTRAR a pergunta, não escondê-la. Esconder por engano faz o cliente
 * perder informação que já tinha dado, e o valor guardado deixa de ter onde ser
 * lido.
 */
const semResposta = () => undefined;

describe("condições do briefing", () => {
  it("responde apenas quando a resposta é igual", () => {
    const cond: BriefingCondition = { questionId: "q", kind: "equals", value: "Sim" };
    expect(meetsCondition(cond, () => "Sim")).toBe(true);
    expect(meetsCondition(cond, () => "Não")).toBe(false);
  });

  it("compara booleano pela sua forma guardada, não pela string", () => {
    const cond: BriefingCondition = { questionId: "q", kind: "equals", value: "true" };
    expect(meetsCondition(cond, () => true)).toBe(true);
    expect(meetsCondition(cond, () => false)).toBe(false);
  });

  it("includes funciona em listas e em grupos repetíveis", () => {
    const cond: BriefingCondition = { questionId: "q", kind: "includes", value: "cachorro" };
    expect(meetsCondition(cond, () => ["gato", "cachorro"])).toBe(true);
    expect(meetsCondition(cond, () => ["gato"])).toBe(false);
    expect(meetsCondition(cond, semResposta)).toBe(false);
  });

  it("answered distingue 'não respondeu' de 'respondeu não'", () => {
    const respondeu: BriefingCondition = { questionId: "q", kind: "answered" };
    const naoRespondeu: BriefingCondition = { questionId: "q", kind: "notAnswered" };
    expect(meetsCondition(respondeu, () => "false")).toBe(true);
    expect(meetsCondition(naoRespondeu, () => "false")).toBe(false);
    expect(meetsCondition(naoRespondeu, () => undefined)).toBe(true);
  });

  it("hasEnvironmentNamed encontra o ambiente mesmo com outro nome", () => {
    // O cliente escreve "Sala de estar"; a pergunta procura "Sala".
    const cond: BriefingCondition = { questionId: "p3_ambientes", kind: "hasEnvironmentNamed", value: "Sala" };
    expect(
      meetsCondition(cond, () => [{ id: "a", name: "Sala de estar" }, { id: "b", name: "Cozinha" }]),
    ).toBe(true);
    expect(meetsCondition(cond, () => [{ id: "b", name: "Cozinha" }])).toBe(false);
    expect(meetsCondition(cond, () => undefined)).toBe(false);
  });

  it("uma condição desconhecida mostra a pergunta em vez de a esconder", () => {
    // Falhar para o lado que mostra é o comportamento seguro.
    const desconhecida = { questionId: "q", kind: "inexistente" } as unknown as BriefingCondition;
    expect(meetsCondition(desconhecida, () => undefined)).toBe(true);
  });

  it("todas as condições têm de ser verdadeiras", () => {
    const condicoes: BriefingCondition[] = [
      { questionId: "q", kind: "answered" },
      { questionId: "q", kind: "equals", value: "Sim" },
    ];
    expect(meetsAll(condicoes, () => "Sim")).toBe(true);
    expect(meetsAll(condicoes, () => "Não")).toBe(false);
  });

  it("sem condições, a pergunta aplica-se sempre", () => {
    expect(meetsAll(undefined, semResposta)).toBe(true);
    expect(meetsAll([], semResposta)).toBe(true);
  });
});