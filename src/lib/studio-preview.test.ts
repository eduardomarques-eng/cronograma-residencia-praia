import { describe, expect, it } from "vitest";
import {
  getPreviewDevice,
  goToSlide,
  initialPreviewState,
  nextSlide,
  PREVIEW_MODES,
  previousSlide,
  previewScale,
  publicationFingerprint,
  setPreviewMode,
  visibleSlides,
  type PreviewMode,
} from "./studio-preview";
import { readStudioDeck, toPersistedDeck } from "./studio-deck";
import { referenceDeck } from "./studio-reference";

/**
 * FASE 4D — VISUALIZAR (item 39).
 *
 * O item 39 pede cinco modos e proíbe, na mesma frase, um renderer por modo. A
 * forma verificável dessa proibição é simples: todos os modos têm de descrever a
 * MESMA coisa. Um modo que levasse conteúdo próprio — ou um factor de escala fixo
 * — reintroduzia a divergência que o item quer eliminar.
 */

const deck = readStudioDeck(
  toPersistedDeck({
    theme: "arqvertice-minimal",
    origin: null,
    slides: [
      { id: "a", layout: "cover", eyebrow: "", title: "Capa", body: "", hidden: false, notes: "", elements: [] },
      { id: "b", layout: "scope", eyebrow: "", title: "Escopo", body: "", hidden: true, notes: "", elements: [] },
      { id: "c", layout: "cta", eyebrow: "", title: "Fim", body: "", hidden: false, notes: "", elements: [] },
    ],
  }),
);

describe("os cinco modos do item 39", () => {
  it("são desktop, tablet, celular, apresentação e tela cheia", () => {
    expect(PREVIEW_MODES.map((device) => device.mode)).toEqual([
      "DESKTOP",
      "TABLET",
      "CELULAR",
      "APRESENTACAO",
      "TELA_CHEIA",
    ]);
  });

  it("todos têm rótulo em português para o ADMIN", () => {
    for (const device of PREVIEW_MODES) expect(device.label.length).toBeGreaterThan(0);
  });

  it("NENHUM modo decide o conteúdo: só a moldura", () => {
    /*
     * Esta é a proibição do item 39, verificada. Se um modo levasse um campo de
     * conteúdo — um `renderer`, um `variant`, um booleano "é celular" — o
     * preview voltaria a divergir do publicado, que é o que o item proíbe.
     */
    for (const device of PREVIEW_MODES) {
      expect(Object.keys(device).sort(), device.mode).toEqual(
        ["frameHeight", "height", "label", "mode", "width"].sort(),
      );
    }
  });

  it("apresentação e tela cheia não usam moldura de dispositivo", () => {
    // Uma moldura de telemóvel em modo apresentação seria absurdo; e a moldura
    // é a ÚNICA diferença entre os modos.
    expect(getPreviewDevice("APRESENTACAO").frameHeight).toBeNull();
    expect(getPreviewDevice("TELA_CHEIA").frameHeight).toBeNull();
  });

  it("os três dispositivos têm moldura", () => {
    for (const modo of ["DESKTOP", "TABLET", "CELULAR"] as PreviewMode[]) {
      expect(getPreviewDevice(modo).frameHeight, modo).toBeGreaterThan(0);
    }
  });

  it("desconhece um modo com o primeiro, em vez de falhar", () => {
    expect(getPreviewDevice("INVENTADO" as PreviewMode).mode).toBe("DESKTOP");
  });
});

describe("escala", () => {
  it("reduz o conteúdo quando a moldura é mais estreita que a largura de conteúdo", () => {
    expect(previewScale("DESKTOP", 640)).toBeCloseTo(0.5);
  });

  it("NUNCA amplia acima de 1", () => {
    // Uma proposta maior do que a referência parece um desenho infantil e deixa de
    // ser uma pré-visualização do que o cliente vê.
    expect(previewScale("CELULAR", 4000)).toBe(1);
  });

  it("devolve 1 para uma largura inválida, sem partir", () => {
    for (const largura of [0, -100, Number.NaN]) {
      expect(previewScale("DESKTOP", largura), String(largura)).toBe(1);
    }
  });

  it("é a MESMA em todos os modos, para a mesma largura", () => {
    /*
     * Esta é a proibição do item 39, verificada na prática. Se a escala dependesse
     * do modo, cada modo estaria a mostrar o conteúdo com uma proporção diferente
     * — que é exactamente o "renderer diferente para cada modo" que o item proíbe.
     */
    for (const modo of PREVIEW_MODES.map((device) => device.mode)) {
      expect(previewScale(modo, 800), modo).toBe(previewScale("DESKTOP", 800));
    }
  });

  it("uma moldura larga mostra a proposta à escala natural", () => {
    // Numa janela de 2560 px não se amplia: a proposta fica no tamanho em que foi
    // desenhada, e o resto é margem.
    expect(previewScale("TELA_CHEIA", 2560)).toBe(1);
  });
});

