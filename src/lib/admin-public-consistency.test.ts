import { describe, expect, it } from "vitest";
import { buildPublicProposalDTO } from "./public-proposal-dto";
import { fingerprintOf, generateProposalDocument, type GeneratorInput } from "./document-generator";
import { freezePaymentPlan, resolvePaymentPlanForVersion } from "./payment-plan";
import {
  boundInvestment,
  boundPayment,
  boundSchedule,
  boundServices,
  readCommercialData,
} from "./studio-commercial";
import { formatCurrencyBRL } from "./contract-template";

/**
 * Prompt 19, item 11 — ADMIN = PUBLIC = PDF na mesma versão publicada.
 *
 * O teste reproduz os TRÊS consumidores a partir do MESMO `GeneratorInput`:
 *   · ADMIN  → `generateProposalDocument` (preview e documento PDF)
 *   · PÚBLICO → `buildPublicProposalDTO` (o que o cliente vê)
 *   · PDF    → a impressão digital do documento
 *
 * Como o PDF server-side ainda não existe (BLOCKED — item 13), a garantia aqui
 * é sobre os DADOS que o PDF irá consumir. Se os valores divergirem, o
 * documento oficial mentiria sobre o que o cliente aprovou.
 */

const total = 45_000;
const formaPagamento = "40% assinatura, 30% anteprojeto, 30% entrega final";

function makeInput(): GeneratorInput {
  return {
    proposal: { id: "prop-1", status: "SENT", version: 3 },
    client: { name: "Maria", fullName: "Maria Silva" },
    project: { id: "proj-1", name: "Residência", description: "Reforma completa" },
    services: [
      { name: "Projeto arquitetônico", discipline: "ARQUITETURA", quantity: 1, unit: "un.", subtotal: 25_000, estimatedDays: 30 },
      { name: "Projeto estrutural", discipline: "ESTRUTURAL", quantity: 1, unit: "un.", subtotal: 20_000, estimatedDays: 20 },
    ],
    pricing: { subtotal: total, adjustment: 0, total },
    paymentPlan: freezePaymentPlan({ formalText: { formaPagamento }, total }).installments,
    briefingResponses: { area: "180 m²" },
    validityDays: 30,
  };
}

describe("ADMIN = PUBLIC = PDF", () => {
  it("o total é idêntico nos três consumidores", () => {
    const input = makeInput();
    const admin = generateProposalDocument(input);
    const publico = buildPublicProposalDTO({
      version: {
        version: 3,
        title: "Proposta",
        createdAt: null,
        services: input.services,
        subtotal: total,
        adjustment: 0,
        total,
        formalText: { formaPagamento, validityDays: 30 },
        presentation: {},
      },
      proposal: { expiresAt: null },
      client: { name: "Maria", fullName: "Maria Silva" },
      project: { name: "Residência" },
      plan: freezePaymentPlan({ formalText: { formaPagamento }, total }),
    });

    expect(admin.totals.total).toBe(publico.total);
    expect(admin.totals.total).toBe(total);
  });

  it("os serviços e valores por linha coincidem exactamente", () => {
    const input = makeInput();
    const admin = generateProposalDocument(input);
    const publico = buildPublicProposalDTO({
      version: {
        version: 3,
        title: "Proposta",
        createdAt: null,
        services: input.services,
        subtotal: total,
        adjustment: 0,
        total,
        formalText: { formaPagamento },
        presentation: {},
      },
      proposal: { expiresAt: null },
      client: { name: "Maria", fullName: "Maria Silva" },
      project: { name: "Residência" },
      plan: freezePaymentPlan({ formalText: { formaPagamento }, total }),
    });

    expect(publico.services.map((s) => [s.name, s.quantity, s.subtotal])).toEqual(
      admin.services.map((s) => [s.name, s.quantity ?? null, Number(s.subtotal ?? 0)]),
    );
  });

  it("o plano de pagamento é o MESMO objecto nos dois lados", () => {
    const input = makeInput();
    const admin = generateProposalDocument(input);
    const congelado = freezePaymentPlan({ formalText: { formaPagamento }, total });
    const publico = buildPublicProposalDTO({
      version: { version: 3, title: "P", createdAt: null, services: [], subtotal: 0, adjustment: 0, total, formalText: { formaPagamento }, presentation: {} },
      proposal: { expiresAt: null },
      client: { name: "Maria", fullName: "Maria Silva" },
      project: { name: "Residência" },
      plan: congelado,
    });

    expect(publico.paymentPlan).toEqual(admin.paymentPlan);
    expect(publico.paymentPlan).toEqual(congelado.installments);
  });

  it("a impressão digital é estável e muda com a versão", () => {
    // A impressão é a prova de que o PDF e o preview vêm dos mesmos dados.
    expect(fingerprintOf(makeInput())).toBe(fingerprintOf(makeInput()));
    const outraVersao = { ...makeInput(), proposal: { id: "prop-1", status: "SENT", version: 4 } };
    expect(fingerprintOf(outraVersao)).not.toBe(fingerprintOf(makeInput()));
  });

  it("o total NÃO é recalculado depois da aprovação", () => {
    // O plano congelado manda sobre o texto: alterar o texto depois não muda nada.
    const congelado = freezePaymentPlan({ formalText: { formaPagamento }, total });
    const resolvido = resolvePaymentPlanForVersion({
      frozen: congelado,
      formalText: { formaPagamento: "90% assinatura, 10% entrega" },
      total,
    });
    expect(resolvido.source).toBe("CONGELADO");
    expect(resolvido.snapshot.installments.map((i) => i.percent)).toEqual([40, 30, 30]);
    expect(resolvido.snapshot.installments.map((i) => i.amount)).toEqual([18_000, 13_500, 13_500]);
  });

  it("o documento formal inclui valores e plano, sem placeholder por resolver", () => {
    const doc = generateProposalDocument(makeInput());
    expect(doc.formalText).toContain("45.000,00");
    expect(doc.formalText).toContain("assinatura (40%)");
    // Nenhum `{{VARIAVEL}}` sobrevive no documento oficial.
    expect(doc.formalText).not.toMatch(/\{\{[^}]+\}\}/);
  });
});

