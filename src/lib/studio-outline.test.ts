import { describe, expect, it } from "vitest";
import {
  auditOutline,
  MAX_RECOMMENDED_SLIDES,
  OUTLINE_ORDER,
  outlineToSections,
  slideFunction,
  suggestOutline,
  type OutlineInputs,
} from "./studio-outline";

const full: OutlineInputs = {
  projeto: true,
  briefing: true,
  servicos: true,
  cronograma: true,
  pagamento: true,
  validade: true,
  proximoPasso: true,
};

const empty: OutlineInputs = {
  projeto: false,
  briefing: false,
  servicos: false,
  cronograma: false,
  pagamento: false,
  validade: false,
  proximoPasso: false,
};

/**
 * FASE 4C — gerador de estrutura (item 6) e quantidade de slides (item 7).
 *
 * O teste mais importante é o primeiro: a regra do item 5 é "a IA não inventa",
 * e uma secção sem dado que aparece na estrutura seria exactamente isso.
 */
describe("suggestOutline", () => {
  it("cobre as onze secções do item 6, pela ordem certa", () => {
    expect(OUTLINE_ORDER).toHaveLength(11);
    expect(OUTLINE_ORDER[0]).toBe("CAPA");
    expect(OUTLINE_ORDER[OUTLINE_ORDER.length - 1]).toBe("PROXIMOS_PASSOS");
  });

  it("inclui tudo quando existe dado para tudo", () => {
    const sections = outlineToSections(suggestOutline(full));
    expect(sections).toHaveLength(11);
    sections.forEach((section) => expect(section.dataAvailable).toBe(true));
  });

  it("NÃO inventa uma secção que não tem dado", () => {
    // Sem cronograma, não há página de cronograma. Prometer um prazo que
    // ninguém assumiu é pior do que a secção não existir.
    const entries = suggestOutline({ ...full, cronograma: false });
    const cronograma = entries.find((entry) => entry.key === "CRONOGRAMA");
    expect(cronograma?.dataAvailable).toBe(false);
    expect(outlineToSections(entries).some((entry) => entry.key === "CRONOGRAMA")).toBe(false);
  });

  it("exclui secções opcionais sem dado", () => {
    const entries = suggestOutline({ ...full, briefing: false, cronograma: false });
    const keys = outlineToSections(entries).map((entry) => entry.key);
    expect(keys).not.toContain("CONTEXTO");
    expect(keys).not.toContain("DIAGNOSTICO");
    expect(keys).not.toContain("CRONOGRAMA");
  });

  it("mantém visíveis as secções ESSENCIAIS sem dado, com aviso", () => {
    // Esconder o investimento de uma proposta sem valores não resolveria nada:
    // tornava-a inválida e invisível ao mesmo tempo.
    const entries = suggestOutline({ ...full, pagamento: false });
    const condicoes = entries.find((entry) => entry.key === "CONDICOES");
    expect(condicoes?.dataAvailable).toBe(false);
    expect(outlineToSections(entries).some((entry) => entry.key === "CONDICOES")).toBe(true);
    expect(condicoes?.reason).toContain("obrigatória");
  });

  it("diz SEMPRE o porque de cada secção", () => {
    suggestOutline(full).forEach((entry) => expect(entry.reason.length).toBeGreaterThan(0));
    suggestOutline(empty).forEach((entry) => expect(entry.reason.length).toBeGreaterThan(0));
  });

  it("propõe um layout para cada secção", () => {
    suggestOutline(full).forEach((entry) => expect(entry.layout).toBeTruthy());
  });

  it("devolve sempre as onze entradas, mesmo sem qualquer dado", () => {
    expect(suggestOutline(empty)).toHaveLength(11);
  });

  it("é determinístico", () => {
    expect(suggestOutline(full)).toEqual(suggestOutline(full));
  });
});

describe("slideFunction", () => {
  const base = { layout: "title-text" as const, hasImage: false, hasMetric: false, hasTable: false, hasCards: false, wordCount: 0 };

  it("uma tabela é comercial", () => {
    expect(slideFunction({ ...base, hasTable: true })).toBe("COMERCIAL");
  });

  it("um destaque numérico é comercial", () => {
    expect(slideFunction({ ...base, hasMetric: true })).toBe("COMERCIAL");
  });

  it("uma imagem é visual", () => {
    expect(slideFunction({ ...base, hasImage: true })).toBe("VISUAL");
  });

  it("texto suficiente é narrativa", () => {
    expect(slideFunction({ ...base, wordCount: 30 })).toBe("NARRATIVA");
    expect(slideFunction({ ...base, hasCards: true })).toBe("NARRATIVA");
  });

  it("uma página sem nada é assinalada, não aprovada", () => {
    expect(slideFunction(base)).toBe("SEM_FUNCAO");
  });
});

describe("auditOutline", () => {
  it("conta as páginas órfãs", () => {
    const result = auditOutline([
      { title: "A", layout: "text-image", hasImage: true, hasMetric: false, hasTable: false, hasCards: false, wordCount: 0 },
      { title: "B", layout: "title-text", hasImage: false, hasMetric: false, hasTable: false, hasCards: false, wordCount: 0 },
    ]);
    expect(result.total).toBe(2);
    expect(result.orphans).toBe(1);
  });

  it("NÃO impõe um limite de nove páginas", () => {
    const many = Array.from({ length: 24 }, (_, index) => ({
      title: `P${index}`,
      layout: "title-text" as const,
      hasImage: true,
      hasMetric: false,
      hasTable: false,
      hasCards: false,
      wordCount: 30,
    }));
    const result = auditOutline(many);
    // Avisa, não corta: a proposta continua válida com 24 páginas.
    expect(result.total).toBe(24);
    expect(result.aboveRecommended).toBe(true);
  });

  it("não avisa uma apresentação de tamanho normal", () => {
    const normal = Array.from({ length: 9 }, (_, index) => ({
      title: `P${index}`,
      layout: "title-text" as const,
      hasImage: true,
      hasMetric: false,
      hasTable: false,
      hasCards: false,
      wordCount: 30,
    }));
    expect(auditOutline(normal).aboveRecommended).toBe(false);
    expect(MAX_RECOMMENDED_SLIDES).toBeGreaterThan(9);
  });

  it("explica o que fazer com uma página órfã", () => {
    const result = auditOutline([
      { title: "Vazia", layout: "title-text", hasImage: false, hasMetric: false, hasTable: false, hasCards: false, wordCount: 2 },
    ]);
    expect(result.entries[0].note).toContain("cliente");
  });
});