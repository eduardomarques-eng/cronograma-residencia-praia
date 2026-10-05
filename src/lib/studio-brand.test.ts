import { describe, expect, it } from "vitest";
import {
  brandForSlide,
  isBrandVisibleOnSlide,
  NO_BRAND,
  pagesWithoutFooter,
  readBrandIdentity,
  type BrandVisibility,
} from "./studio-brand";
import { blankDeck } from "./studio-templates";
import { referenceDeck } from "./studio-reference";

/**
 * FASE 4D — IDENTIDADE DO DOCUMENTO (item 38).
 *
 * O que este ficheiro protege é uma assimetria: o rodapé esconder-se é um
 * defeito estético, e o aviso de confidencialidade desaparecer é um defeito
 * LEGAL. O item 38 pede os dois na mesma caixa de selecção, e por isso o teste
 * fixa que o aviso tem regra própria — não segue o rodapé.
 */

const deck = referenceDeck();
const [capa] = deck.slides;

describe("identidade vazia", () => {
  it("não mostra nada sem configuração", () => {
    // Um template novo não tem de trazer marca, e a identidade vazia não pode
    // imprimir um separador sozinho.
    for (const [campo, valor] of Object.entries(NO_BRAND)) {
      if (campo === "showPageNumber") continue;
      expect(valor, campo).toBeNull();
    }
  });

  it("mostra o número de página por omissão", () => {
    expect(NO_BRAND.showPageNumber).toBe(true);
  });

  it("devolve cópias distintas, para uma mutação não contaminar a constante", () => {
    const a = readBrandIdentity(null);
    a.companyName = "Alterado";
    expect(readBrandIdentity(null).companyName).toBeNull();
  });
});

describe("visibilidade por omissão", () => {
  it("a identidade e o rodapé ficam fora da capa", () => {
    expect(brandForSlide(deck, 0).identity).toBe(false);
    expect(brandForSlide(deck, 0).rodape).toBe(false);
  });

  it("a identidade e o rodapé ficam fora do encerramento", () => {
    expect(brandForSlide(deck, deck.slides.length - 1).rodape).toBe(false);
  });

  it("aparecem nas páginas do meio", () => {
    for (let position = 1; position < deck.slides.length - 1; position += 1) {
      expect(brandForSlide(deck, position).rodape, `página ${position}`).toBe(true);
    }
  });

  it("o aviso de confidencialidade aparece EM TODAS as páginas", () => {
    /*
     * Esta é a assimetria do item 38. O rodapé é decoração e pode sair da capa;
     * o aviso é protecção, e uma capa sem aviso é um documento que pode circular
     * sem protecção nenhuma. Por isso o aviso ignora a regra editorial.
     */
    for (let position = 0; position < deck.slides.length; position += 1) {
      expect(brandForSlide(deck, position).aviso, `página ${position}`).toBe(true);
    }
  });
});

describe("excepções escolhidas pelo ADMIN", () => {
  it("esconder uma página concreta remove o rodapé dessa página", () => {
    const meio = deck.slides[3];
    const visibility: BrandVisibility = { rodape: [meio.id] };
    expect(brandForSlide(deck, 3, visibility).rodape).toBe(false);
    // E só essa: as vizinhas ficam intactas.
    expect(brandForSlide(deck, 4, visibility).rodape).toBe(true);
  });

  it("a excepção vale por identificador, não por posição", () => {
    /*
     * Reordenar não pode mudar a decisão. A regra é "não nesta página", e a
     * página é identificada por id — pelo mesmo motivo pelo qual a capa e o
     * encerramento se resolvem por POSIÇÃO: cada um usa o que sobrevive à
     * reordenação.
     */
    const alvo = deck.slides[2];
    const visibility: BrandVisibility = { rodape: [alvo.id] };
    const reordenado = { slides: [...deck.slides].reverse() };
    const novaPosicao = reordenado.slides.findIndex((slide) => slide.id === alvo.id);
    expect(brandForSlide(reordenado, novaPosicao, visibility).rodape).toBe(false);
  });

  it("devolve false para uma posição que não existe", () => {
    // Um erro de índice não pode fazer o editor mostrar um rodapé que não existe.
    expect(isBrandVisibleOnSlide(deck, 99, "rodape")).toBe(false);
  });

  it("uma excepção de uma peça não afecta as outras", () => {
    // O ADMIN pode querer o rodapé fora da capa e o aviso presente: são decisões
    // independentes, e partilhá-las seria esconder o aviso sem querer.
    const visibility: BrandVisibility = { rodape: [capa.id] };
    expect(brandForSlide(deck, 0, visibility).aviso).toBe(true);
  });
});

describe("revisão: onde falta rodapé", () => {
  it("lista a capa e o encerramento", () => {
    expect(pagesWithoutFooter(deck)).toEqual([0, deck.slides.length - 1]);
  });

  it("acrescenta as páginas que o ADMIN escondeu", () => {
    const meio = deck.slides[4];
    const visualizacao = pagesWithoutFooter(deck, { rodape: [meio.id] });
    expect(visualizacao).toContain(4);
    expect(visualizacao).toHaveLength(3);
  });

  it("não devolve a mesma página duas vezes num deck de uma só", () => {
    /*
     * Num deck de uma página a capa E o encerramento são a mesma página. Não
     * devolvê-la duas vezes evita que o painel de revisão a liste como "fora da
     * identidade" por dois motivos diferentes.
     */
    expect(pagesWithoutFooter(blankDeck())).toEqual([0]);
  });
});

describe("leitura da identidade gravada", () => {
  it("lê uma identidade completa", () => {
    const brand = readBrandIdentity({
      logoUrl: "/logo.svg",
      professionalName: "Eduardo Marques",
      companyName: "ArqVértice Studio",
      footer: "Todos os direitos reservados",
      confidentialityNotice: "Documento confidencial",
      contact: "WhatsApp",
      showPageNumber: false,
    });
    expect(brand.companyName).toBe("ArqVértice Studio");
    expect(brand.showPageNumber).toBe(false);
    expect(brand.confidentialityNotice).toBe("Documento confidencial");
  });

  it("não lança com Json corrompido", () => {
    // Uma proposta enviada não pode dar 500 por causa de um campo antigo.
    for (const entrada of [null, undefined, "texto", 42, []]) {
      expect(() => readBrandIdentity(entrada)).not.toThrow();
      expect(readBrandIdentity(entrada)).toEqual(NO_BRAND);
    }
  });

  it("trata campo em branco como ausente, em vez de imprimir espaços", () => {
    expect(readBrandIdentity({ footer: "   " }).footer).toBeNull();
  });

  it("ignora campos que não são texto", () => {
    expect(readBrandIdentity({ companyName: { nome: "x" } }).companyName).toBeNull();
  });

  it("mostra o número de página quando o campo falta", () => {
    // Ausente significa "mostrar": é o que uma proposta antiga espera, e o
    // inverso obrigaria o ADMIN a repor a numeração em cada documento novo.
    expect(readBrandIdentity({ companyName: "X" }).showPageNumber).toBe(true);
  });
});