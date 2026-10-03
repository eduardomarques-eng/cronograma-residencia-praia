import { describe, expect, it } from "vitest";
import { fingerprintOf, generateProposalDocument, type GeneratorInput } from "./document-generator";

const base: GeneratorInput = {
  proposal: { id: "prop-1", status: "SENT", version: 2 },
  client: { name: "Maria", fullName: "Maria Silva" },
  project: { id: "proj-1", name: "Residência", description: "Reforma completa" },
  services: [
    { name: "Projeto arquitetônico", discipline: "ARQUITETURA", quantity: 1, unit: "un.", subtotal: 25_000, estimatedDays: 30 },
    { name: "Projeto estrutural", discipline: "ESTRUTURAL", quantity: 1, unit: "un.", subtotal: 20_000, estimatedDays: 20 },
  ],
  pricing: { subtotal: 45_000, total: 45_000 },
  paymentPlan: [{ label: "assinatura", percent: 100, amount: 45_000 }],
  briefingResponses: { area: "180 m²", rooms: ["Sala"] },
  nextStep: "assinatura do contrato",
  validityDays: 30,
};

describe("generateProposalDocument — reprodutibilidade", () => {
  it("produz a mesma impressão digital para os mesmos dados", () => {
    const a = fingerprintOf(base);
    const b = fingerprintOf({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("impressões diferentes quando o valor muda", () => {
    const original = fingerprintOf(base);
    const alterado = fingerprintOf({ ...base, pricing: { subtotal: 45_000, total: 50_000 } });
    expect(original).not.toBe(alterado);
  });

  it("impressões diferentes quando muda a versão da proposta", () => {
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, proposal: { ...base.proposal, version: 3 } }));
  });

  it("o documento gerado é reprodutível a partir dos mesmos dados", () => {
    const first = generateProposalDocument(base);
    const second = generateProposalDocument({ ...base });
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.formalText).toBe(first.formalText);
    expect(second.slides).toEqual(first.slides);
  });

  it("regista a origem de cada documento gerado", () => {
    const doc = generateProposalDocument(base);
    expect(doc.generatedFrom).toEqual({ proposalId: "prop-1", version: 2, status: "SENT" });
  });
});

describe("generateProposalDocument — conteúdo", () => {
  it("inclui os serviços e o total no documento formal", () => {
    const doc = generateProposalDocument(base);
    expect(doc.formalText).toContain("Projeto arquitetônico");
    expect(doc.formalText).toContain("45.000,00");
  });

  it("calcula o cronograma a partir dos prazos dos serviços", () => {
    const doc = generateProposalDocument(base);
    // Sem dependências configuradas, o total é a maior duração simples.
    expect(doc.schedule.totalDays).toBe(30);
    expect(doc.warnings).toEqual([]);
  });

  it("respeita dependências configuradas pelo ADMIN", () => {
    const doc = generateProposalDocument({
      ...base,
      scheduleTasks: [
        { id: "a", name: "Arquitetura", durationDays: 20 },
        { id: "b", name: "Estrutural", durationDays: 15, dependsOn: ["a"] },
      ],
    });
    expect(doc.schedule.totalDays).toBe(35);
  });

  it("avisa quando falta prazo em vez de inventar", () => {
    const doc = generateProposalDocument({
      ...base,
      services: [{ name: "Serviço", discipline: "ARQUITETURA", subtotal: 1000 }],
    });
    expect(doc.schedule.totalDays).toBeNull();
    expect(doc.warnings.some((w) => w.includes("prazo"))).toBe(true);
  });

  it("mantém os percentuais do plano de pagamento aprovados", () => {
    const doc = generateProposalDocument({
      ...base,
      paymentPlan: [
        { label: "assinatura", percent: 40, amount: 18_000 },
        { label: "entrega", percent: 60, amount: 27_000 },
      ],
    });
    expect(doc.paymentPlan).toHaveLength(2);
    expect(doc.formalText).toContain("assinatura (40%)");
  });

  it("cada slide declara a origem do seu conteúdo", () => {
    const doc = generateProposalDocument(base);
    expect(doc.slides.length).toBeGreaterThan(0);
    expect(doc.slides.every((s) => typeof s.origin === "string" && s.origin.length > 0)).toBe(true);
  });
});
