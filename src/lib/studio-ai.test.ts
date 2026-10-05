import { describe, expect, it } from "vitest";
import {
  affectedSlides,
  assertScopeMatchesSelection,
  buildAiContext,
  deckImages,
  previewChanges,
  remixDeck,
  StudioContentError,
  type AiCommand,
} from "./studio-ai";
import type { StudioDeck } from "./studio-deck";

const deck = (): StudioDeck => ({
  theme: "arqvertice-minimal",
  origin: null,
  slides: [
    {
      id: "s1",
      layout: "title-text",
      eyebrow: "",
      title: "Capa",
      body: "",
      elements: [{ kind: "text", id: "e1", role: "body", text: "Texto" }],
      hidden: false,
      notes: "",
    },
    {
      id: "s2",
      layout: "cover",
      eyebrow: "",
      title: "Segunda",
      body: "",
      elements: [],
      hidden: false,
      notes: "",
    },
  ],
});

const command = (overrides: Partial<AiCommand> = {}): AiCommand => ({
  scope: "SLIDE",
  selection: { kind: "SLIDE", slideId: "s1" },
  instruction: "melhora isto",
  ...overrides,
});

/**
 * FASE 4C — âmbito da IA (item 15) e Remix (item 12).
 *
 * Estes testes protegem a propriedade mais importante de um editor assistido:
 * um comando LOCALIZADO nunca toca no resto. É a diferença entre uma
 * ferramenta útil e uma que perde o trabalho do ADMIN.
 */
describe("assertScopeMatchesSelection", () => {
  it("aceita as três combinações coerentes", () => {
    expect(() =>
      assertScopeMatchesSelection(
        command({ scope: "ELEMENTO", selection: { kind: "ELEMENTO", slideId: "s1", elementId: "e1" } }),
      ),
    ).not.toThrow();
    expect(() => assertScopeMatchesSelection(command({ scope: "SLIDE" }))).not.toThrow();
    expect(() =>
      assertScopeMatchesSelection(command({ scope: "PRESENTACAO", selection: { kind: "PRESENTACAO" } })),
    ).not.toThrow();
  });

  it("recusa ELEMENTO sem elemento seleccionado", () => {
    expect(() => assertScopeMatchesSelection(command({ scope: "ELEMENTO" }))).toThrow(StudioContentError);
  });

  it("recusa SLIDE quando a selecção é um elemento", () => {
    expect(() =>
      assertScopeMatchesSelection(
        command({ scope: "SLIDE", selection: { kind: "ELEMENTO", slideId: "s1", elementId: "e1" } }),
      ),
    ).toThrow(StudioContentError);
  });

  it("recusa PRESENTACAO quando há uma página seleccionada", () => {
    expect(() => assertScopeMatchesSelection(command({ scope: "PRESENTACAO" }))).toThrow(StudioContentError);
  });
});

