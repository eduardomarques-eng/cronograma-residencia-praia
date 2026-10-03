import { beforeEach, describe, expect, it } from "vitest";
import {
  canDecideProposal,
  canEditProposal,
  canIssueProposalLink,
  enforceProposalRateLimit,
  isWellFormedProposalToken,
  PROPOSAL_RATE_LIMITS,
  RateLimitError,
  resolveClientKey,
} from "./proposal-access";
import { resetRateLimit } from "./rate-limit";

const VALID_TOKEN = "a".repeat(43);

describe("proposal token", () => {
  it("aceita o formato gerado por createProposalToken (base64url, 43 chars)", () => {
    expect(isWellFormedProposalToken(VALID_TOKEN)).toBe(true);
    expect(isWellFormedProposalToken(`${VALID_TOKEN}-_9`)).toBe(true);
  });

  it("rejeita formatos que nunca foram emitidos", () => {
    expect(isWellFormedProposalToken("curto")).toBe(false);
    expect(isWellFormedProposalToken("a".repeat(39))).toBe(false);
    expect(isWellFormedProposalToken(`${"a".repeat(42)}!`)).toBe(false);
    expect(isWellFormedProposalToken("")).toBe(false);
    expect(isWellFormedProposalToken(null)).toBe(false);
    expect(isWellFormedProposalToken(undefined)).toBe(false);
    expect(isWellFormedProposalToken(12345)).toBe(false);
  });
});

describe("resolveClientKey", () => {
  const header = (values: Record<string, string>) => ({
    get: (name: string) => values[name.toLowerCase()] ?? null,
  });

  it("usa o primeiro endereço de x-forwarded-for", () => {
    expect(resolveClientKey(header({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("recorre para x-real-ip quando não há proxy", () => {
    expect(resolveClientKey(header({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("nunca devolve string vazia, para não colidir todos os anônimos num balde só", () => {
    expect(resolveClientKey(header({}))).toBe("local");
    expect(resolveClientKey(header({ "x-forwarded-for": "   " }))).toBe("local");
  });

  it("limita o tamanho da chave usada como bucket", () => {
    const long = resolveClientKey(header({ "x-forwarded-for": "9".repeat(500) }));
    expect(long).toHaveLength(64);
  });
});

describe("rate limit do link público", () => {
  beforeEach(() => resetRateLimit());

  it("libera até o limite de visualização", () => {
    for (let i = 0; i < PROPOSAL_RATE_LIMITS.view.limit; i += 1) {
      expect(() => enforceProposalRateLimit("view", "1.1.1.1")).not.toThrow();
    }
    expect(() => enforceProposalRateLimit("view", "1.1.1.1")).toThrow(RateLimitError);
  });

  it("a decisão tem limite próprio, mais apertado que a visualização", () => {
    expect(PROPOSAL_RATE_LIMITS.decide.limit).toBeLessThan(PROPOSAL_RATE_LIMITS.view.limit);
  });

  it("a aprovação do cliente não pode ser repetida indefinidamente", () => {
    let threw = false;
    for (let i = 0; i < PROPOSAL_RATE_LIMITS.decide.limit + 1; i += 1) {
      try {
        enforceProposalRateLimit("decide", "2.2.2.2");
      } catch (error) {
        threw = true;
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
      }
    }
    expect(threw).toBe(true);
  });

  it("baldes de leitura e decisão não se contaminam", () => {
    for (let i = 0; i < PROPOSAL_RATE_LIMITS.decide.limit + 5; i += 1) {
      try {
        enforceProposalRateLimit("decide", "3.3.3.3");
      } catch {
        /* esperado */
      }
    }
    expect(() => enforceProposalRateLimit("view", "3.3.3.3")).not.toThrow();
  });

  it("origens diferentes têm baldes independentes", () => {
    for (let i = 0; i < PROPOSAL_RATE_LIMITS.view.limit + 1; i += 1) {
      try {
        enforceProposalRateLimit("view", "4.4.4.4");
      } catch {
        /* esperado */
      }
    }
    expect(() => enforceProposalRateLimit("view", "5.5.5.5")).not.toThrow();
  });
});

describe("regras de estado da proposta", () => {
  it("uma proposta aprovada é imutável", () => {
    expect(canEditProposal("APPROVED")).toBe(false);
    expect(canEditProposal("CONVERTED")).toBe(false);
    expect(canEditProposal("CANCELLED")).toBe(false);
    expect(canEditProposal("DRAFT")).toBe(true);
    expect(canEditProposal("SENT")).toBe(true);
    expect(canEditProposal("VIEWED")).toBe(true);
  });

  it("não emite link para proposta encerrada", () => {
    expect(canIssueProposalLink("APPROVED")).toBe(false);
    expect(canIssueProposalLink("EXPIRED")).toBe(false);
    expect(canIssueProposalLink("CANCELLED")).toBe(false);
    expect(canIssueProposalLink("DRAFT")).toBe(true);
    expect(canIssueProposalLink("SENT")).toBe(true);
  });

  it("só se decide sobre proposta efetivamente enviada", () => {
    expect(canDecideProposal("SENT")).toBe(true);
    expect(canDecideProposal("VIEWED")).toBe(true);
    expect(canDecideProposal("READY")).toBe(true);
    expect(canDecideProposal("GENERATED")).toBe(true);
    // Um rascunho nunca chega ao cliente: aprová-lo seria um estado impossível.
    expect(canDecideProposal("DRAFT")).toBe(false);
    expect(canDecideProposal("IN_REVIEW")).toBe(false);
    expect(canDecideProposal("APPROVED")).toBe(false);
    expect(canDecideProposal("REJECTED")).toBe(false);
  });
});
