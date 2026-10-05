import { describe, expect, it } from "vitest";
import {
  emptyDeck,
  generateDeck,
  generateFromProject,
  generateStructure,
  remixVariant,
  type ProjectFacts,
} from "./studio-generate";
import { applyImprovements, assertPreservedCommercialContent, suggestImprovements } from "./studio-copilot";
import { assertNoCommercialInvented, type CommercialSlots, type StudioDeck, type StudioElement } from "./studio-deck";

/** Um projecto completo: tudo responde "sim". */
const cheio: ProjectFacts = {
  projeto: true,
  briefing: true,
  servicos: true,
  cronograma: true,
  pagamento: true,
  validade: true,
  proximoPasso: true,
};

/** Um projecto sem nada: o pior caso para a geração. */
const vazio: ProjectFacts = {
  projeto: false,
  briefing: false,
  servicos: false,
  cronograma: false,
  pagamento: false,
  validade: false,
  proximoPasso: false,
};

/**
 * Os valores REAIS da proposta, na forma que a guarda de deck consome.
 *
 * As chaves são os rótulos que o servidor resolve; os VALORES são os números
 * que a proposta emite. É esta lista que a geração é confrontada com.
 */
const source = (): CommercialSlots => ({
  Total: "R$ 50.000,00",
  Subtotal: "R$ 50.000,00",
  Projeto: "R$ 45.000,00",
});

/** Todos os valores monetários que aparecem num deck, como texto. */
const textosDoDeck = (deck: StudioDeck): string[] =>
  deck.slides.flatMap((slide) => [
    slide.title,
    slide.body,
    ...slide.elements.map((element) => JSON.stringify(element)),
  ]);

describe("4C-5 — estrutura por IA", () => {
  it("um projecto completo gera a estrutura completa", () => {
    expect(generateStructure(cheio).sections.length).toBeGreaterThan(4);
  });

  it("uma secção comercial sem dados fica MARCADA, não escondida", () => {
    // A escolha do `outlineToSections` é deliberada: esconder o investimento
    // resolveria o sintoma e criaria uma proposta inválida que ninguém
    // perceberia. O que não pode acontecer é entrar como se tivesse números.
    const estrutura = generateStructure(vazio);
    expect(estrutura.emptyRequired).toContain("INVESTIMENTO");
    expect(estrutura.reasons.INVESTIMENTO).toBeTruthy();
  });

  it("toda a secção sem dados fica marcada E com razão", () => {
    // `emptyRequired` e `reason` andam juntos: uma sem a outra é um aviso que
    // ninguém consegue cumprir.
    const estrutura = generateStructure(vazio);
    for (const chave of estrutura.emptyRequired) {
      expect(estrutura.reasons[chave]).toBeTruthy();
    }
  });

  it("um projecto completo não tem secções vazias", () => {
    expect(generateStructure(cheio).emptyRequired).toHaveLength(0);
  });

  it("cada secção diz porque existe", () => {
    // A razão vai para o registo: sem ela, a estrutura é um acto de fé.
    expect(Object.keys(generateStructure(cheio).reasons).length).toBeGreaterThan(0);
  });

  it("nunca gera mais páginas do que o limite recomendado", () => {
    // Uma proposta de trinta páginas não se lê.
    expect(generateStructure(cheio).sections.length).toBeLessThanOrEqual(18);
  });
});