describe("affectedSlides", () => {
  it("PRESENTACAO toca em todas as páginas", () => {
    const touched = affectedSlides(deck(), command({ scope: "PRESENTACAO", selection: { kind: "PRESENTACAO" } }));
    expect(touched).toHaveLength(2);
  });

  it("SLIDE toca apenas na página seleccionada", () => {
    const touched = affectedSlides(deck(), command({ selection: { kind: "SLIDE", slideId: "s2" } }));
    expect(touched).toHaveLength(1);
    expect(touched[0].id).toBe("s2");
  });

  it("ELEMENTO toca apenas na página que contém o elemento", () => {
    const touched = affectedSlides(
      deck(),
      command({ scope: "ELEMENTO", selection: { kind: "ELEMENTO", slideId: "s1", elementId: "e1" } }),
    );
    expect(touched).toHaveLength(1);
    expect(touched[0].id).toBe("s1");
  });

  it("recusa uma página que já não existe", () => {
    expect(() =>
      affectedSlides(deck(), command({ selection: { kind: "SLIDE", slideId: "inexistente" } })),
    ).toThrow(StudioContentError);
  });
});
describe("buildAiContext", () => {
  const context = (formalText: Record<string, unknown>, restrictions?: string[]) =>
    buildAiContext({
      proposalId: "p1",
      proposalCode: "PROP-2026-0001",
      version: 2,
      clientName: "Maria",
      projectName: "Residência",
      deck: deck(),
      formalText,
      restrictions,
    });

  it("lê o objectivo da proposta, sem o inventar", () => {
    expect(context({ object: "Projeto de interiores" }).objective).toBe("Projeto de interiores");
  });

  it("deixa o objectivo VAZIO quando a proposta não o declara", () => {
    // Um objectivo inferido seria inventar. Vazio é honesto.
    expect(context({}).objective).toBe("");
  });

  it("usa o tema escolhido como estilo, sem adjectivar", () => {
    expect(context({}).style).toBe("arqvertice-minimal");
  });

  it("lê as restrições das premissas da proposta", () => {
    expect(context({ premisses: ["O cliente garante o acesso.", ""] }).restrictions).toEqual([
      "O cliente garante o acesso.",
    ]);
  });

  it("aceita restrições vindas do servidor e tem precedência", () => {
    expect(context({ premisses: ["Do briefing."] }, ["Da proposta."]).restrictions).toEqual(["Da proposta."]);
  });

  it("constrói o índice de páginas para a IA saber o que já existe", () => {
    expect(context({}).outline).toEqual(["Capa", "Segunda"]);
  });
});

describe("remixDeck", () => {
  const origin = { proposalId: "p1", version: 2, label: "Proposta original" };
  const variant = (key: string) => remixDeck({ source: deck(), origin, variantKey: key });

  it("NUNCA altera a apresentação de origem", () => {
    const source = deck();
    const before = JSON.stringify(source);
    remixDeck({ source, origin, variantKey: "v1" });
    expect(JSON.stringify(source)).toBe(before);
  });

  it("regista a origem, para se saber de onde veio a variação", () => {
    expect(variant("v1").origin).toEqual(origin);
  });

  it("dá ids NOVOS às páginas, para as duas não partilharem identidade", () => {
    const source = deck();
    const remixed = remixDeck({ source, origin, variantKey: "v1" });
    source.slides.forEach((slide) => {
      expect(remixed.slides.some((s) => s.id === slide.id)).toBe(false);
    });
  });

  it("preserva o conteúdo das páginas", () => {
    const remixed = variant("v1");
    expect(remixed.slides.map((s) => s.title)).toEqual(["Capa", "Segunda"]);
    expect(remixed.slides[0].elements[0]).toMatchObject({ kind: "text", text: "Texto" });
  });

  it("permite mudar o estilo através do mutate", () => {
    const remixed = remixDeck({
      source: deck(),
      origin,
      variantKey: "v1",
      mutate: (d) => ({ ...d, theme: "arqvertice-alto-padrao" }),
    });
    expect(remixed.theme).toBe("arqvertice-alto-padrao");
  });

  it("gera duas remixes distinguíveis a partir da mesma origem", () => {
    // Sem a chave de variação, as duas teriam ids idênticos e o "restaurar"
    // de uma desfaria a outra.
    expect(variant("v1").slides[0].id).not.toBe(variant("v2").slides[0].id);
  });

  it("é determinístico para a mesma chave", () => {
    expect(variant("v1").slides[0].id).toBe(variant("v1").slides[0].id);
  });
});

