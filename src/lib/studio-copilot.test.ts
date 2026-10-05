import { describe, expect, it } from "vitest";
import {
  applyImprovements,
  assertPreservedCommercialContent,
  suggestImprovements,
} from "./studio-copilot";
import { readStudioDeck, toPersistedDeck, type StudioDeck } from "./studio-deck";
import { referenceDeck } from "./studio-reference";

/**
 * FASE 4D — MELHORAR APRESENTAÇÃO (item 32).
 *
 * O item 32 termina com duas exigências que seem acessórias e não são:
 * "preservar valores" e "preservar escopo". São elas que se testam. Uma função
 * que sabe encurtar texto e mudar layout é fácil; uma que faz isso sem mexer no
 * que o cliente assina é difícil, e é essa parte que os testes fixam.
 */

/** Uma frase comprida, para simular excesso de texto. */
const LONGA = [
  "A integração espacial entre a sala de estar e a cozinha é o principal desafio do imóvel.",
  "A remoção da parede divisória exige acompanhamento técnico e laudo de engenharia estrutural.",
  "O resultado esperado é ganho de iluminação natural e uma sensação de amplitude que o imóvel não tem hoje.",
  "Este texto existe para testar que o corte preserva o sentido da primeira e da última frase.",
].join(" ");

/** Deck com uma página de texto comprido, uma com escopo e uma vazia. */
function deckDeTeste(): StudioDeck {
  return readStudioDeck(
    toPersistedDeck({
      theme: "arqvertice-minimal",
      origin: null,
      slides: [
        {
          id: "p1",
          layout: "cover",
          eyebrow: "",
          title: "Capa",
          body: "",
          hidden: false,
          notes: "",
          elements: [{ kind: "text", id: "e1", role: "body", text: LONGA }],
        },
        {
          id: "p2",
          layout: "title-text",
          eyebrow: "",
          title: "Escopo",
          body: "",
          hidden: false,
          notes: "",
          elements: [
            {
              kind: "cards",
              id: "escopo",
              variant: "stacked",
              items: [
                { title: "", body: "Plantas de demolição", image: null },
                { title: "", body: "Elétrica", image: null },
              ],
            },
          ],
        },
        {
          id: "p3",
          layout: "image-full",
          eyebrow: "",
          title: "Moodboard",
          body: "",
          hidden: false,
          notes: "",
          elements: [{ kind: "text", id: "e3", role: "body", text: "Carvalho claro, linho e quartzo branco." }],
        },
        {
          id: "p4",
          layout: "title-text",
          eyebrow: "",
          title: "Página vazia",
          body: "",
          hidden: false,
          notes: "",
          elements: [],
        },
      ],
    }),
  );
}

describe("sugestões de melhoria (item 32)", () => {
  it("sugere cortar texto a mais", () => {
    const sugestoes = suggestImprovements(deckDeTeste());
    expect(sugestoes.some((s) => s.kind === "CORTAR_TEXTO")).toBe(true);
  });

  it("diz ONDE e PORQUÊ, não só que algo mudou", () => {
    // Uma sugestão que o ADMIN não consegue avaliar não é uma sugestão: é ruído.
    for (const sugestao of suggestImprovements(deckDeTeste())) {
      expect(sugestao.summary.length, sugestao.kind).toBeGreaterThan(20);
      expect(sugestao.page).toBeGreaterThan(0);
    }
  });

  it("sugere uma imagem onde o layout pede uma", () => {
    expect(suggestImprovements(deckDeTeste()).some((s) => s.kind === "SUGERIR_IMAGEM")).toBe(true);
  });

  it("avisa sobre a página vazia", () => {
    expect(suggestImprovements(deckDeTeste()).some((s) => s.kind === "SUGERIR_PAGINA")).toBe(true);
  });

  it("sugere variar o layout de páginas repetidas", () => {
    const repetido = readStudioDeck(
      toPersistedDeck({
        theme: "arqvertice-minimal",
        origin: null,
        slides: [
          { id: "a", layout: "title-text", eyebrow: "", title: "A", body: "", hidden: false, notes: "", elements: [] },
          { id: "b", layout: "title-text", eyebrow: "", title: "B", body: "", hidden: false, notes: "", elements: [] },
        ],
      }),
    );
    expect(suggestImprovements(repetido).some((s) => s.kind === "VARIAR_LAYOUT")).toBe(true);
  });

  it("não sugere nada numa proposta curta e bem formada", () => {
    const curta = readStudioDeck(
      toPersistedDeck({
        theme: "arqvertice-minimal",
        origin: null,
        slides: [
          { id: "a", layout: "cover", eyebrow: "", title: "Capa", body: "", hidden: false, notes: "", elements: [{ kind: "cta", id: "c1", title: "Falar", body: "Contacte-nos.", action: "Contactar" }] },
          { id: "b", layout: "cta", eyebrow: "", title: "Próximo passo", body: "", hidden: false, notes: "", elements: [{ kind: "cta", id: "c2", title: "Escolher", body: "Diga-nos qual opção prefere.", action: "Responder" }] },
        ],
      }),
    );
    expect(suggestImprovements(curta)).toEqual([]);
  });
});

