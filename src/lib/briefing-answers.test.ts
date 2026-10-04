import { describe, expect, it } from "vitest";
import {
  ANSWER_SOURCE,
  formatAnswer,
  hasAnswer,
  isAnswered,
  rawAnswer,
  readAnswers,
  writeAnswers,
  type StoredAnswers,
} from "./briefing-answers";

/**
 * Tópico 4A — as respostas do briefing.
 *
 * Estes testes existem porque o formato mudou: `responses` passou de mapa livre
 * a mapa com versão. O teste mais importante é o do formato ANTIGO — se ler mal
 * esse mapa, todas as respostas já gravadas desaparecem do ecrã sem ninguém dar
 * conta.
 */
const AGORA = "2026-10-05T12:00:00.000Z";

function com(valor: unknown): StoredAnswers {
  return { p1_quem: { value: valor, source: ANSWER_SOURCE.CLIENT, updatedAt: AGORA } };
}

describe("respostas do briefing", () => {
  it("lê o formato legado sem perder nenhuma resposta", () => {
    const legado = { p1_quem: "A família toda", p2_plantas: ["Planta", "Estrutural"] };
    const lidas = readAnswers(legado, AGORA);

    expect(lidas.p1_quem.value).toBe("A família toda");
    expect(lidas.p2_plantas.value).toEqual(["Planta", "Estrutural"]);
    expect(lidas.p1_quem.source).toBe(ANSWER_SOURCE.CLIENT);
  });

  it("usa a data do briefing como data da resposta legada, não a de hoje", () => {
    const lidas = readAnswers({ p1_quem: "texto" }, AGORA);
    expect(lidas.p1_quem.updatedAt).toBe(AGORA);
  });

  it("lê o formato com versão e ignora o envelope em si", () => {
    const envelope = writeAnswers(com("Ana"), AGORA);
    const lidas = readAnswers(envelope, AGORA);
    expect(lidas.p1_quem.value).toBe("Ana");
  });

  it("devolve vazio para o que não é um mapa de respostas", () => {
    expect(readAnswers(null)).toEqual({});
    expect(readAnswers("texto")).toEqual({});
    expect(readAnswers(["a", "b"])).toEqual({});
  });

  it("round-trip: escrever e ler devolve o mesmo conteúdo", () => {
    const original: StoredAnswers = {
      p1_quem: { value: ["Ana", "João"], source: ANSWER_SOURCE.CLIENT, updatedAt: AGORA },
      p3_ambientes: {
        value: [{ id: "a", name: "Sala" }],
        source: ANSWER_SOURCE.CLIENT,
        updatedAt: AGORA,
        professionalNote: "confirmar no local",
      },
    };
    expect(readAnswers(writeAnswers(original, AGORA), AGORA)).toEqual(original);
  });
});

describe("o que conta como resposta", () => {
  it("uma chave vazia não é resposta", () => {
    // Progresso que conta chaves vazias mente ao cliente.
    expect(hasAnswer("")).toBe(false);
    expect(hasAnswer("   ")).toBe(false);
    expect(hasAnswer([])).toBe(false);
    expect(hasAnswer({})).toBe(false);
    expect(hasAnswer({ nome: "" })).toBe(false);
    expect(hasAnswer(null)).toBe(false);
    expect(hasAnswer(undefined)).toBe(false);
  });

  it("uma resposta real conta", () => {
    expect(hasAnswer("texto")).toBe(true);
    expect(hasAnswer(0)).toBe(true);
    expect(hasAnswer(false)).toBe(true);
    expect(hasAnswer(["a"])).toBe(true);
    expect(hasAnswer({ id: "amb-1" })).toBe(true);
  });

  it("zero é resposta; null não é", () => {
    // Distinguir "não quero Pets" de "não respondi" depende disto.
    expect(isAnswered(com(0), "p1_quem")).toBe(true);
    expect(isAnswered(com(null), "p1_quem")).toBe(false);
  });

  it("uma inferência do sistema não é resposta do cliente", () => {
    // É a regra que impede a IA de contar como facto confirmado.
    const inferida: StoredAnswers = {
      p1_quem: { value: "família", source: ANSWER_SOURCE.INFERENCE, updatedAt: AGORA },
    };
    expect(isAnswered(inferida, "p1_quem")).toBe(false);
    expect(rawAnswer(inferida, "p1_quem")).toBeUndefined();
  });
});

describe("leitura de uma resposta para a revisão", () => {
  it("mostra o que a pessoa escolheu, não um contador", () => {
    expect(formatAnswer("texto")).toBe("texto");
    expect(formatAnswer(["a", "b"])).toBe("a · b");
    expect(formatAnswer(true)).toBe("Sim");
    expect(formatAnswer(false)).toBe("Não");
    expect(formatAnswer({ name: "Sala" })).toBe("Sala");
  });

  it("um ambiente mostra o rótulo e não o id", () => {
    expect(formatAnswer({ id: "amb-1", name: "Cozinha", quantity: 1 })).toBe("Cozinha");
  });

  it("valor ausente devolve texto vazio, nunca undefined", () => {
    expect(formatAnswer(undefined)).toBe("");
    expect(formatAnswer(null)).toBe("");
  });
});