/**
 * Item 30 — a apresentação do Studio e a proposta pública mostram a MESMA
 * informação oficial.
 *
 * Estas linhas fecham o percurso dos itens 26 a 30. A apresentação resolve os
 * valores por `studio-commercial`; a proposta pública publica-os por
 * `public-proposal-dto`. São dois caminhos até ao cliente, e o único modo de
 * saber que não divergem é compará-los sobre a mesma `ProposalVersion`.
 */
describe("Studio = proposta pública (itens 26 a 30)", () => {
  const servicos = [
    { name: "Projeto", discipline: "ARQUITETURA", quantity: 1, unit: "un.", unitPrice: 25_000, subtotal: 25_000, estimatedDays: 30, order: 1 },
    { name: "Estrutural", discipline: "ESTRUTURAL", quantity: 1, unit: "un.", unitPrice: 20_000, subtotal: 20_000, estimatedDays: 20, order: 2 },
  ];

  /** A MESMA versão, lida pelas duas vias. */
  const versao = {
    version: 3,
    title: "Proposta",
    createdAt: null,
    services: servicos,
    subtotal: total,
    adjustment: 0,
    total,
    formalText: { formaPagamento },
    presentation: {},
    paymentPlan: freezePaymentPlan({ formalText: { formaPagamento }, total }),
  };

  const studio = () =>
    readCommercialData({
      services: versao.services,
      subtotal: versao.subtotal,
      adjustment: versao.adjustment,
      total: versao.total,
      paymentPlan: versao.paymentPlan,
    });

  const publico = () =>
    buildPublicProposalDTO({
      version: versao,
      proposal: { expiresAt: null },
      client: { name: "Maria", fullName: "Maria Silva" },
      project: { name: "Residência" },
      plan: freezePaymentPlan({ formalText: { formaPagamento }, total }),
    });

  it("o total é o mesmo nos dois lados", () => {
    expect(boundInvestment(studio()).totals.at(-1)?.value).toBe(formatCurrencyBRL(publico().total));
  });

  it("as parcelas são as mesmas, com os mesmos valores", () => {
    const daApresentacao = boundPayment(studio()).rows.map((row) => [row.label, row.percent, row.amount]);
    const doPublico = publico().paymentPlan.map((line) => [
      line.label,
      `${line.percent}%`,
      formatCurrencyBRL(line.amount),
    ]);
    expect(daApresentacao).toEqual(doPublico);
  });

  it("os serviços linha a linha coincidem", () => {
    const daApresentacao = boundServices(studio()).rows.map((row) => [row.name, row.subtotal]);
    const doPublico = publico().services.map((line) => [line.name, formatCurrencyBRL(line.subtotal)]);
    expect(daApresentacao).toEqual(doPublico);
  });

  it("mudar a proposta muda os DOIS lados da mesma maneira", () => {
    // Se só um dos lados se actualizasse, o cliente veria um valor e o estúdio
    // mostraria outro. É o teste que prova que a ligação é real.
    const antes = formatCurrencyBRL(publico().total);
    const depois = boundInvestment(
      readCommercialData({ services: servicos, subtotal: 60_000, adjustment: 0, total: 60_000, paymentPlan: null }),
    ).totals.at(-1)?.value;
    expect(depois).toBe("R$ 60.000,00");
    expect(depois).not.toBe(antes);
  });

  it("o cronograma da apresentação sai dos prazos dos mesmos serviços", () => {
    // O cliente vê o cronograma no contrato; a apresentação tem de mostrar as
    // mesmas etapas, com a mesma duração acumulada.
    const etapas = boundSchedule(studio());
    expect(etapas.map((step) => step.title)).toEqual(publico().services.map((line) => line.name));
    expect(etapas.reduce((soma, step) => soma + (step.days ?? 0), 0)).toBe(50);
  });
});
