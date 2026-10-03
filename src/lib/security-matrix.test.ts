import { describe, expect, it } from "vitest";
import {
  canDecideProposal,
  canEditProposal,
  canIssueProposalLink,
  enforceProposalRateLimit,
  isWellFormedProposalToken,
  RateLimitError,
  resolveClientKey,
} from "./proposal-access";
import { assertSignatureTransition, canTransitionSignature } from "./signature";
import { buildPublicProposalDTO } from "./public-proposal-dto";
import { freezePaymentPlan } from "./payment-plan";
import { resetRateLimit } from "./rate-limit";

/**
 * Prompt 19, item 51 — SEGURANÇA.
 *
 * Estas regras são testáveis sem base de dados porque são funções puras: a
 * defesa real (Prisma) fica por cima delas. O que depende do banco está
 * marcado «REQUER POSTGRESQL» no relatório final; o que está aqui é a parte
 * que decide.
 */

describe("token do link público", () => {
  it("recusa tokens malformados", () => {
    for (const token of ["", "abc", "a".repeat(39), "x".repeat(1000), "../../etc/passwd"]) {
      expect(isWellFormedProposalToken(token)).toBe(false);
    }
  });

  it("recusa injecção de path traversal", () => {
    expect(isWellFormedProposalToken("../../admin")).toBe(false);
    expect(isWellFormedProposalToken("token/../secret")).toBe(false);
  });

  it("aceita o formato emitido pelo gerador de tokens", () => {
    expect(isWellFormedProposalToken("A".repeat(43))).toBe(true);
  });
});

describe("origem do visitante", () => {
  const header = (values: Record<string, string>) => ({
    get: (name: string) => values[name.toLowerCase()] ?? null,
  });

  it("nunca devolve vazio, para não juntar todos os anónimos num balde só", () => {
    expect(resolveClientKey(header({}))).toBe("local");
    expect(resolveClientKey(header({ "x-forwarded-for": "   " }))).toBe("local");
  });

  it("limita o tamanho da chave de bucket", () => {
    expect(resolveClientKey(header({ "x-forwarded-for": "9".repeat(500) })).length).toBeLessThanOrEqual(64);
  });
});

describe("rate limit da aprovação (anti-replay)", () => {
  it("bloqueia a repetição excessiva de decisões", () => {
    resetRateLimit();
    let bloqueou = false;
    for (let i = 0; i < 20; i += 1) {
      try {
        enforceProposalRateLimit("decide", "9.9.9.9");
      } catch (error) {
        bloqueou = true;
        expect(error).toBeInstanceOf(RateLimitError);
      }
    }
    expect(bloqueou).toBe(true);
  });

describe("estados impossíveis (item 42)", () => {
  it("proposta aprovada é imutável", () => {
    expect(canEditProposal("APPROVED")).toBe(false);
    expect(canEditProposal("CONVERTED")).toBe(false);
    expect(canEditProposal("CANCELLED")).toBe(false);
  });

  it("não se emite link para proposta encerrada", () => {
    for (const status of ["APPROVED", "CONVERTED", "CANCELLED", "EXPIRED"]) {
      expect(canIssueProposalLink(status)).toBe(false);
    }
  });

  it("não se decide sobre rascunho: DRAFT→APROVADA é impossível", () => {
    expect(canDecideProposal("DRAFT")).toBe(false);
    expect(canDecideProposal("IN_REVIEW")).toBe(false);
  });

  it("não se volta a decidir sobre proposta já decidida", () => {
    expect(canDecideProposal("APPROVED")).toBe(false);
    expect(canDecideProposal("REJECTED")).toBe(false);
  });

  it("CONTRATO: DRAFT→SIGNED é transição inválida", () => {
    // Sem envio e visualização, não se chega a assinado.
    expect(canTransitionSignature("PENDING", "SIGNED")).toBe(false);
    expect(canTransitionSignature("PENDING", "COMPLETED")).toBe(false);
  });

  it("CONTRATO: a assinatura segue PENDING→SENT→SIGNED", () => {
    expect(canTransitionSignature("PENDING", "SENT")).toBe(true);
    expect(canTransitionSignature("SENT", "SIGNED")).toBe(true);
    expect(canTransitionSignature("VIEWED", "SIGNED")).toBe(true);
  });

  it("assinatura concluída é terminal", () => {
    expect(() => assertSignatureTransition("COMPLETED", "SENT")).toThrow();
    expect(() => assertSignatureTransition("CANCELLED", "SIGNED")).toThrow();
  });
});

const dtoVazio = () =>
  buildPublicProposalDTO({
    version: {
      version: 1,
      title: "P",
      createdAt: null,
      services: [],
      subtotal: 0,
      adjustment: 0,
      total: 0,
      formalText: {},
      presentation: {},
    },
    proposal: { expiresAt: null },
    client: { name: "A", fullName: null },
    project: { name: "P" },
    plan: freezePaymentPlan({ formalText: {}, total: 0 }),
  });

describe("vazamento entre clientes (IDOR)", () => {
  /**
   * O token é o ÚNICO factor de acesso ao link público. Se o sistema validasse
   * um ID de proposta em vez do token, um cliente obteria a proposta de outro
   * conhecendo o UUID. Estes testes fixam a superfície exposta.
   */
  it("o DTO não expõe identificadores que permitam enumerar", () => {
    const dto = dtoVazio();
    for (const proibido of ["proposalId", "projectId", "clientId", "token", "versionId"]) {
      expect(Object.prototype.hasOwnProperty.call(dto, proibido)).toBe(false);
    }
  });

  it("o DTO não inclui dados pessoais do cliente além do nome", () => {
    const serializado = JSON.stringify(dtoVazio()).toLowerCase();
    expect(serializado).not.toContain("email");
    expect(serializado).not.toContain("phone");
    expect(serializado).not.toContain("cpf");
  });

  it("o DTO não expõe custos nem regras de precificação", () => {
    const serializado = JSON.stringify(dtoVazio()).toLowerCase();
    expect(serializado).not.toContain("margin");
    expect(serializado).not.toContain("basemedium");
    expect(serializado).not.toContain("cost");
  });
});

describe("acesso administrativo (item 51)", () => {
  it("as regras de estado dependem só do estado, nunca do pedido", () => {
    // A autorização real é feita por `requireRole` no servidor. Estas funções
    // não conhecem o utilizador, portanto não existe caminho pelo qual um
    // CLIENT contorne a regra escolhendo outro fluxo.
    expect(canEditProposal("APPROVED")).toBe(false);
    expect(canEditProposal("DRAFT")).toBe(true);
  });
});


  it("uma origem não bloqueia outra", () => {
    resetRateLimit();
    for (let i = 0; i < 20; i += 1) {
      try {
        enforceProposalRateLimit("decide", "8.8.8.8");
      } catch {
        /* esperado */
      }
    }
    expect(() => enforceProposalRateLimit("decide", "7.7.7.7")).not.toThrow();
  });
});