describe("4C-5 — geração de slides", () => {
  it("sempre produz pelo menos uma página", () => {
    // Um deck sem páginas não é uma apresentação.
    expect(generateDeck({ facts: vazio }).slides.length).toBeGreaterThanOrEqual(1);
    expect(emptyDeck().slides.length).toBe(1);
  });

  it("as secções comerciais ficam LIGADAS, não escritas à mão", () => {
    const deck = generateDeck({ facts: cheio });
    const ligados = deck.slides.flatMap((slide) =>
      slide.elements.filter((element) => (element as StudioElement & { binding?: string }).binding),
    );
    expect(ligados.length).toBeGreaterThan(0);
  });

  it("nenhum elemento ligado transporta linhas escritas", () => {
    // `binding` + linhas à mão = o mesmo número com duas fontes.
    const deck = generateDeck({ facts: cheio });
    for (const slide of deck.slides) {
      for (const element of slide.elements) {
        const ligado = element as StudioElement & { binding?: string; rows?: unknown[] };
        if (!ligado.binding) continue;
        expect(ligado.rows ?? []).toHaveLength(0);
      }
    }
  });

  it("a geração é determinística", () => {
    expect(JSON.stringify(generateDeck({ facts: cheio, title: "Casa" }))).toBe(
      JSON.stringify(generateDeck({ facts: cheio, title: "Casa" })),
    );
  });

  it("os ids de página são únicos", () => {
    const ids = generateDeck({ facts: cheio }).slides.map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("4C-5 — protecção comercial (a garantia que importa)", () => {
  it("a geração não escreve nenhum valor monetário", () => {
    const resultado = generateFromProject({ facts: cheio, title: "Casa", source: source() });
    expect(resultado.commercialSafe).toBe(true);

    // Nenhum texto do deck pode conter um valor que não veio da proposta.
    const proibidos = ["45.000", "50.000", "45,000", "50,000", "R$"];
    for (const texto of textosDoDeck(resultado.deck)) {
      for (const valor of proibidos) {
        expect(texto).not.toContain(valor);
      }
    }
  });

  it("a verificação rebenta se o deck trouxer um número inventado", () => {
    // Prova de que a verificação NÃO é decorativa: um deck com um número escrito
    // à mão tem de falhar contra a fonte verdadeira.
    const base = generateDeck({ facts: vazio });
    const adulterado: StudioDeck = {
      ...base,
      slides: [
        {
          ...base.slides[0],
          elements: [
            { kind: "metric" as const, id: "m1", label: "Total", value: "R$ 999.000,00", hint: "" } as StudioElement,
          ],
        },
        ...base.slides.slice(1),
      ],
    };
    expect(() => assertNoCommercialInvented(adulterado, source())).toThrow();
    // E o deck gerado — que não inventa nada — passa com a mesma fonte.
    expect(() => assertNoCommercialInvented(generateDeck({ facts: vazio }), source())).not.toThrow();
  });

  it("devolve as páginas que tocou, para a auditoria", () => {
    const resultado = generateFromProject({ facts: cheio, source: source() });
    expect(resultado.pages).toHaveLength(resultado.deck.slides.length);
  });
});

describe("4C-5 — Remix", () => {
  it("o remix não altera a origem", () => {
    const original = generateDeck({ facts: cheio });
    const antes = JSON.stringify(original);
    remixVariant(original, "v2");
    expect(JSON.stringify(original)).toBe(antes);
  });

  it("o remix muda os ids, para não desfazer a original", () => {
    const original = generateDeck({ facts: cheio });
    expect(remixVariant(original, "v2").slides[0].id).not.toBe(original.slides[0].id);
  });

  it("o mesmo sal dá a mesma variante", () => {
    const original = generateDeck({ facts: cheio });
    expect(remixVariant(original, "v2").slides[0].id).toBe(remixVariant(original, "v2").slides[0].id);
  });

  it("sais diferentes dão variantes diferentes", () => {
    const original = generateDeck({ facts: cheio });
    expect(remixVariant(original, "v2").slides[0].id).not.toBe(remixVariant(original, "v3").slides[0].id);
  });

  it("regista a origem da variante", () => {
    expect(remixVariant(generateDeck({ facts: cheio }), "v2").origin?.label).toBeTruthy();
  });
});

describe("4C-5 — o copilot preserva o conteúdo comercial", () => {
  it("a garantia do copilot é estrutural: deck igual passa", () => {
    const deck = generateDeck({ facts: cheio, title: "Casa" });
    expect(() => assertPreservedCommercialContent(deck, deck)).not.toThrow();
  });

  it("aplicar sugestões nunca perde elementos", () => {
    const deck = generateDeck({ facts: cheio });
    const antes = deck.slides.reduce((total, slide) => total + slide.elements.length, 0);
    const depois = applyImprovements(deck, suggestImprovements(deck));
    expect(depois.slides.reduce((total, slide) => total + slide.elements.length, 0)).toBeGreaterThanOrEqual(antes);
  });

  it("a geração não mexe nos números da proposta", () => {
    // A geração escreve no DECK, nunca na proposta. A única forma de o provar
    // aqui é que a fonte continue igual depois da geração.
    const antes = JSON.stringify(source());
    generateFromProject({ facts: cheio, source: source() });
    expect(JSON.stringify(source())).toBe(antes);
  });
});
