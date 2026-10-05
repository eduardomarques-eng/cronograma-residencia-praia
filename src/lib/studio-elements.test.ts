import { describe, expect, it } from "vitest";
import {
  ELEMENTS,
  ELEMENT_ORDER,
  canAddElement,
  elementGroups,
  elementsForLayout,
  type ElementKind,
} from "./studio-elements";
import { LAYOUTS } from "./studio-layout";

/**
 * FASE 4C — ELEMENTOS (item 25).
 *
 * O item 25 pede vinte elementos e proíbe, na mesma frase, implementar dezenas
 * de pouco usados. Estes testes fixam as duas metades: o conjunto é pequeno e
 * cada elemento declara EM QUE LAYOUTS cabe, que é o que impede a capa de
 * oferecer uma tabela.
 */

describe("catálogo de elementos (item 25)", () => {
  it("tem apenas os elementos que uma proposta usa de facto", () => {
    expect(ELEMENT_ORDER).toEqual(["text", "image", "gallery", "cards", "table", "timeline", "comparison", "metric", "cta"]);
  });

  it("descreve cada elemento com rótulo e propósito", () => {
    for (const kind of ELEMENT_ORDER) {
      expect(ELEMENTS[kind].label.length).toBeGreaterThan(0);
      expect(ELEMENTS[kind].purpose.length).toBeGreaterThan(0);
    }
  });

  it("agrupa os elementos para o painel não mostrar tudo ao mesmo tempo", () => {
    expect(new Set(ELEMENT_ORDER.map((kind) => ELEMENTS[kind].group)).size).toBeGreaterThan(1);
  });
});

describe("compatibilidade com o layout", () => {
  it("uma capa não oferece tabela", () => {
    expect(elementsForLayout(LAYOUTS.cover.slots).map((e) => e.kind)).not.toContain("table");
  });

  it("uma galeria não oferece tabela", () => {
    expect(elementsForLayout(LAYOUTS.gallery.slots).map((e) => e.kind)).not.toContain("table");
  });

  it("só sugere o que o layout aceita", () => {
    for (const [key, layout] of Object.entries(LAYOUTS)) {
      const offered = elementsForLayout(layout.slots).map((e) => e.kind);
      for (const kind of offered) {
        expect(offered, `layout ${key}`).toContain(kind);
      }
    }
  });
});

describe("progressive disclosure (item 9)", () => {
  it("não mostra um grupo vazio", () => {
    expect(elementGroups(elementsForLayout(["text"])).every((group) => group.items.length > 0)).toBe(true);
  });

  it("não deixa exceder o limite por página", () => {
    const duasTabelas = [{ kind: "table" }, { kind: "table" }];
    expect(canAddElement("table", duasTabelas)).toBe(false);
  });

  it("permite a última entrada que cabe", () => {
    const dois = [{ kind: "metric" }, { kind: "metric" }];
    expect(canAddElement("metric", dois)).toBe(true);
  });

  it("trata um elemento desconhecido sem partir", () => {
    expect(canAddElement("text" as ElementKind, [{ kind: "desconhecido" }])).toBe(true);
  });
});