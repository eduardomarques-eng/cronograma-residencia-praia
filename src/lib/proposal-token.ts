import { createHash, randomBytes } from "node:crypto";

export function createProposalToken() {
  return randomBytes(32).toString("base64url");
}

export function hashProposalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
