import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimit());

  it("libera até o limite e bloqueia o excedente", () => {
    expect(checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const blocked = checkRateLimit("ip:1", { limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("conta a taxa restante", () => {
    expect(checkRateLimit("ip:2", { limit: 3, windowMs: 60_000 }).remaining).toBe(2);
    expect(checkRateLimit("ip:2", { limit: 3, windowMs: 60_000 }).remaining).toBe(1);
  });

  it("mantém chaves independentes", () => {
    checkRateLimit("ip:a", { limit: 1, windowMs: 60_000 });
    checkRateLimit("ip:a", { limit: 1, windowMs: 60_000 });
    expect(checkRateLimit("ip:a", { limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(checkRateLimit("ip:b", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("libera novamente depois da janela expirar", () => {
    // Janela de 60ms, não de 1ms: com 1ms as duas primeiras chamadas podiam
    // cair em janelas distintas sob carga da máquina e o teste falhava de forma
    // intermitente. 60ms dá folga à segunda chamada e continua a expirar bem
    // antes dos 120ms de espera.
    expect(checkRateLimit("ip:3", { limit: 1, windowMs: 60 }).ok).toBe(true);
    expect(checkRateLimit("ip:3", { limit: 1, windowMs: 60 }).ok).toBe(false);
    return new Promise((resolve) => setTimeout(resolve, 120)).then(() => {
      expect(checkRateLimit("ip:3", { limit: 1, windowMs: 60 }).ok).toBe(true);
    });
  });

  it("permite limpar uma chave específica", () => {
    checkRateLimit("ip:4", { limit: 1, windowMs: 60_000 });
    checkRateLimit("ip:4", { limit: 1, windowMs: 60_000 });
    resetRateLimit("ip:4");
    expect(checkRateLimit("ip:4", { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });
});