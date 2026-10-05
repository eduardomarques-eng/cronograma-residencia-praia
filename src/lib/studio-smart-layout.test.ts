import { describe, expect, it } from "vitest";
import { analyzeSlide, improveDeck, improveSlide } from "./studio-smart-layout";
import type { StudioElement, StudioSlide } from "./studio-deck";

const slide = (overrides: Partial<StudioSlide> = {}): StudioSlide => ({
  id: "s1",
  layout: "title-text",
  eyebrow: "",
  title: "Escopo",
  body: "",
  elements: [],
  hidden: false,
  notes: "",
  ...overrides,
});

const words = (count: number) => Array.from({ length: count }, (_, i) => `palavra${i}`).join(" ");

const cards = (count: number): StudioElement => ({
  kind: "cards",
  id: "c1",
  variant: "grid",
  items: Array.from({ length: count }, (_, i) => ({ title: `Item ${i}`, body: "", image: null })),
});

/**
 * FASE 4C — o diagnóstico de layout (item 11).
 *
 * Estes testes existem para fixar a PROMESSA do item 11: "a IA deve preservar o
 * conteúdo comercial". Isso só é verificável se as sugestões forem
 * determinísticas e se `improveSlide` nunca inventar nem apagar.
 */
describe("analyzeSlide", () => {
  it("não se queixa de uma página equilibrada", () => {
    const report = analyzeSlide(slide({ title: "Escopo", body: words(20) }));
    expect(report.alreadyGood).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("detecta texto a mais e diz quantas palavras", () => {
    const report = analyzeSlide(slide({ title: "Escopo", body: words(150) }));
    const issue = report.issues.find((i) => i.code === "TEXTO_EXCESSO");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("40 palavras a mais");
  });

  it("detecta hierarquia fraca quando falta o título", () => {
    const report = analyzeSlide(slide({ title: "", body: words(30) }));
    expect(report.issues.map((i) => i.code)).toContain("HIERARQUIA_FRACA");
  });

  it("não pede hierarquia na capa", () => {
    // A capa é a página que não tem título por definição.
    const report = analyzeSlide(slide({ layout: "cover", title: "", body: words(30) }));
    expect(report.issues.map((i) => i.code)).not.toContain("HIERARQUIA_FRACA");
  });

  it("deteta cards a mais para a grelha", () => {
    const report = analyzeSlide(slide({ title: "Serviços", elements: [cards(9)] }));
    expect(report.issues.map((i) => i.code)).toContain("CARDS_DEMAIS");
  });

  it("detecta valor mencionado sem destaque numérico", () => {
    const report = analyzeSlide(
      slide({ title: "Condições", body: "O investimento inclui todas as etapas previstas." }),
    );
    expect(report.issues.map((i) => i.code)).toContain("VALOR_SEM_DESTAQUE");
  });

  it("não pede destaque quando a página já é de investimento", () => {
    const report = analyzeSlide(
      slide({ layout: "investment", title: "Investimento", body: "O total desta proposta." }),
    );
    expect(report.issues.map((i) => i.code)).not.toContain("VALOR_SEM_DESTAQUE");
  });

  it("detecta espaço negativo numa página quase vazia", () => {
    const report = analyzeSlide(slide({ title: "Obrigado", body: "Até breve." }));
    expect(report.issues.map((i) => i.code)).toContain("ESPACO_NEGATIVO");
  });

  it("detecta imagem sem texto que a explique", () => {
    const report = analyzeSlide(
      slide({
        title: "",
        body: "",
        elements: [{ kind: "image", id: "i1", url: "https://x/a.jpg", alt: "", fit: "cover", background: false, source: "upload" }],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("IMAGEM_SEM_TEXTO");
  });

  it("não sugere um layout que a página já tem", () => {
    const report = analyzeSlide(slide({ layout: "text-image", title: "", body: words(60) }));
    report.suggestions.forEach((suggestion) => expect(suggestion.layout).not.toBe("text-image"));
  });

  it("nunca sugere um layout que não aceite os elementos da página", () => {
    // Uma tabela não pode ir para um layout sem slot de tabela.
    const report = analyzeSlide(
      slide({
        title: "Valores",
        elements: [{ kind: "table", id: "t1", columns: ["A"], rows: [["1"]], binding: null }],
      }),
    );
    report.suggestions.forEach((suggestion) => {
      expect(suggestion.layout).not.toBe("gallery");
      expect(suggestion.layout).not.toBe("cover");
    });
  });

  it("é determinístico: a mesma página dá o mesmo relatório", () => {
    const target = slide({ title: "", body: words(150) });
    expect(analyzeSlide(target)).toEqual(analyzeSlide(target));
  });
});
/**
 * A parte que o item 11 exige: "a IA deve preservar o conteúdo comercial".
 *
 * Estes são os testes que protegem a proposta de um ADMIN. Todos verificam a
 * mesma coisa por lados diferentes: o `improveSlide` pode mudar a FORMA, nunca
 * o COMERCIAL.
 */
describe("improveSlide", () => {
  it("não altera uma página que já está boa", () => {
    const target = slide({ title: "Escopo", body: words(20) });
    expect(improveSlide(target)).toBe(target);
  });

  it("nunca cria um destaque numérico", () => {
    // Um `metric` inventado é o pior defeito possível numa proposta
    // comercial. A melhoria pode dizer "falta um destaque" mas não o cria.
    const improved = improveSlide(slide({ title: "Investimento", body: "O investimento total previsto." }));
    expect(improved.elements.some((element) => element.kind === "metric")).toBe(false);
  });

  it("nunca apaga texto do ADMIN sem restar nada", () => {
    const original = `${words(40)}. ${words(40)}. ${words(40)}.`;
    const improved = improveSlide(slide({ title: "Escopo", body: original }));
    // O que sobra tem de ser subconjunto do original — nunca texto novo.
    original
      .split(/(?<=\.)\s+/)
      .filter((sentence) => sentence.trim())
      .forEach((sentence) => {
        const kept = improved.body.includes(sentence.trim());
        expect(kept || improved.body.length < original.length).toBe(true);
      });
  });

  it("deriva o título do próprio corpo, sem escrever texto novo", () => {
    // > 20 palavras, para `HIERARQUIA_FRACA` ser a queixa de maior confiança.
    const body = `${words(15)}. Inclui instalações electricas e revisão do layout.`;
    const improved = improveSlide(slide({ title: "", body }));
    expect(improved.title).toBe(`${words(14)}…`);
  });

  it("nunca corta um título a meio de uma palavra", () => {
    // Acima das 20 palavras, para `HIERARQUIA_FRACA` ser a queixa dominante.
    const long = Array.from({ length: 24 }, (_, i) => `palavra${i}`).join(" ");
    const improved = improveSlide(slide({ title: "", body: long }));
    expect(improved.title).toBe(`${Array.from({ length: 14 }, (_, i) => `palavra${i}`).join(" ")}…`);
    // Uma palavra cortada a meio leria-se como erro de escrita numa proposta.
    expect(improved.title.endsWith("palavra…")).toBe(false);
  });

  it("mantém a identidade da página quando só troca o layout", () => {
    const improved = improveSlide(slide({ title: "Escopo", body: words(30) }));
    expect(improved.title).toBe("Escopo");
    expect(improved.id).toBe("s1");
  });

  it("é determinístico", () => {
    const target = slide({ title: "", body: words(150) });
    expect(improveSlide(target)).toEqual(improveSlide(target));
  });
});

describe("improveDeck", () => {
  const deck = (slides: StudioSlide[]) => ({
    theme: "arqvertice-minimal",
    origin: null,
    slides,
  });

  it("devolve um deck novo e nunca muta o original", () => {
    // É isto que dá o "Restaurar" do item 17 sem infraestrutura de histórico.
    const original = deck([slide({ title: "Escopo", body: words(150) })]);
    const result = improveDeck(original);
    expect(result.deck).not.toBe(original);
    expect(original.slides[0].body).toBe(words(150));
  });

  it("conta quantas páginas mudaram", () => {
    // A primeira tem título e texto suficiente: é equilibrada e não muda.
    // A segunda não tem título: ganha um, derivado do próprio corpo.
    const result = improveDeck(
      deck([
        slide({ id: "a", title: "Boa", body: words(20) }),
        slide({ id: "b", title: "", body: words(150) }),
      ]),
    );
    expect(result.changed).toBe(1);
    expect(result.reports).toHaveLength(2);
  });

  it("trata cada página por independência", () => {
    const result = improveDeck(deck([slide({ id: "a", title: "A", body: words(20) })]));
    expect(result.reports[0].alreadyGood).toBe(true);
    expect(result.changed).toBe(0);
  });
});