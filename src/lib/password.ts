import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DomainError } from "../server/errors";

function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  return value;
}

export function hashPassword(password: string) {
  if (password.length < 12) throw new DomainError("A senha deve ter pelo menos 12 caracteres.", "VALIDATION");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, `${salt}:${authSecret()}`, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, `${salt}:${authSecret()}`, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
