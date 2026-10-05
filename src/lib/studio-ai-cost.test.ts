import { describe, expect, it } from "vitest";
import {
  AiResultCache,
  aiCacheKey,
  buildScopedContext,
  contextSize,
  planAiCall,
  shouldGenerateImage,
} from "./studio-ai-cost";

const outline = ["Capa", "Escopo", "Cronograma", "Investimento", "Conclusão"];

describe("item 54 — mostrar a acção antes de a executar", () => {
  it("uma transformação local não custa e não precisa de confirmação", () => {
    const plan = planAiCall({ local: true });
    expect(plan.cost).toBe("LOCAL");
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.worksOffline).toBe(true);
  });

  it("uma transformação remota avisa, mas a pré-visualização é a confirmação", () => {
    const plan = planAiCall({ local: false });
    expect(plan.cost).toBe("REMOTA");
    // Pedir confirmação aqui seria um clique a mais sem informação nova: o
    // ADMIN já vai ver o comparativo antes de aplicar.
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.notice).toContain("pré-visualização");
  });

  it("gerar uma imagem exige sempre confirmação", () => {
    const plan = planAiCall({ local: false, generatesImage: true });
    expect(plan.cost).toBe("GERACAO_IMAGEM");
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("uma geração local não dispensa a confirmação de imagem", () => {
    // Local + imagem: é a geração que é cara, não o resto.
    const plan = planAiCall({ local: true, generatesImage: true });
    expect(plan.requiresConfirmation).toBe(true);
  });
});

describe("item 54 — enviar só o contexto necessário", () => {
  it("não reenvia a apresentação inteira para alterar um elemento", () => {
    const context = buildScopedContext({
      scope: "ELEMENTO",
      outline,
      selection: { slideId: "s2", elementId: "e1" },
      targetText: "Texto a reescrever.",
    });
    // A regra literal do item 54.
    expect(context.outline).toHaveLength(1);
    expect(context.targetElementId).toBe("e1");
  });

  it("um comando de apresentação leva o outline completo", () => {
    const context = buildScopedContext({ scope: "PRESENTACAO", outline });
    expect(context.outline).toHaveLength(outline.length);
  });

  it("envia menos num elemento do que na apresentação inteira", () => {
    const elemento = buildScopedContext({
      scope: "ELEMENTO",
      outline,
      selection: { slideId: "s2", elementId: "e1" },
      targetText: "Texto a reescrever.",
    });
    const tudo = buildScopedContext({
      scope: "PRESENTACAO",
      outline,
      targetText: "Texto a reescrever.",
    });
    expect(contextSize(elemento)).toBeLessThan(contextSize(tudo));
  });

  it("não identifica página nem elemento num comando de apresentação", () => {
    const context = buildScopedContext({ scope: "PRESENTACAO", outline, selection: { slideId: "s1" } });
    expect(context.targetSlideId).toBeNull();
    expect(context.targetElementId).toBeNull();
  });

  it("um comando de página não transporta o id de elemento", () => {
    const context = buildScopedContext({
      scope: "SLIDE",
      outline,
      selection: { slideId: "s2", elementId: "e1" },
    });
    expect(context.targetSlideId).toBe("s2");
    expect(context.targetElementId).toBeNull();
  });
});

describe("item 54 — reaproveitar resultados", () => {
  it("o mesmo pedido dá a mesma chave", () => {
    const a = aiCacheKey({ scope: "ELEMENTO", instruction: "Melhora", targetText: "Texto." });
    const b = aiCacheKey({ scope: "ELEMENTO", instruction: "  melhora ", targetText: " Texto. " });
    expect(a).toBe(b);
  });

  it("uma instrução diferente dá uma chave diferente", () => {
    const a = aiCacheKey({ scope: "ELEMENTO", instruction: "Melhora", targetText: "Texto." });
    const b = aiCacheKey({ scope: "ELEMENTO", instruction: "Resume", targetText: "Texto." });
    expect(a).not.toBe(b);
  });

  it("trocar de modelo invalida o resultado guardado", () => {
    const a = aiCacheKey({ scope: "ELEMENTO", instruction: "Melhora", targetText: "T.", model: "m1" });
    const b = aiCacheKey({ scope: "ELEMENTO", instruction: "Melhora", targetText: "T.", model: "m2" });
    // O texto do modelo novo não é o mesmo resultado.
    expect(a).not.toBe(b);
  });

  it("a cache devolve o resultado guardado", () => {
    const cache = new AiResultCache();
    const key = aiCacheKey({ scope: "ELEMENTO", instruction: "Melhora", targetText: "T." });
    cache.set(key, "Texto melhorado.");
    expect(cache.has(key)).toBe(true);
    expect(cache.get(key)).toBe("Texto melhorado.");
  });

  it("não guarda mais do que o limite", () => {
    // Sem limite, a cache custa mais do que a chamada que evita.
    const cache = new AiResultCache(3);
    for (const n of [1, 2, 3, 4, 5]) cache.set(`k${n}`, "x");
    expect(cache.size).toBe(3);
    // FIFO: as mais antigas saem primeiro.
    expect(cache.has("k1")).toBe(false);
    expect(cache.has("k5")).toBe(true);
  });
});

describe("item 54 — imagens nunca se regeneram sozinhas", () => {
  it("recusa sem pedido explícito, mesmo com prompt escrito", () => {
    const result = shouldGenerateImage({ explicitRequest: false, prompt: "Fachada ao pôr do sol" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ADMIN");
  });

  it("recusa sem prompt, mesmo com pedido explícito", () => {
    const result = shouldGenerateImage({ explicitRequest: true, prompt: "   " });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Escreva");
  });

  it("autoriza com pedido e prompt", () => {
    expect(shouldGenerateImage({ explicitRequest: true, prompt: "Fachada" }).allowed).toBe(true);
  });

  it("avisa antes de substituir uma imagem que já está na página", () => {
    const result = shouldGenerateImage({ explicitRequest: true, prompt: "Fachada", replacing: true });
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("substituição");
  });
});