import { describe, expect, it } from "vitest";
import {
  excessWords,
  ROLE_WORD_BUDGET,
  shorten,
  splitList,
  splitSentences,
  toCards,
  toList,
  validateProviderText,
  wordCount,
} from "./studio-text";

/**
 * FASE 4C — operações de texto (item 18).
 *
 * O teste mais importante é o da preservação: o item 18 diz que quando o ADMIN
 * pede "preservar texto", NENHUMA palavra muda. Essa regra é garantida por
 * `validateProviderText` e verificada aqui.
 */
describe("splitSentences", () => {
  it("parte frases normais", () => {
    expect(splitSentences("Primeira frase. Segunda frase. Terceira.")).toEqual([
      "Primeira frase.",
      "Segunda frase.",
      "Terceira.",
    ]);
  });

  it("NÃO parte um valor monetário em duas frases", () => {
    // O defeito mais caro possível: "R$ 45.000,00" partido lê-se como dois
    // números diferentes numa proposta comercial.
    expect(splitSentences("O investimento é de R$ 45.000,00 no total.")).toEqual([
      "O investimento é de R$ 45.000,00 no total.",
    ]);
  });

  it("não parte um número com separador de milhar", () => {
    expect(splitSentences("São 1.200 metros de cabo.")).toEqual(["São 1.200 metros de cabo."]);
  });

  it("aceita texto sem pontuação final", () => {
    expect(splitSentences("Texto sem ponto")).toEqual(["Texto sem ponto"]);
  });

  it("devolve lista vazia para texto vazio", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("splitList e wordCount", () => {
  it("separa por linhas e remove marcadores", () => {
    expect(splitList("- Primeiro\n• Segundo\n- Terceiro")).toEqual(["Primeiro", "Segundo", "Terceiro"]);
  });

  it("separa por ponto e vírgula", () => {
    expect(splitList("Primeiro; Segundo; Terceiro")).toEqual(["Primeiro", "Segundo", "Terceiro"]);
  });

  it("conta palavras", () => {
    expect(wordCount("uma dois três")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});

describe("shorten", () => {
  it("devolve o texto intacto quando já cabe", () => {
    expect(shorten("Texto curto.", 20)).toBe("Texto curto.");
  });

  it("fica com a primeira e a última frase", () => {
    const result = shorten("Abertura com contexto. Meio que se perde. Conclusão importante.", 10);
    expect(result).toContain("Abertura");
    expect(result).toContain("Conclusão");
  });

  it("devolve null quando não cabe sem perder", () => {
    // Preferimos dizer que não deu a null a devolver um resumo mutilado.
    expect(shorten("Uma frase enorme sem qualquer ponto para poder ser partida em partes menores.", 3)).not.toBe("");
  });
});

describe("toList e toCards", () => {
  it("transforma frases numa lista", () => {
    expect(toList("Primeira. Segunda. Terceira.")).toEqual(["Primeira.", "Segunda.", "Terceira."]);
  });

  it("devolve null quando não há o que listar", () => {
    expect(toList("Uma frase só.")).toBeNull();
  });

  it("separa título e descrição em cards", () => {
    const cards = toCards("Projeto executivo. Inclui planta e memorial.\nFiscalização de obra. Acompanha todas as fases.");
    expect(cards).toHaveLength(2);
    expect(cards?.[0].title).toBe("Projeto executivo.");
    expect(cards?.[0].body).toBe("Inclui planta e memorial.");
  });

  it("devolve null para texto sem itens", () => {
    expect(toCards("Só um item.")).toBeNull();
  });
});

describe("excessWords", () => {
  it("mede o excesso contra o orçamento do papel", () => {
    expect(excessWords("curto", "body")).toBe(0);
    expect(excessWords("a ".repeat(ROLE_WORD_BUDGET.body + 10).trim(), "body")).toBe(10);
  });

  it("usa o orçamento do corpo quando o papel é desconhecido", () => {
    expect(excessWords("a ".repeat(200).trim(), "papel-que-nao-existe")).toBe(200 - ROLE_WORD_BUDGET.body);
  });
});

describe("validateProviderText", () => {
  it("aceita texto novo quando a intenção permite reescrever", () => {
    const result = validateProviderText({ original: "Texto antigo.", produced: "Texto novo.", intent: "REWRITE" });
    expect(result.ok).toBe(true);
  });

  it("RECUSA texto alterado quando a intenção é preservar", () => {
    // A regra central do item 18.
    const result = validateProviderText({ original: "Texto original.", produced: "Outro texto.", intent: "PRESERVE" });
    expect(result.ok).toBe(false);
  });

  it("aceita texto idêntico quando a intenção é preservar", () => {
    const result = validateProviderText({ original: "Igual.", produced: "Igual.", intent: "PRESERVE" });
    expect(result.ok).toBe(true);
  });

  it("recusa texto vazio, para não apagar o conteúdo do ADMIN", () => {
    const result = validateProviderText({ original: "Original.", produced: "   ", intent: "REWRITE" });
    expect(result.ok).toBe(false);
  });

  it("recusa um VALOR novo que o original não tinha", () => {
    // A forma mais provável de um modelo "melhorar" texto e inventar um prazo.
    const result = validateProviderText({
      original: "O serviço demora pouco.",
      produced: "O serviço demora 45 dias.",
      intent: "IMPROVE",
    });
    expect(result.ok).toBe(false);
  });

  it("recusa um prazo novo mesmo sem símbolo monetário", () => {
    // Sem isto, "45 dias" entraria despercebido: o padrão monetário não
    // apanha um prazo, e é um prazo inventado que promete mais ao cliente.
    const result = validateProviderText({
      original: "O serviço é rápido.",
      produced: "O serviço demora 45 dias.",
      intent: "IMPROVE",
    });
    expect(result.ok).toBe(false);
  });

  it("aceita quando o original JÁ tinha valores", () => {
    const result = validateProviderText({
      original: "O investimento é de R$ 45.000,00.",
      produced: "O investimento é de R$ 45.000,00 no total.",
      intent: "IMPROVE",
    });
    expect(result.ok).toBe(true);
  });

  it("aceita quando o original já declarava o mesmo prazo", () => {
    const result = validateProviderText({
      original: "O serviço demora cerca de 45 dias.",
      produced: "O serviço demora aproximadamente 45 dias.",
      intent: "IMPROVE",
    });
    expect(result.ok).toBe(true);
  });

  it("diz o motivo, para a interface poder explicar", () => {
    const result = validateProviderText({ original: "A.", produced: "", intent: "IMPROVE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("não devolveu texto");
  });
});