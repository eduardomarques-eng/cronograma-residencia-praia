import { describe, expect, it } from "vitest";
import {
  buildPaymentPlan,
  parsePaymentPlanFromText,
  toPaymentRecords,
} from "./payment-plan";

/**
 * Tópico 38 — "Nunca criar parcelas novamente se elas já existirem".
 *
 * Estes testes modelam a garantia de idempotência que o serviço de conversão
 * depende: as chaves geradas precisam ser estáveis para a mesma
 * proposta/versão, para que o índice único do banco rejeite o duplicado.
 */
describe("idempotência das parcelas", () => {
  const formaPagamento = "40% assinatura, 30% anteprojeto, 30% entrega final";
  const total = 25_000;
  const options = { projectId: "proj-1", proposalId: "prop-1", proposalVersion: 2 };

  it("duas execuções da conversão produzem exatamente as mesmas chaves", () => {
    const parsed = parsePaymentPlanFromText(formaPagamento);
    const first = toPaymentRecords(buildPaymentPlan(total, parsed ?? []), options);
    const second = toPaymentRecords(buildPaymentPlan(total, parsed ?? []), options);
    expect(first.map((r) => r.sourceKey)).toEqual(second.map((r) => r.sourceKey));
  });

  it("as chaves são únicas entre as parcelas", () => {
    const parsed = parsePaymentPlanFromText(formaPagamento);
    const records = toPaymentRecords(buildPaymentPlan(total, parsed ?? []), options);
    expect(new Set(records.map((r) => r.sourceKey)).size).toBe(records.length);
  });

  it("todas as parcelas apontam para a proposta de origem", () => {
    const parsed = parsePaymentPlanFromText(formaPagamento);
    const records = toPaymentRecords(buildPaymentPlan(total, parsed ?? []), options);
    for (const record of records) {
      expect(record.sourceProposalId).toBe("prop-1");
      expect(record.sourceKey).toContain("prop-1");
    }
  });

  it("as parcelas reproduzem o exemplo do enunciado", () => {
    const parsed = parsePaymentPlanFromText(formaPagamento);
    const plan = buildPaymentPlan(total, parsed ?? []);
    expect(plan.installments.map((i) => [i.label, i.percent, i.amount])).toEqual([
      ["assinatura", 40, 10_000],
      ["anteprojeto", 30, 7500],
      ["entrega final", 30, 7500],
    ]);
  });

  it("não gera parcelas quando a condição não fecha em 100", () => {
    // O sistema não inventa a distribuição (Tópico 30).
    const parsed = parsePaymentPlanFromText("50% assinatura");
    expect(parsed).toBeNull();
    expect(buildPaymentPlan(total, parsed ?? []).installments).toHaveLength(0);
  });
});