describe("aplicar com pré-visualização (item 32)", () => {
  const deck = deckDeTeste();

  it("devolve um deck NOVO e não toca no original", () => {
    /*
     * O item 32 pede "acção com preview". Preview pressupõe que cancelar seja
     * possível — uma acção de IA que se desfaz é uma acção que ninguém usa.
     */
    const antes = JSON.stringify(deck);
    const melhorado = applyImprovements(deck, suggestImprovements(deck));
    expect(melhorado).not.toBe(deck);
    expect(JSON.stringify(deck)).toBe(antes);
  });

  it("o corte encurta o texto mas guarda a primeira e a última frase", () => {
    const cortadas = suggestImprovements(deck).filter((s) => s.kind === "CORTAR_TEXTO");
    const melhorado = applyImprovements(deck, cortadas);
    const texto = JSON.stringify(melhorado);

    expect(texto).toContain("principal desafio do imóvel");
    expect(texto).toContain("testar que o corte preserva o sentido");
    // E perdeu o meio, que é a repetição.
    expect(texto).not.toContain("laudo de engenharia estrutural");
  });

  it("NÃO toca no escopo: as linhas continuam todas lá", () => {
    const melhorado = applyImprovements(deck, suggestImprovements(deck));
    const texto = JSON.stringify(melhorado);
    // Cortar uma linha de escopo muda o que o cliente pensa que recebeu.
    expect(texto).toContain("Plantas de demolição");
    expect(texto).toContain("Elétrica");
  });

  it("NÃO toca em valores ligados à proposta", () => {
    /*
     * Um elemento ligado tem o texto resolvido pelo servidor. Reescrevê-lo aqui
     * passaria a ser uma segunda fonte do número — o defeito que os itens 26 a 30
     * eliminaram.
     */
    const ligado = readStudioDeck(
      toPersistedDeck({
        theme: "arqvertice-minimal",
        origin: null,
        slides: [
          {
            id: "p",
            layout: "investment",
            eyebrow: "",
            title: "Investimento",
            body: "",
            hidden: false,
            notes: "",
            elements: [
              { kind: "table", id: "t", columns: ["Serviço", "Valor"], rows: [["Projecto", "R$ 2.240,00"]], binding: "SERVICOS" },
            ],
          },
        ],
      }),
    );

    const antes = JSON.stringify(ligado);
    const melhorado = applyImprovements(ligado, suggestImprovements(ligado));
    expect(JSON.stringify(melhorado)).toBe(antes);
  });

  it("só aplica as sugestões que têm efeito", () => {
    /*
     * Sugestões sem `apply` (imagem em falta, página vazia) são AVISOS para o
     * ADMIN, não alterações: não há o que automatizar sem inventar conteúdo.
     */
    const todas = suggestImprovements(deck);
    const cortadas = todas.filter((s) => s.kind === "CORTAR_TEXTO");
    expect(cortadas.length).toBeGreaterThan(0);
    expect(JSON.stringify(applyImprovements(deck, cortadas))).toBe(
      JSON.stringify(applyImprovements(deck, todas)),
    );
  });

  it("um aviso sem efeito não altera o deck", () => {
    // Uma sugestão que muda o documento sem o ADMIN pedir nada seria pior que
    // não sugerir: ela decidiria por ele.
    const soAvisos = suggestImprovements(deck).filter((s) => !s.apply);
    expect(soAvisos.length).toBeGreaterThan(0);
    expect(JSON.stringify(applyImprovements(deck, soAvisos))).toBe(JSON.stringify(deck));
  });

  it("não aplica nada quando não há sugestões escolhidas", () => {
    expect(JSON.stringify(applyImprovements(deck, []))).toBe(JSON.stringify(deck));
  });
});

