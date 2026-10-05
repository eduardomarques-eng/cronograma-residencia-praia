import { describe, expect, it } from "vitest";
import {
  changedSlides,
  imageProps,
  imageSrcSet,
  presentationUnchanged,
  sameSlide,
  untouchedVisibleSlides,
  visibleWindow,
  windowed,
} from "./studio-perf";
import { updateElement } from "./studio-manipulate";
import type { StudioDeck } from "./studio-deck";

const deck = (count = 5): StudioDeck => ({
  theme: "arqvertice-minimal",
  origin: null,
  slides: Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    layout: "title-text" as const,
    eyebrow: "",
    title: `Página ${index + 1}`,
    body: "",
    elements: [{ kind: "text" as const, id: `e${index + 1}`, role: "body" as const, text: "Texto" }],
    hidden: false,
    notes: "",
  })),
});

describe("item 50 — alterar um elemento não reconstrói a apresentação", () => {
  it("só a página tocada é diferente", () => {
    // A afirmação central do item 50, verificável.
    const antes = deck();
    const depois = updateElement(antes, 2, "e3", { text: "Novo texto" });
    expect(changedSlides(antes, depois)).toEqual([2]);
  });

  it("as páginas não tocadas mantêm o MESMO objecto", () => {
    // A partilha de estrutura é o que permite ao React saltar o redesenho.
    const antes = deck();
    const depois = updateElement(antes, 0, "e1", { text: "Novo" });
    expect(depois.slides[1]).toBe(antes.slides[1]);
    expect(depois.slides[4]).toBe(antes.slides[4]);
  });

  it("diz quais as páginas que se podem reaproveitar", () => {
    const antes = deck();
    const depois = updateElement(antes, 1, "e2", { text: "Novo" });
    expect(untouchedVisibleSlides(antes, depois)).toEqual(["s1", "s3", "s4", "s5"]);
  });

  it("uma alteração que não muda nada não é uma alteração", () => {
    const antes = deck();
    expect(presentationUnchanged(antes, antes)).toBe(true);
  });

  it("uma troca de imagem conta como alteração", () => {
    // Uma assinatura que ignorasse os elementos diria "nada mudou" e o editor
    // deixaria de desenhar a página que mudou.
    const antes = deck();
    const depois: StudioDeck = {
      ...antes,
      slides: antes.slides.map((slide, index) =>
        index === 0
          ? { ...slide, elements: [{ kind: "image" as const, id: "i1", url: "/a.jpg", alt: "", fit: "cover", background: false, source: "library" }] }
          : slide,
      ),
    };
    expect(changedSlides(antes, depois)).toEqual([0]);
  });

  it("uma página escondida não é reaproveitável", () => {
    const antes = deck();
    const depois: StudioDeck = {
      ...antes,
      slides: antes.slides.map((slide, index) => (index === 1 ? { ...slide, hidden: true } : slide)),
    };
    expect(untouchedVisibleSlides(antes, depois)).not.toContain("s2");
  });

  it("trata páginas em falta como alteradas", () => {
    const antes = deck(3);
    const depois = deck(4);
    expect(changedSlides(antes, depois)).toEqual([3]);
  });

  it("sameSlide compara por conteúdo quando não são o mesmo objecto", () => {
    const [a] = deck().slides;
    expect(sameSlide(a, { ...a })).toBe(true);
    expect(sameSlide(a, { ...a, title: "Outra" })).toBe(false);
    expect(sameSlide(undefined, a)).toBe(false);
  });
});

describe("item 50 — imagens leves", () => {
  it("carrega as imagens só quando são precisas", () => {
    const props = imageProps({ url: "/foto.jpg", alt: "Fachada" });
    expect(props.loading).toBe("lazy");
  });

  it("a capa carrega de imediato", () => {
    // É a primeira coisa que o cliente vê.
    expect(imageProps({ url: "/capa.jpg", priority: true }).loading).toBe("eager");
  });

  it("decodifica de forma assíncrona", () => {
    expect(imageProps({ url: "/foto.jpg" }).decoding).toBe("async");
  });

  it("pede várias resoluções em vez da máxima", () => {
    const props = imageProps({ url: "/foto.jpg" });
    expect(props.srcSet).toContain("w=160");
    expect(props.srcSet).toContain("w=1440");
  });

  it("não inventa srcSet para um URL que não aceita parâmetros", () => {
    expect(imageSrcSet("data:image/png;base64,AAA")).toBeUndefined();
  });

  it("acrescenta o parâmetro ao URL que já tem query", () => {
    expect(imageSrcSet("/foto.jpg?v=2", [480])).toBe("/foto.jpg?v=2&w=480 480w");
  });
});

describe("item 50 — virtualização quando é necessária", () => {
  it("com poucas páginas, desenha todas — medir não compensa", () => {
    const w = visibleWindow({ total: 5, start: 0, viewport: 10 });
    expect(w).toEqual({ start: 0, end: 5, hasMore: false });
  });

  it("com muitas páginas, desenha só a janela", () => {
    const w = visibleWindow({ total: 100, start: 50, viewport: 10 });
    expect(w.start).toBeLessThan(50);
    expect(w.end).toBeGreaterThan(60);
    expect(w.hasMore).toBe(true);
  });

  it("desenha um pouco à volta para o scroll não ficar em branco", () => {
    const w = visibleWindow({ total: 100, start: 50, viewport: 10, overscan: 3 });
    expect(w.start).toBe(47);
    expect(w.end).toBe(63);
  });

  it("nunca desenha fora da lista", () => {
    const w = visibleWindow({ total: 100, start: 98, viewport: 10 });
    expect(w.end).toBeLessThanOrEqual(100);
  });

  it("devolve os itens da janela", () => {
    const itens = Array.from({ length: 100 }, (_, i) => i);
    expect(windowed(itens, visibleWindow({ total: 100, start: 50, viewport: 4 })).length).toBeLessThan(20);
  });

  it("uma lista vazia não rebenta", () => {
    expect(visibleWindow({ total: 0, start: 0, viewport: 5 })).toEqual({ start: 0, end: 0, hasMore: false });
  });
});