import { describe, expect, it } from "vitest";
import { buildPublicProposalDTO, FORBIDDEN_PUBLIC_KEYS } from "./public-proposal-dto";
import { freezePaymentPlan } from "./payment-plan";

const formaPagamento = "40% assinatura, 30% anteprojeto, 30% entrega final";
const TOTAL = 45_000;

const dto = buildPublicProposalDTO({
  version: {
    version: 2,
    title: "Proposta Residência",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    services: [
      { name: "Projeto arquitetônico", discipline: "ARQUITETURA", quantity: 1, unit: "un.", subtotal: 25_000 },
    ],
    subtotal: TOTAL,
    adjustment: 0,
    total: TOTAL,
    formalText: { formaPagamento, validityDays: 30, object: "Projeto", conditions: "30 dias" },
    presentation: { slides: [{ title: "Escopo", body: "Corpo" }] },
  },
  proposal: { expiresAt: new Date("2026-02-01T00:00:00.000Z") },
  client: { name: "Maria", fullName: "Maria Silva" },
  project: { name: "Residência" },
  plan: freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL }),
  company: { name: "ARQVERTICE", document: null },
});

describe("PublicProposalDTO — segurança do payload (Prompt 18, item 4)", () => {
  it("não expõe nenhum campo proibido", () => {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(dto, key)).toBe(false);
    }
  });

  it("não expõe identificadores nem dados pessoais do cliente", () => {
    const serializado = JSON.stringify(dto).toLowerCase();
    for (const proibido of ["token", "@", "cpf", "rg", "approvalip", "authorid"]) {
      expect(serializado).not.toContain(proibido);
    }
  });

  it("publica o plano congelado com percentuais e valores", () => {
    expect(dto.paymentPlan.map((i) => i.percent)).toEqual([40, 30, 30]);
    expect(dto.paymentPlan.map((i) => i.amount)).toEqual([18_000, 13_500, 13_500]);
  });

  it("publica serviços, total e validade", () => {
    expect(dto.services).toHaveLength(1);
    expect(dto.services[0].name).toBe("Projeto arquitetônico");
    expect(dto.total).toBe(TOTAL);
    expect(dto.validityDays).toBe(30);
    expect(dto.conditions).toBe("30 dias");
  });

  it("usa o nome completo do cliente quando existe", () => {
    expect(dto.clientName).toBe("Maria Silva");
    expect(dto.projectName).toBe("Residência");
  });

  it("descarta linhas de serviço vazias", () => {
    const sujo = buildPublicProposalDTO({
      version: {
        version: 1,
        title: "T",
        createdAt: null,
        services: [{}, { name: "Real", subtotal: 10 }],
        subtotal: 10,
        adjustment: 0,
        total: 10,
        formalText: {},
        presentation: {},
      },
      proposal: { expiresAt: null },
      client: { name: "C", fullName: null },
      project: { name: "P" },
      plan: freezePaymentPlan({ formalText: {}, total: 10 }),
    });
    expect(sujo.services).toHaveLength(1);
    expect(sujo.services[0].name).toBe("Real");
  });

  it("não expõe o endereço do contratado além do nome e documento", () => {
    expect(Object.keys(dto.company).sort()).toEqual(["document", "name"]);
  });
});
