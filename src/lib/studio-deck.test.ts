import { describe, expect, it } from "vitest";
import {
  assertNoCommercialInvented,
  readStudioDeck,
  stableId,
  StudioContentError,
  toPersistedDeck,
  type StudioDeck,
} from "./studio-deck";

/**
 * FASE 4C — o contrato do deck.
 *
 * O teste mais importante deste ficheiro é o da COMPATIBILIDADE: o DTO público,
 * o PDF e a página do cliente leem `slides[].title` e `slides[].body`. Se o
 * modelo rico deixar de os escrever, uma proposta já enviada deixa de ser
 * legível — e isso não aparece em nenhum teste de interface.
 */
describe("readStudioDeck", () => {
  it("lê o formato antigo {title, body} sem perder nada", () => {
    const deck = readStudioDeck({
      slides: [
        { title: "Capa", body: "Apartamento de 56 m²" },
        { title: "Escopo", body: "Interiores e reestruturação" },
      ],
    });

    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0].title).toBe("Capa");
    expect(deck.slides[0].body).toBe("Apartamento de 56 m²");
    // Slides legados não têm layout; o leitor escolhe um que os aceite.
    expect(deck.slides[0].layout).toBe("title-text");
    expect(deck.theme).toBe("arqvertice-minimal");
  });

  it("devolve deck vazio em vez de lançar quando o Json está corrompido", () => {
    // Uma proposta enviada não pode dar 500 por causa de um Json antigo.
    expect(() => readStudioDeck("isto não é um objeto")).not.toThrow();
    expect(readStudioDeck(null).slides).toEqual([]);
    expect(readStudioDeck({ slides: "não é uma lista" }).slides).toEqual([]);
  });

  it("descarta páginas vazias, sem título, corpo ou elementos", () => {
    const deck = readStudioDeck({
      slides: [{ title: "", body: "" }, { title: "Real", body: "" }],
    });
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].title).toBe("Real");
  });

  it("preserva elementos válidos e descarta os irrecuperáveis", () => {
    const deck = readStudioDeck({
      slides: [
        {
          title: "Serviços",
          elements: [
            { kind: "cards", items: [{ title: "Projeto", body: "Executivo" }] },
            // Sem itens: um cards vazio é irrecuperável.
            { kind: "cards", items: [] },
            // Sem valor: um destaque vazio ocupa espaço e não informa.
            { kind: "metric", label: "Total", value: "" },
            { kind: "desconhecido", qualquer: "coisa" },
          ],
        },
      ],
    });

    expect(deck.slides[0].elements).toHaveLength(1);
    expect(deck.slides[0].elements[0].kind).toBe("cards");
  });

  it("normaliza origens de imagem desconhecidas para upload", () => {
    const deck = readStudioDeck({
      slides: [
        { title: "Foto", elements: [{ kind: "image", url: "https://x/a.jpg", source: "inventado" }] },
      ],
    });
    const element = deck.slides[0].elements[0];
    expect(element.kind).toBe("image");
    if (element.kind === "image") expect(element.source).toBe("upload");
  });

  it("substitui layout que já não existe no catálogo", () => {
    const deck = readStudioDeck({ slides: [{ title: "X", layout: "layout-removido" }] });
    expect(deck.slides[0].layout).toBe("title-text");
  });
});
describe("toPersistedDeck", () => {
  const deck: StudioDeck = {
    theme: "arqvertice-editorial",
    origin: null,
    slides: [
      {
        id: "s1",
        layout: "cover",
        eyebrow: "Proposta",
        title: "Residência",
        body: "Projeto de interiores",
        elements: [],
        hidden: false,
        notes: "",
      },
    ],
  };

  it("escreve title e body no nível da página, como o DTO público exige", () => {
    const persisted = toPersistedDeck(deck);
    const slide = (persisted.slides as Array<Record<string, unknown>>)[0];
    expect(slide.title).toBe("Residência");
    expect(slide.body).toBe("Projeto de interiores");
  });

  it("guarda tema e origem para o editor reabrir igual", () => {
    const persisted = toPersistedDeck({
      ...deck,
      origin: { proposalId: "p1", version: 2, label: "Original" },
    });
    expect(persisted.theme).toBe("arqvertice-editorial");
    expect(persisted.origin).toEqual({ proposalId: "p1", version: 2, label: "Original" });
  });

  it("faz ida e volta sem perder o conteúdo", () => {
    // O que o editor vê é o que volta a ler: este é o contrato da abertura.
    expect(readStudioDeck(toPersistedDeck(deck))).toEqual(deck);
  });
});

describe("assertNoCommercialInvented", () => {
  const withMetric = (label: string, value: string): StudioDeck => ({
    theme: "arqvertice-minimal",
    origin: null,
    slides: [
      {
        id: "s1",
        layout: "metric-highlight",
        eyebrow: "",
        title: "Investimento",
        body: "",
        elements: [{ kind: "metric", id: "m1", label, value, hint: null }],
        hidden: false,
        notes: "",
      },
    ],
  });

  it("aceita um destaque cujo valor o servidor confirmou", () => {
    expect(() =>
      assertNoCommercialInvented(withMetric("Total", "R$ 45.000,00"), { total: "R$ 45.000,00" }),
    ).not.toThrow();
  });

  it("recusa um destaque com rótulo que a proposta não tem", () => {
    expect(() => assertNoCommercialInvented(withMetric("Desconto", "R$ 5.000,00"))).toThrow(
      StudioContentError,
    );
  });

  it("recusa um valor inventado mesmo com o rótulo certo", () => {
    // O pior caso: rótulo válido, número mentira. Passaria a validação do
    // rótulo se ela fosse só de nomes.
    expect(() =>
      assertNoCommercialInvented(withMetric("Total", "R$ 90.000,00"), { total: "R$ 45.000,00" }),
    ).toThrow(StudioContentError);
  });

  it("compara rótulos sem acentos nem caixa", () => {
    expect(() =>
      assertNoCommercialInvented(withMetric("TOTAL", "R$ 45.000,00"), { "Tótal": "R$ 45.000,00" }),
    ).not.toThrow();
  });

  it("não reclama de páginas sem destaques", () => {
    const plain: StudioDeck = {
      theme: "arqvertice-minimal",
      origin: null,
      slides: [
        {
          id: "s1",
          layout: "title-text",
          eyebrow: "",
          title: "Escopo",
          body: "Texto",
          elements: [],
          hidden: false,
          notes: "",
        },
      ],
    };
    expect(() => assertNoCommercialInvented(plain)).not.toThrow();
  });
});

describe("stableId", () => {
  it("é determinístico para o mesmo conteúdo", () => {
    expect(stableId("slide", 1, "Escopo")).toBe(stableId("slide", 1, "Escopo"));
  });

  it("ignora acentos e caixa, para ids não divergirem", () => {
    expect(stableId("slide", "Ação")).toBe(stableId("slide", "acao"));
  });

  it("separa entradas diferentes", () => {
    expect(stableId("el", "a", "b")).not.toBe(stableId("el", "b", "a"));
  });
});