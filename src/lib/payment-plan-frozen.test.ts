import { describe, expect, it } from "vitest";
import {
  freezePaymentPlan,
  readPaymentPlanSnapshot,
  resolvePaymentPlanForVersion,
} from "./payment-plan";

const formaPagamento = "40% assinatura, 30% anteprojeto, 30% entrega final";
const TOTAL = 45_000;

describe("freezePaymentPlan — congelamento (Prompt 18, item 2)", () => {
  it("congela o plano a partir do texto e do total da versão", () => {
    const snapshot = freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL });
    expect(snapshot.format).toBe(1);
    expect(snapshot.total).toBe(45_000);
    expect(snapshot.derivedFrom).toBe("formalText.formaPagamento");
    expect(snapshot.installments).toEqual([
      { label: "assinatura", percent: 40, amount: 18_000, order: 1 },
      { label: "anteprojeto", percent: 30, amount: 13_500, order: 2 },
      { label: "entrega final", percent: 30, amount: 13_500, order: 3 },
    ]);
  });

  it("devolve um snapshot vazio, e não nulo, quando não há condição definida", () => {
    // Distingue "derivado sem plano" de "nunca congelado".
    const snapshot = freezePaymentPlan({ formalText: {}, total: TOTAL });
    expect(snapshot).not.toBeNull();
    expect(snapshot.installments).toEqual([]);
    expect(snapshot.derivedFrom).toBe("NOT_DEFINED");
  });

  it("a soma das parcelas é exactamente o total", () => {
    const snapshot = freezePaymentPlan({ formalText: { formaPagamento }, total: 999.99 });
    const sum = snapshot.installments.reduce((acc, i) => acc + i.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(snapshot.total);
  });

  it("suporta múltiplas parcelas e valores fixos", () => {
    const duas = freezePaymentPlan({
      formalText: { formaPagamento: "50% projeto, 50% entrega" },
      total: 10_000,
    });
    expect(duas.installments.map((i) => i.percent)).toEqual([50, 50]);
    expect(duas.installments.map((i) => i.order)).toEqual([1, 2]);
  });

  it("recusa condição que não fecha em 100, em vez de a normalizar", () => {
    const snapshot = freezePaymentPlan({ formalText: { formaPagamento: "40% assinatura, 30% entrega" }, total: TOTAL });
    expect(snapshot.installments).toEqual([]);
    expect(snapshot.derivedFrom).toBe("NOT_DEFINED");
  });
});

describe("readPaymentPlanSnapshot — validação do persistido", () => {
  it("lê um plano válido", () => {
    const frozen = freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL });
    expect(readPaymentPlanSnapshot(JSON.parse(JSON.stringify(frozen)))).toEqual(frozen);
  });

  it("recusa formato desconhecido em vez de adivinhar", () => {
    expect(readPaymentPlanSnapshot({ format: 99, installments: [] })).toBeNull();
    expect(readPaymentPlanSnapshot({ installments: [] })).toBeNull();
    expect(readPaymentPlanSnapshot(null)).toBeNull();
    expect(readPaymentPlanSnapshot("texto")).toBeNull();
    expect(readPaymentPlanSnapshot([])).toBeNull();
  });

  it("recusa uma parcela incompleta, em vez de devolver meio plano", () => {
    expect(
      readPaymentPlanSnapshot({ format: 1, total: 100, installments: [{ label: "a", percent: 50 }] }),
    ).toBeNull();
  });
});

describe("resolvePaymentPlanForVersion — consistência (itens 5 e 6)", () => {
  it("usa o plano CONGELADO e não re-interpreta o texto", () => {
    const frozen = freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL });
    // O texto foi alterado depois de congelado — o plano NÃO pode mudar.
    const result = resolvePaymentPlanForVersion({
      frozen,
      formalText: { formaPagamento: "90% assinatura, 10% entrega" },
      total: TOTAL,
    });
    expect(result.source).toBe("CONGELADO");
    expect(result.warnings).toEqual([]);
    expect(result.snapshot.installments.map((i) => i.percent)).toEqual([40, 30, 30]);
  });

  it("o total da proposta não altera um plano já congelado", () => {
    const frozen = freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL });
    const result = resolvePaymentPlanForVersion({ frozen, formalText: { formaPagamento }, total: 999 });
    expect(result.snapshot.installments.map((i) => i.amount)).toEqual([18_000, 13_500, 13_500]);
  });

  it("versão legada cai no ramo derivado e avisa", () => {
    const result = resolvePaymentPlanForVersion({ frozen: null, formalText: { formaPagamento }, total: TOTAL });
    expect(result.source).toBe("LEGACY_DERIVED");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.snapshot.installments).toHaveLength(3);
  });

  it("ADMIN e PÚBLICO obtêm o mesmo plano a partir do mesmo dado congelado", () => {
    const frozen = freezePaymentPlan({ formalText: { formaPagamento }, total: TOTAL });
    const admin = resolvePaymentPlanForVersion({ frozen, formalText: { formaPagamento }, total: TOTAL });
    const publico = resolvePaymentPlanForVersion({ frozen, formalText: { formaPagamento }, total: TOTAL });
    expect(publico.snapshot.installments).toEqual(admin.snapshot.installments);
  });
});
