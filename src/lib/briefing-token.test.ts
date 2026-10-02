import { describe, expect, it } from "vitest";
import { createBriefingToken, hashBriefingToken } from "./briefing-token";

describe("briefing access tokens", () => {
  it("generates opaque tokens and stores only a deterministic hash", () => {
    const token = createBriefingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashBriefingToken(token)).not.toContain(token);
    expect(hashBriefingToken(token)).toBe(hashBriefingToken(token));
  });

  it("does not resolve different tokens to the same hash", () => {
    expect(hashBriefingToken(createBriefingToken())).not.toBe(hashBriefingToken(createBriefingToken()));
  });
});
