import { describe, expect, it } from "vitest";
import { resolvePortfolioSelection, type PortfolioImage } from "./portfolio";

/**
 * Prompt 18, itens 14 a 18 — overrides de portfólio.
 *
 * A pendência 5 era real: o override mantinha o `id` do original, Tornado o
 * documento a apontar a uma imagem que não estava a ser mostrada. Estes testes
 * fixam a identidade correcta: original preservado, imagem final com o seu id.
 */

const imagens: PortfolioImage[] = [
  { id: "arq-1", url: "/arq1.jpg", disciplines: ["ARQUITETURA"], active: true, displayOrder: 1 },
  { id: "arq-2", url: "/arq2.jpg", disciplines: ["ARQUITETURA"], active: true, displayOrder: 2 },
  { id: "est-1", url: "/est1.jpg", disciplines: ["ARQUITETURA", "ESTRUTURAL"], active: true, displayOrder: 3 },
  { id: "off-1", url: "/off1.jpg", disciplines: ["ARQUITETURA"], active: false, displayOrder: 4 },
];

const contexto = { discipline: "ARQUITETURA" };

describe("resolvePortfolioSelection — identidade do item resolvido", () => {
  it("sem override, o item final é o original", () => {
    const [primeiro] = resolvePortfolioSelection({ images: imagens, context: contexto, limit: 1 });
    expect(primeiro.state).toBe("ORIGINAL");
    expect(primeiro.originalId).toBe("arq-1");
    expect(primeiro.image.id).toBe("arq-1");
    expect(primeiro.overrideId).toBeNull();
  });

  it("com override, a imagem final tem o ID DA SUBSTITUTA (item 15)", () => {
    const [item] = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1" },
      limit: 1,
    });
    // A pendência: antes devolvia o id do original. Agora é o da substituta.
    expect(item.state).toBe("SUBSTITUIDA");
    expect(item.image.id).toBe("est-1");
    expect(item.image.url).toBe("/est1.jpg");
    // E a identidade original continua preservada, para rasto.
    expect(item.originalId).toBe("arq-1");
    expect(item.overriddenBy).toBe("arq-1");
  });

  it("preserva a pontuação de adequação ao contexto (item 17)", () => {
    const semOverride = resolvePortfolioSelection({ images: imagens, context: contexto, limit: 1 })[0];
    const comOverride = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1" },
      limit: 1,
    })[0];
    // A pontuação mede adequação ao espaço, não qualidade da imagem.
    expect(comOverride.score).toBe(semOverride.score);
    expect(comOverride.order).toBe(semOverride.order);
  });

  it("suporta múltiplas substituições na mesma selecção", () => {
    const items = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1", "arq-2": "arq-1" },
      limit: 3,
    });
    const substitui = items.filter((i) => i.state === "SUBSTITUIDA");
    expect(substitui.length).toBe(2);
    for (const item of substitui) {
      expect(item.image.id).not.toBe(item.originalId);
    }
  });

  it("override para '' remove o item mas regista a decisão (item 15)", () => {
    const items = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "" },
      limit: 3,
    });
    const removido = items.find((i) => i.state === "REMOVIDA");
    expect(removido).toBeDefined();
    expect(removido?.originalId).toBe("arq-1");
    expect(removido?.reasons.join(" ")).toContain("removida pelo ADMIN");
  });

  it("override para imagem inexistente mantém o original (item 18)", () => {
    const [item] = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "nao-existe" },
      limit: 1,
    });
    expect(item.state).toBe("ORIGINAL");
    expect(item.image.id).toBe("arq-1");
    expect(item.reasons.join(" ")).toContain("substituição inválida");
  });

  it("override para item desativado mantém o original (item 18)", () => {
    const [item] = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "off-1" },
      limit: 1,
    });
    expect(item.state).toBe("ORIGINAL");
    expect(item.image.id).toBe("arq-1");
  });

  it("nunca selecciona item desativado", () => {
    const items = resolvePortfolioSelection({ images: imagens, context: contexto, limit: 10 });
    expect(items.map((i) => i.image.id)).not.toContain("off-1");
  });

  it("remoção do override restaura a imagem original (item 18)", () => {
    const comOverride = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1" },
      limit: 1,
    })[0];
    const semOverride = resolvePortfolioSelection({ images: imagens, context: contexto, limit: 1 })[0];
    expect(comOverride.image.id).toBe("est-1");
    expect(semOverride.image.id).toBe("arq-1");
  });

  it("é determinístico: mesma entrada, mesmo resultado", () => {
    const a = resolvePortfolioSelection({ images: imagens, context: contexto, overrides: { "arq-1": "est-1" }, limit: 3 });
    const b = resolvePortfolioSelection({ images: [...imagens].reverse(), context: contexto, overrides: { "arq-1": "est-1" }, limit: 3 });
    expect(b.map((i) => i.image.id)).toEqual(a.map((i) => i.image.id));
  });
});

describe("resolvePortfolioSelection — proposta nova vs. já gerada (item 18)", () => {
  it("o resultado não depende de haver proposta anterior: só do override persistido", () => {
    // "Proposta nova" e "proposta já gerada" usam a mesma função e o mesmo
    // override persistido na versão; não existe estado escondido entre elas.
    const primeira = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1" },
      limit: 2,
    });
    const segunda = resolvePortfolioSelection({
      images: imagens,
      context: contexto,
      overrides: { "arq-1": "est-1" },
      limit: 2,
    });
    expect(segunda).toEqual(primeira);
  });
});
