import { createHash, randomBytes } from "node:crypto";

export function createBriefingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashBriefingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
