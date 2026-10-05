import { describe, expect, it } from "vitest";
import {
  describeAiConfig,
  hasProvider,
  providerChain,
  resolveAiConfig,
  type AiEnv,
} from "./studio-ai-registry";

describe("item 53 — o Studio não depende de um fornecedor só", () => {
  it("funciona sem nada configurado — o Studio degrada, não quebra", () => {
    const config = resolveAiConfig({});
    expect(hasProvider(config.TEXTO)).toBe(false);
    expect(providerChain(config.TEXTO)).toHaveLength(0);
  });

  it("aceita endpoint e modelo independentes", () => {
    const config = resolveAiConfig({
      STUDIO_AI_ENDPOINT: "https://texto.exemplo/v1",
      STUDIO_AI_MODEL: "modelo-pt",
    });
    expect(config.TEXTO.primary.endpoint).toBe("https://texto.exemplo/v1");
    expect(config.TEXTO.primary.model).toBe("modelo-pt");
  });

  it("separa o serviço de TEXTO do de IMAGEM", () => {
    const config = resolveAiConfig({
      STUDIO_AI_ENDPOINT: "https://texto.exemplo/v1",
      STUDIO_IMAGE_ENDPOINT: "https://imagem.exemplo/v1",
    });
    expect(config.TEXTO.primary.endpoint).toBe("https://texto.exemplo/v1");
    expect(config.IMAGEM.primary.endpoint).toBe("https://imagem.exemplo/v1");
  });

  it("aceita chaves diferentes por papel", () => {
    const config = resolveAiConfig({
      STUDIO_AI_ENDPOINT: "https://texto.exemplo",
      STUDIO_AI_API_KEY: "chave-texto",
      STUDIO_IMAGE_ENDPOINT: "https://imagem.exemplo",
      STUDIO_IMAGE_API_KEY: "chave-imagem",
    });
    expect(config.TEXTO.primary.apiKey).toBe("chave-texto");
    expect(config.IMAGEM.primary.apiKey).toBe("chave-imagem");
  });
});

describe("item 53 — fallback explícito", () => {
  it("usa o fallback quando está configurado", () => {
    const config = resolveAiConfig({
      STUDIO_AI_ENDPOINT: "https://primario.exemplo",
      STUDIO_AI_FALLBACK_ENDPOINT: "https://secundario.exemplo",
    });
    expect(providerChain(config.TEXTO)).toHaveLength(2);
    expect(providerChain(config.TEXTO)[1].endpoint).toBe("https://secundario.exemplo");
  });

  it("não inventa um fallback", () => {
    // Sem endpoint de fallback, a cadeia tem um só serviço. Fingir que há
    // resiliência que não existe é pior do que admitir que não há.
    const config = resolveAiConfig({ STUDIO_AI_ENDPOINT: "https://primario.exemplo" });
    expect(providerChain(config.TEXTO)).toHaveLength(1);
    expect(config.TEXTO.fallback).toBeNull();
  });

  it("descarta um serviço sem endpoint da cadeia", () => {
    const config = resolveAiConfig({ STUDIO_AI_PROVIDER: "openai" });
    expect(providerChain(config.TEXTO)).toHaveLength(0);
  });

  it("usa o endpoint de texto como omissão para imagem", () => {
    // Um único serviço pode servir ambos: isso é configuração, não código.
    const config = resolveAiConfig({ STUDIO_AI_ENDPOINT: "https://unico.exemplo" });
    expect(config.IMAGEM.primary.endpoint).toBe("https://unico.exemplo");
  });
});

describe("item 53 — a interface pode dizer a verdade", () => {
  it("nomeia o serviço e o modelo quando existem", () => {
    const env: AiEnv = {
      STUDIO_AI_ENDPOINT: "https://texto.exemplo",
      STUDIO_AI_PROVIDER: "fornecedor-a",
      STUDIO_AI_MODEL: "modelo-x",
    };
    const texto = describeAiConfig(resolveAiConfig(env).TEXTO);
    expect(texto).toContain("fornecedor-a");
    expect(texto).toContain("modelo-x");
  });

  it("diz o que deixa de funcionar sem serviço, em vez de falhar em silêncio", () => {
    const texto = describeAiConfig(resolveAiConfig({}).TEXTO);
    expect(texto).toContain("Sem modelo");
    // A degradação é dita, porque o Studio continua a funcionar no resto.
    expect(texto).toContain("estruturais");
  });

  it("menciona a imagem em separado", () => {
    expect(describeAiConfig(resolveAiConfig({}).IMAGEM)).toContain("imagem");
  });
});