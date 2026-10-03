import { createHash, randomBytes } from "node:crypto";

/**
 * Token de recuperação de senha.
 *
 * Mesmo desenho do token de briefing (`briefing-token.ts`): 32 bytes
 * aleatórios em base64url, guardando-se apenas o SHA-256. O valor em claro
 * nunca toca a base de dados — viaja só no link do e-mail.
 */
export function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Limite superior de formato, pelo mesmo motivo do token da proposta
 * (Prompt 19, item 51): sem ele, um token gigante era aceite e ainda era
 * hasheado. Só passa o que `createPasswordResetToken` emite (43 chars).
 */
export function isWellFormedPasswordResetToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Validade do link. Curta de propósito: o e-mail é lido logo a seguir. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hora