describe("preservar valores e escopo (item 32)", () => {
  it("uma melhoria legítima passa na verificação", () => {
    const deck = deckDeTeste();
    expect(() =>
      assertPreservedCommercialContent(deck, applyImprovements(deck, suggestImprovements(deck))),
    ).not.toThrow();
  });

  it("a referência de 9 páginas sobrevive a uma melhoria", () => {
    /*
     * O teste mais próximo do caso real: a proposta de referência é o documento
     * que o item 32 manda tomar como template, e melhorá-la não pode apagá-la.
     */
    const deck = referenceDeck();
    const melhorado = applyImprovements(deck, suggestImprovements(deck));
    expect(() => assertPreservedCommercialContent(deck, melhorado)).not.toThrow();
    expect(melhorado.slides).toHaveLength(deck.slides.length);
  });

  it("RECUSA uma melhoria que apagou uma linha de escopo", () => {
    // A falha que importa: o cliente aprova uma proposta que promete menos do
    // que o estúdio vai entregar.
    const deck = deckDeTeste();
    const semEscopo: StudioDeck = {
      ...deck,
      slides: deck.slides.map((slide, indice) => (indice === 1 ? { ...slide, elements: [] } : slide)),
    };
    expect(() => assertPreservedCommercialContent(deck, semEscopo)).toThrow(/removeu conteúdo/);
  });

  it("RECUSA uma melhoria que apagou um valor ligado à proposta", () => {
    /*
     * A falha que importa: um valor lido do servidor desaparece do documento, e o
     * cliente aprova uma proposta que não mostra o que vai custar.
     *
     * Usa-se uma tabela NÃO ligada com linhas reais: numa tabela ligada, os
     * valores vivem do servidor e `rows` é de propósito ignorado — o que faria
     * este teste passar pela razão errada.
     */
    const comValores = readStudioDeck(
      toPersistedDeck({
        theme: "arqvertice-minimal",
        origin: null,
        slides: [
          {
            id: "p",
            layout: "table-highlight",
            eyebrow: "",
            title: "Investimento",
            body: "",
            hidden: false,
            notes: "",
            elements: [
              { kind: "table", id: "t", columns: ["Serviço", "Valor"], rows: [["Projeto", "R$ 2.240,00"]], binding: null },
            ],
          },
        ],
      }),
    );
    const vazio: StudioDeck = {
      ...comValores,
      slides: comValores.slides.map((slide) => ({ ...slide, elements: [] })),
    };
    expect(() => assertPreservedCommercialContent(comValores, vazio)).toThrow(/removeu conteúdo/);
  });

  it("aceita quando o conteúdo foi apenas encurtado", () => {
    // O corte de texto é precisamente a melhoria pedida; a verificação não pode
    // proibir a acção que o item 32 quer.
    const deck = deckDeTeste();
    const cortado = applyImprovements(deck, suggestImprovements(deck).filter((s) => s.kind === "CORTAR_TEXTO"));
    expect(() => assertPreservedCommercialContent(deck, cortado)).not.toThrow();
  });
});