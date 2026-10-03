import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isWellFormedPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "./password-reset-token";

describe("password reset tokens", () => {
  it("gera tokens opacos e guarda apenas um hash determinístico", () => {
    const token = createPasswordResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashPasswordResetToken(token)).not.toContain(token);
    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
  });

  it("tokens diferentes não colidem no hash", () => {
    expect(hashPasswordResetToken(createPasswordResetToken())).not.toBe(hashPasswordResetToken(createPasswordResetToken()));
  });

  it("aceita exactamente o que createPasswordResetToken emite", () => {
    expect(isWellFormedPasswordResetToken(createPasswordResetToken())).toBe(true);
    expect(isWellFormedPasswordResetToken("a".repeat(43))).toBe(true);
  });

  it("rejeita formatos que nunca foram emitidos", () => {
    expect(isWellFormedPasswordResetToken("curto")).toBe(false);
    expect(isWellFormedPasswordResetToken("a".repeat(42))).toBe(false);
    expect(isWellFormedPasswordResetToken("a".repeat(44))).toBe(false);
    expect(isWellFormedPasswordResetToken(`${"a".repeat(42)}!`)).toBe(false);
    expect(isWellFormedPasswordResetToken("")).toBe(false);
    expect(isWellFormedPasswordResetToken(null)).toBe(false);
    expect(isWellFormedPasswordResetToken(undefined)).toBe(false);
    expect(isWellFormedPasswordResetToken(12345)).toBe(false);
    expect(isWellFormedPasswordResetToken({ token: "x" })).toBe(false);
  });

  it("o link expira dentro de um intervalo razoável", () => {
    expect(PASSWORD_RESET_TTL_MS).toBeGreaterThanOrEqual(5 * 60_000);
    expect(PASSWORD_RESET_TTL_MS).toBeLessThanOrEqual(24 * 60 * 60_000);
  });
});