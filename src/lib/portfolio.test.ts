import { describe, expect, it } from "vitest";
import {
  resolvePortfolioSelection,
  selectPortfolioImages,
  scorePortfolioImage,
  type PortfolioImage,
} from "./portfolio";

const imagens: PortfolioImage[] = [
  { id: "img-arq", url: "/a.jpg", disciplines: ["ARQUITETURA"], environments: ["RESIDENCIAL"], active: true },
  { id: "img-est", url: "/b.jpg", disciplines: ["ESTRUTURAL"], active: true },
  { id: "img-inal", url: "/c.jpg", disciplines: ["INTERIORES"], active: true },
  { id: "img-off", url: "/d.jpg", disciplines: ["ARQUITETURA"], active: false },
];

describe("selectPortfolioImages — correspondência contextual", () => {
  it("escolhe a imagem da disciplina contratada", () => {
    const result = selectPortfolioImages(imagens, { discipline: "ARQUITETURA" });
    expect(result.matches[0].image.id).toBe("img-arq");
    expect(result.empty).toBe(false);
  });

  it("prefere a imagem que combina disciplina e ambiente", () => {
    const result = selectPortfolioImages(imagens, { discipline: "ARQUITETURA", environment: "RESIDENCIAL" });
    // 2 (disciplina) + 1 (ambiente) = 3 pontos.
    expect(result.matches[0].score).toBe(3);
    expect(result.matches[0].reasons).toContain("disciplina ARQUITETURA");
  });

  it("não devolve imagem irrelevante quando nada encaixa", () => {
    const result = selectPortfolioImages(imagens, { discipline: "PAISAGISMO" });
    expect(result.empty).toBe(true);
    expect(result.matches).toEqual([]);
  });

  it("ignora imagens desativadas pelo ADMIN", () => {
    const result = selectPortfolioImages(imagens, { discipline: "ARQUITETURA" });
    expect(result.matches.map((m) => m.image.id)).not.toContain("img-off");
  });

  it("normaliza acentos e caixa ao comparar", () => {
    const match = scorePortfolioImage({
      image: { id: "x", url: "/x.jpg", environments: ["Cozinha"] },
      context: { environment: "cozinha" },
    });
    expect(match.score).toBe(1);
  });

  it("desempata de forma estável, sem depender da ordem de entrada", () => {
    const a = selectPortfolioImages(imagens, { discipline: "ARQUITETURA" });
    const b = selectPortfolioImages([...imagens].reverse(), { discipline: "ARQUITETURA" });
    expect(a.matches.map((m) => m.image.id)).toEqual(b.matches.map((m) => m.image.id));
  });
});

describe("resolvePortfolioSelection — fonte única de overrides (itens 19 e 20)", () => {
  it("o gerador, o preview e a página pública obtêm o mesmo resultado", () => {
    const overrides = { "img-arq": "img-est" };
    const primeiro = resolvePortfolioSelection({
      images: imagens,
      context: { discipline: "ARQUITETURA" },
      overrides,
      limit: 3,
    });
    const segundo = resolvePortfolioSelection({
      images: imagens,
      context: { discipline: "ARQUITETURA" },
      overrides,
      limit: 3,
    });
    expect(segundo.map((i) => i.image.id)).toEqual(primeiro.map((i) => i.image.id));
  });

  it("a substituição preserva a pontuação de adequação e devolve o id da substituta", () => {
    const selection = selectPortfolioImages(imagens, { discipline: "ARQUITETURA" });
    const [item] = resolvePortfolioSelection({
      images: imagens,
      context: { discipline: "ARQUITETURA" },
      overrides: { "img-arq": "img-est" },
      limit: 1,
    });
    // A pendência 5: antes mantinha-se o id do original. Agora é o da substituta.
    expect(item.image.id).toBe("img-est");
    // A pontuação é de adequação ao contexto e não muda com a substituição.
    expect(item.score).toBe(selection.matches[0].score);
    expect(item.reasons).toContain("substituída pelo ADMIN");
  });
});