describe("navegação entre slides", () => {
  const total = deck.slides.length;

  it("começa na primeira página", () => {
    expect(initialPreviewState().index).toBe(0);
  });

  it("avança e recua", () => {
    const segundo = nextSlide(initialPreviewState(), total);
    expect(segundo.index).toBe(1);
    expect(previousSlide(segundo, total).index).toBe(0);
  });

  it("NÃO dá a volta no fim", () => {
    /*
     * Dar a volta é o que faz um leitor de PDF saltar do fim para o início sem
     * querer. Num documento comercial lido ao lado do cliente, saltava-se para a
     * capa e o ADMIN perdia o fio da conversa.
     */
    const ultima = goToSlide(initialPreviewState(), total - 1, total);
    expect(nextSlide(ultima, total).index).toBe(total - 1);
    expect(previousSlide(initialPreviewState(), total).index).toBe(0);
  });

  it("satura em vez de aceitar um índice impossível", () => {
    expect(goToSlide(initialPreviewState(), 99, total).index).toBe(total - 1);
    expect(goToSlide(initialPreviewState(), -5, total).index).toBe(0);
  });

  it("não parte com um deck vazio", () => {
    const estado = initialPreviewState();
    expect(nextSlide(estado, 0).index).toBe(0);
    expect(previousSlide(estado, 0).index).toBe(0);
  });

  it("muda de modo mantendo a página", () => {
    expect(setPreviewMode(goToSlide(initialPreviewState(), 2, total), "CELULAR").index).toBe(2);
  });

  it("tela cheia só nos dois modos grandes", () => {
    // Num telemóvel, a tela cheia mostraria um ecrã de computador dentro de um
    // ecrã de telemóvel.
    expect(setPreviewMode(initialPreviewState(), "CELULAR").fullscreen).toBe(false);
    expect(setPreviewMode(initialPreviewState(), "TELA_CHEIA").fullscreen).toBe(true);
  });
describe("o preview é o documento publicado (item 39)", () => {
  const documento = {
    title: "Transformação & Design de Interiores",
    total: 2_240,
    services: [
      { name: "Projeto Executivo", quantity: 56, subtotal: 2_240 },
      { name: "Marcenaria", quantity: 1, subtotal: 0 },
    ],
    installments: [
      { label: "Entrada", percent: 30, amount: 672 },
      { label: "Segunda parcela", percent: 35, amount: 784 },
      { label: "Terceira parcela", percent: 35, amount: 784 },
    ],
    slides: [{ title: "Escopo", body: "Plantas, elétrica e marcenaria." }],
  };

  it("dois cálculos dos MESMOS dados dão a mesma impressão", () => {
    // A garantia do item 39: se o preview e a publicação calculassem de forma
    // diferente, o preview mentiria. A impressão digital é o que prova que não.
    expect(publicationFingerprint(documento)).toBe(publicationFingerprint({ ...documento }));
  });

  it("um total diferente muda a impressão", () => {
    // É o que faz a verificação valer: tem de falhar quando o conteúdo diverge.
    expect(publicationFingerprint({ ...documento, total: 2_241 })).not.toBe(
      publicationFingerprint(documento),
    );
  });

  it("uma parcela diferente muda a impressão", () => {
    expect(publicationFingerprint({ ...documento, installments: documento.installments.slice(0, 2) })).not.toBe(
      publicationFingerprint(documento),
    );
  });

  it("uma quantidade diferente muda a impressão", () => {
    const alterado = { ...documento, services: [{ ...documento.services[0], quantity: 57 }] };
    expect(publicationFingerprint(alterado)).not.toBe(publicationFingerprint(documento));
  });

  it("um serviço apagado muda a impressão", () => {
    // O caso do item 32: uma melhoria que perdesse uma linha de escopo.
    expect(publicationFingerprint({ ...documento, services: [documento.services[0]] })).not.toBe(
      publicationFingerprint(documento),
    );
  });

  it("a ordem das parcelas conta", () => {
    // "30/35/35" e "35/30/35" são a mesma soma e propostas diferentes.
    const trocada = {
      ...documento,
      installments: [documento.installments[1], documento.installments[0], documento.installments[2]],
    };
    expect(publicationFingerprint(trocada)).not.toBe(publicationFingerprint(documento));
  });
});
});

describe("páginas visíveis", () => {
  it("esconde as páginas marcadas como ocultas", () => {
    // A mesma regra da publicação pública: duas listas diferentes seriam outra
    // forma de o preview divergir do publicado.
    expect(visibleSlides(deck).map((slide) => slide.id)).toEqual(["a", "c"]);
  });

  it("a referência tem nove páginas visíveis", () => {
    expect(visibleSlides(referenceDeck())).toHaveLength(9);
  });
});