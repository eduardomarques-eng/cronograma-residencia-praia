import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password security", () => {
  it("hashes and verifies a valid password without storing it in plain text", () => {
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
    const password = "uma-senha-segura-123";
    const hash = hashPassword(password);
    expect(hash).not.toContain(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("senha-incorreta", hash)).toBe(false);
  });

  it("rejects short passwords", () => {
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
    expect(() => hashPassword("curta")).toThrow("12 caracteres");
  });
});
