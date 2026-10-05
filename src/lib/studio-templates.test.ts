import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  blankDeck,
  CATEGORY_LABELS,
  duplicateDeck,
  getTemplate,
  nearestTemplate,
  templateFromDeck,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templatesByCategory,
} from "./studio-templates";
import { LAYOUTS } from "./studio-layout";

/**
 * FASE 4D — TEMPLATES (item 37) E COMEÇAR EM BRANCO (item 36).
 *
 * O teste que importa aqui não é "o catálogo tem sete entradas" — isso é uma
 * lista, e uma lista não precisa de testes. O que precisa é das DUAS garantias
 * que o item 37 declara:
 *
 *  · o template original nunca é alterado pela nova proposta;
 *  · começar em branco não depende da IA.
 *
 * Ambas são silenciosas quando funcionam e catastróficas quando não: a primeira
 * entrega o trabalho de um cliente ao outro, e a segunda transforma o editor num
 * produto obrigatório.
 */

describe("catálogo de templates (item 37)", () => {
  it("cobre as sete categorias do item 37", () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(7);
    expect(TEMPLATE_CATEGORIES).toEqual([
      "RESIDENCIAL",
      "INTERIORES",
      "ENGENHARIA",
      "ARQUITETURA",
      "ALTO_PADRAO",
      "COMERCIAL",
      "TECNICO",
    ]);
  });

  it("tem pelo menos um template em cada categoria", () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(templatesByCategory(category).length, category).toBeGreaterThan(0);
    }
  });

  it("tem rótulo em português para cada categoria", () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("é pequeno: qualidade acima de quantidade", () => {
    // O item 37 pede poucos. Este teste impede que o catálogo cresça por
    // acréscimo, sem que ninguém decida que crescer foi um erro.
    expect(TEMPLATES.length).toBeLessThanOrEqual(10);
  });

  it("cada template explica para que serve", () => {
    for (const template of TEMPLATES) {
      expect(template.purpose.length, template.key).toBeGreaterThan(0);
      expect(template.layouts.length, template.key).toBeGreaterThan(0);
    }
  });

  it("só usa layouts que existem no catálogo", () => {
    // Um layout inventado abriria a proposta num inválido sem o ADMIN perceber.
    for (const template of TEMPLATES) {
      for (const layout of template.layouts) {
        expect(Object.keys(LAYOUTS), `${template.key}/${layout}`).toContain(layout);
      }
    }
  });

  it("encontra um template pelo identificador e recusa o que não existe", () => {
    expect(getTemplate("residencial")?.category).toBe("RESIDENCIAL");
    expect(getTemplate("nao-existe")).toBeNull();
  });
describe("aplicar um template (item 37)", () => {
  const template = getTemplate("interiores")!;

  it("cria as páginas na ordem dos layouts", () => {
    const deck = applyTemplate(template, blankDeck());
    expect(deck.slides.slice(0, template.layouts.length).map((slide) => slide.layout)).toEqual([
      ...template.layouts,
    ]);
  });

  it("não altera o deck de origem", () => {
    // A garantia central do item 37: o deck que existia antes fica intocado.
    const original = blankDeck();
    const antes = JSON.stringify(original);
    applyTemplate(template, original);
    expect(JSON.stringify(original)).toBe(antes);
  });

  it("não devolve páginas que partilhem objectos com a origem", () => {
    // Alterar a página nova não pode tocar na antiga. Sem esta verificação, o
    // `insertSlides` poderia devolver referências partilhadas e o defeito só
    // apareceria depois da segunda gravação.
    const original = blankDeck();
    const deck = applyTemplate(template, original);
    deck.slides.forEach((slide) => {
      slide.elements.push({ kind: "text", id: "x", role: "body", text: "mutação" });
    });
    expect(original.slides.some((slide) => slide.elements.some((element) => element.id === "x"))).toBe(false);
  });

  it("não devolve páginas que partilhem objectos com o TEMPLATE", () => {
    const primeiro = applyTemplate(template, blankDeck());
    primeiro.slides[0].title = "alterado";
    expect(applyTemplate(template, blankDeck()).slides[0].title).not.toBe("alterado");
  });

  it("aplica o tema do template", () => {
    expect(applyTemplate(template, blankDeck()).theme).toBe(template.theme);
  });

  it("com `replace` descarta as páginas anteriores", () => {
    const deck = applyTemplate(template, duplicateDeck(blankDeck(), "a"), { replace: true });
    expect(deck.slides).toHaveLength(template.layouts.length);
  });

  it("sem `replace`, as páginas novas vêm à frente e as antigas sobrevivem", () => {
    // A página original sobrevive no fim — é o que permite juntar um template a
    // uma proposta que já tem conteúdo.
    const base = duplicateDeck(blankDeck(), "a");
    expect(applyTemplate(template, base).slides.at(-1)?.layout).toBe(base.slides[0].layout);
  });

  it("põe um título de posição, para o ADMIN saber o que preencher", () => {
    for (const slide of applyTemplate(template, blankDeck()).slides) {
      expect(slide.title.length).toBeGreaterThan(0);
    }
  });
describe("o template original nunca é alterado (item 37)", () => {
  it("duplicar dá o mesmo conteúdo com ids diferentes", () => {
    const base = applyTemplate(getTemplate("arquitetura")!, blankDeck());
    const copia = duplicateDeck(base, "cliente-2");

    expect(copia.slides.map((slide) => slide.layout)).toEqual(base.slides.map((slide) => slide.layout));
    for (let index = 0; index < base.slides.length; index += 1) {
      expect(copia.slides[index].id).not.toBe(base.slides[index].id);
    }
  });

  it("duplicar não altera o original", () => {
    const base = applyTemplate(getTemplate("arquitetura")!, blankDeck());
    const antes = JSON.stringify(base);
    duplicateDeck(base, "cliente-2").slides[0].title = "Cliente 2";
    expect(JSON.stringify(base)).toBe(antes);
  });

  it("duplicar dá elementos com id novo", () => {
    // Sem isto, apagar um elemento no duplicado apagaria o do original.
    const base = blankDeck();
    base.slides[0].elements.push({ kind: "text", id: "el-comum", role: "body", text: "x" });
    expect(duplicateDeck(base, "outro").slides[0].elements[0].id).not.toBe("el-comum");
  });

  it("salvar como template guarda a ESTRUTURA, não o conteúdo", () => {
    // Guardar o conteúdo seria pôr uma proposta dentro de outra, e o próximo
    // cliente a usar o template receberia o texto do anterior.
    const deck = applyTemplate(getTemplate("interiores")!, blankDeck());
    deck.slides[0].title = "Segredo do cliente anterior";

    const template = templateFromDeck(deck);
    expect(template.layouts).toEqual(deck.slides.map((slide) => slide.layout));
    expect(JSON.stringify(template)).not.toContain("Segredo");
  });
});

describe("começar em branco (item 36)", () => {
  it("devolve um deck com uma página, para o editor ter o que mostrar", () => {
    const deck = blankDeck();
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].layout).toBe("cover");
  });

  it("não depende de nenhum modelo de linguagem", () => {
    /*
     * O item 36 diz "IA é assistente, não requisito obrigatório". A verificação
     * é estrutural: `blankDeck` é pura, sem I/O e sem provider — nada no que
     * devolve depende de um serviço externo.
     */
    const deck = blankDeck();
    expect(deck.origin).toBeNull();
    expect(deck.slides[0].elements).toHaveLength(0);
  });

  it("aceita o tema que o ADMIN escolher", () => {
    expect(blankDeck("arqvertice-tecnico").theme).toBe("arqvertice-tecnico");
  });

  it("devolve objectos distintos em cada chamada", () => {
    const a = blankDeck();
    a.slides[0].title = "alterado";
    expect(blankDeck().slides[0].title).not.toBe("alterado");
  });

  it("um template aplicado a um deck em branco abre com a capa do template", () => {
    // A capa do template vem primeiro; a do deck em branco não deve ficar à
    // frente, ou a proposta abriria com duas capas.
    expect(applyTemplate(getTemplate("residencial")!, blankDeck()).slides[0].layout).toBe("cover");
  });
});

describe("escolher o template mais próximo", () => {
  it("reconhece um deck feito a partir de um template", () => {
    expect(nearestTemplate(applyTemplate(getTemplate("interiores")!, blankDeck()))?.key).toBe("interiores");
  });

  it("devolve null para um deck sem pistas", () => {
    // Uma apresentação vazia não se parece com nada; inventar um palpite seria
    // pior do que dizer ao ADMIN para escolher.
    expect(nearestTemplate({ theme: "arqvertice-minimal", origin: null, slides: [] })).toBeNull();
  });
});
});
});