describe("deckImages", () => {
  it("encontra imagens em todos os sítios onde podem estar", () => {
    const withImages: StudioDeck = {
      theme: "arqvertice-minimal",
      origin: null,
      slides: [
        {
          id: "s1",
          layout: "text-image",
          eyebrow: "",
          title: "A",
          body: "",
          elements: [
            { kind: "image", id: "i1", url: "https://x/1.jpg", alt: "Foto", fit: "cover", background: false, source: "project" },
            { kind: "gallery", id: "g1", images: [{ url: "https://x/2.jpg", alt: "", source: "library" }] },
            {
              kind: "cards",
              id: "c1",
              variant: "grid",
              items: [{ title: "T", body: "", image: { url: "https://x/3.jpg", alt: null, source: "ai" } }],
            },
          ],
          hidden: false,
          notes: "",
        },
      ],
    };

    const found = deckImages(withImages);
    expect(found.map((image) => image.url)).toEqual(["https://x/1.jpg", "https://x/2.jpg", "https://x/3.jpg"]);
    // A origem viaja com a imagem: o cliente tem de poder notar uma gerada por IA.
    expect(found.map((image) => image.source)).toEqual(["project", "library", "ai"]);
  });

  it("devolve lista vazia para um deck sem imagens", () => {
    expect(deckImages(deck())).toEqual([]);
  });
});
/**
 * COMPARATIVO (item 17).
 *
 * Estes testes cobrem duas coisas que já esteve erradas e que ninguém notaria a
 * olho: uma alteração que só toca nos ELEMENTOS (trocar uma imagem, mudar uma
 * célula de tabela) aparecia como "inalterada", e o indicador de âmbito não
 * sabia qual era a página alvo — o que fazia uma alteração localized e correcta
 * ser reportada como tendo saído do âmbito.
 */
describe("comparativo original vs alterado (item 17)", () => {
  const base = deck();

  it("detecta uma alteração só dentro dos elementos", () => {
    const next: StudioDeck = {
      ...base,
      slides: base.slides.map((s) =>
        s.id === "s1"
          ? { ...s, elements: [{ kind: "text" as const, id: "e1", role: "body" as const, text: "Outro texto" }] }
          : s,
      ),
    };
    const result = previewChanges(base, next);
    expect(result.modified).toBe(1);
    expect(result.changes[0].kind).toBe("CONTEUDO");
  });

  it("detecta a troca de uma imagem sem mexer no texto", () => {
    const withImage: StudioDeck = {
      ...base,
      slides: base.slides.map((s) =>
        s.id === "s1"
          ? {
              ...s,
              elements: [
                { ...s.elements[0] },
                { kind: "image" as const, id: "img", url: "/a.jpg", alt: "a", fit: "cover" as const, background: false, source: "project" as const },
              ],
            }
          : s,
      ),
    };
    expect(previewChanges(base, withImage).modified).toBe(1);
    expect(previewChanges(withImage, base).modified).toBe(1);
  });

  it("uma alteração na página alvo continua dentro do âmbito", () => {
    const next: StudioDeck = {
      ...base,
      slides: base.slides.map((s) => (s.id === "s1" ? { ...s, title: "Nova capa" } : s)),
    };
    expect(previewChanges(base, next, "SLIDE", { kind: "SLIDE", slideId: "s1" }).scoped).toBe(true);
  });

  it("assinala quando a alteração saiu do âmbito", () => {
    const next: StudioDeck = {
      ...base,
      slides: base.slides.map((s) => (s.id === "s1" ? { ...s, title: "Nova capa" } : s)),
    };
    // O comando dizia "página 2"; a página 1 foi mexida na mesma.
    expect(previewChanges(base, next, "SLIDE", { kind: "SLIDE", slideId: "s2" }).scoped).toBe(false);
  });

  it("um comando de elemento também conhece o seu alvo", () => {
    const next: StudioDeck = {
      ...base,
      slides: base.slides.map((s) =>
        s.id === "s1" ? { ...s, elements: [{ ...s.elements[0], text: "Novo" }] } : s,
      ),
    };
    const selection = { kind: "ELEMENTO" as const, slideId: "s1", elementId: "e1" };
    expect(previewChanges(base, next, "ELEMENTO", selection).scoped).toBe(true);
  });

  it("sem âmbito, compara o deck inteiro", () => {
    expect(previewChanges(base, base).scoped).toBe(true);
  });

  it("detecta notas e visibilidade, que o título não mostra", () => {
    const next: StudioDeck = { ...base, slides: base.slides.map((s) => (s.id === "s1" ? { ...s, hidden: true } : s)) };
    expect(previewChanges(base, next).modified).toBe(1);
  });
});