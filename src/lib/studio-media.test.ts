import { describe, expect, it } from "vitest";
import {
  MEDIA_CATEGORIES,
  MEDIA_CATEGORY_LABEL,
  DEFAULT_TRANSFORM,
  MediaContentError,
  assertVariationIsSeparate,
  clampFocal,
  createGenerationRecord,
  rankFor,
  readMediaAsset,
  suggestMediaForSlide,
  visibleArea,
  withTransform,
  type MediaAsset,
} from "./studio-media";

/**
 * FASE 4C — MEDIA STUDIO (itens 19 a 24).
 *
 * Os testes concentram-se nas regras que, se falhassem, passavam sem aviso: o
 * original nunca é tocado, a taxonomia nunca perde uma fotografia, e a geração
 * por IA nunca passa à frente de uma imagem real sem pedido explícito.
 */

const asset = (patch: Partial<MediaAsset> & { id: string; url: string }): MediaAsset =>
  readMediaAsset({
    alt: "descrição",
    category: "cozinha",
    environment: "casa",
    type: "foto",
    origin: "upload",
    tags: [],
    description: "",
    discipline: null,
    projectId: null,
    clientId: null,
    capturedAt: null,
    ...patch,
  })!;

describe("taxonomia do banco de imagens (item 20)", () => {
  it("tem as treze categorias de arquitectura, sem mais", () => {
    expect(MEDIA_CATEGORIES).toEqual([
      "fachada", "sala", "cozinha", "quarto", "suite", "banheiro",
      "area-gourmet", "paisagismo", "materiais", "obra", "detalhe", "render", "referencia",
    ]);
  });

  it("tem rótulo em português para cada categoria", () => {
    for (const category of MEDIA_CATEGORIES) {
      expect(MEDIA_CATEGORY_LABEL[category].length).toBeGreaterThan(0);
    }
  });

  it("lê um activo gravado", () => {
    const read = readMediaAsset({ id: "m1", url: "/media/m1.jpg", category: "fachada", origin: "project", tags: ["brise"] });
    expect(read?.category).toBe("fachada");
    expect(read?.tags).toEqual(["brise"]);
  });

  it("reduz uma categoria desconhecida em vez de perder a imagem", () => {
    // Uma fotografia não pode desaparecer por causa de um valor novo numa tabela.
    expect(readMediaAsset({ id: "m2", url: "/media/m2.jpg", category: "categoria-futura" })?.category).toBe("referencia");
  });

  it("devolve null quando falta o identificador ou o url", () => {
    expect(readMediaAsset({ url: "/media/m3.jpg" })).toBeNull();
    expect(readMediaAsset({ id: "m3" })).toBeNull();
  });
});

describe("ajustes sem destruir o original (item 21)", () => {
  it("não recorta por omissão", () => {
    expect(DEFAULT_TRANSFORM.crop).toBeNull();
    expect(DEFAULT_TRANSFORM.background).toBe(false);
  });

  it("substituir uma imagem não altera o transform de nada", () => {
    const t = withTransform(DEFAULT_TRANSFORM, { fit: "contain", background: true });
    expect(withTransform(t, {})).toEqual(t);
    expect(t.fit).toBe("contain");
  });

  it("limita o ponto focal à imagem", () => {
    expect(clampFocal({ x: 1.4, y: -0.3 })).toEqual({ x: 1, y: 0 });
    expect(clampFocal({ x: Number.NaN, y: Number.NaN })).toEqual({ x: 0.5, y: 0.5 });
  });

  it("sem recorte, a imagem inteira continua visível", () => {
    // Um `null` de recorte é o estado por omissão, e tem de mostrar a imagem
    // inteira — não uma caixa de área zero.
    expect(visibleArea(null)).toEqual({ width: 1, height: 1 });
  });

  it("nunca deixa o recorte fechar a imagem", () => {
    // Uma altura zero faria o elemento desaparecer e perdia-se o texto em volta.
    const area = visibleArea({ top: 0.5, right: 0.5, bottom: 0, left: 0 });
    expect(area.height).toBeGreaterThan(0);
    expect(area.width).toBeGreaterThan(0);
  });
});

describe("geração por IA (item 22)", () => {
  it("exige prompt", () => {
    expect(() => createGenerationRecord({ prompt: "   ", model: "studio-v1" })).toThrow(MediaContentError);
  });

  it("exige o modelo, para que a imagem se possa reproduzir", () => {
    expect(() => createGenerationRecord({ prompt: "concreto", model: "  " })).toThrow(MediaContentError);
  });

  it("guarda prompt, modelo e a relação com a proposta e a página", () => {
    const record = createGenerationRecord({ prompt: "  madeira e concreto ", model: " studio-v1 ", proposalId: "P1", slideId: "S1" });
    expect(record).toMatchObject({ prompt: "madeira e concreto", model: "studio-v1", proposalId: "P1", slideId: "S1", referenceId: null });
  });
});

describe("image to image (item 23)", () => {
  const original = asset({ id: "a", url: "/media/a.jpg", origin: "project" });

  it("recusa uma variação que é a mesma imagem", () => {
    expect(() => assertVariationIsSeparate(original, { ...original })).toThrow(MediaContentError);
  });

  it("recusa uma variação que aponta para o mesmo ficheiro", () => {
    // Reescrever o original é o que o item 23 proíbe: o url tem de ser novo.
    expect(() => assertVariationIsSeparate(original, { ...original, id: "b" })).toThrow(MediaContentError);
  });

  it("aceita uma variação com identificador e ficheiro próprios", () => {
    expect(() => assertVariationIsSeparate(original, asset({ id: "b", url: "/media/b.jpg", origin: "variacao" }))).not.toThrow();
  });
});

describe("escolha de imagem (item 24)", () => {
  const project = asset({ id: "p", url: "/media/p.jpg", origin: "project", projectId: "PR1", description: "cozinha do projecto" });
  const library = asset({ id: "b", url: "/media/b.jpg", origin: "library", description: "cozinha" });
  const generated = asset({ id: "g", url: "/media/g.jpg", origin: "ai", description: "cozinha" });

  it("respeita a ordem de preferência declarada", () => {
    expect(rankFor("project")).toBeLessThan(rankFor("upload"));
    expect(rankFor("upload")).toBeLessThan(rankFor("library"));
    expect(rankFor("library")).toBeLessThan(rankFor("ai"));
  });

  it("coloca a imagem do projecto em primeiro", () => {
    const result = suggestMediaForSlide({ assets: [library, generated, project], slide: { title: "Cozinha", body: "cozinha do projecto", elements: [] }, context: {} });
    expect(result[0]?.asset.id).toBe("p");
  });

  it("não oferece uma imagem gerada sem pedido explícito", () => {
    const result = suggestMediaForSlide({ assets: [project, generated], slide: { title: "Cozinha", body: "cozinha", elements: [] }, context: {} });
    expect(result.some((s) => s.asset.origin === "ai")).toBe(false);
  });

  it("oferece a imagem gerada no fim, e só quando pedida", () => {
    const result = suggestMediaForSlide({ assets: [project, generated], slide: { title: "Cozinha", body: "cozinha", elements: [] }, context: {}, allowGeneration: true });
    expect(result[result.length - 1]?.asset.origin).toBe("ai");
  });

  it("explica por que sugeriu cada imagem", () => {
    const result = suggestMediaForSlide({ assets: [project], slide: { title: "Cozinha", body: "cozinha", elements: [] }, context: {} });
    expect(result[0]?.reasons.join(" ")).toMatch(/projecto/i);
  });
});