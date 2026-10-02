import { describe, expect, it } from "vitest";
import {
  calculateFinancialSummary,
  calculatePaidAmount,
  calculatePaidPercentage,
  calculatePendingAmount,
  calculateRemainingBalance,
  paymentStatusLabels,
  paymentStatuses,
} from "./finance";

describe("calculateFinancialSummary", () => {
  it("calcula totais financeiros a partir dos pagamentos registrados", () => {
    const result = calculateFinancialSummary(1000, [
      { amount: 250, status: paymentStatuses.PAID },
      { amount: 300, status: paymentStatuses.PENDING },
      { amount: 450, status: paymentStatuses.AWAITING_COMPLETION },
    ]);

    expect(result).toMatchObject({
      contractedValue: 1000,
      totalInstallments: 1000,
      totalPaid: 250,
      totalPending: 750,
      remainingBalance: 750,
      paidPercentage: 25,
    });
  });

  it("preserva ausência de orçamento contratado", () => {
    expect(calculateFinancialSummary(null, [])).toMatchObject({
      contractedValue: null,
      remainingBalance: null,
      paidPercentage: null,
    });
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculateFinancialSummary(-1, [])).toThrow("Valor financeiro inválido.");
  });

  it("expõe os cálculos financeiros centralizados", () => {
    const payments = [
      { amount: 250, status: paymentStatuses.PAID },
      { amount: 300, status: paymentStatuses.PENDING },
    ];
    expect(calculatePaidAmount(payments)).toBe(250);
    expect(calculatePendingAmount(payments)).toBe(300);
    expect(calculateRemainingBalance(1000, payments)).toBe(750);
    expect(calculatePaidPercentage(1000, payments)).toBe(25);
  });
});

describe("paymentStatusLabels", () => {
  it("traduz os estados para a apresentação", () => {
    expect(paymentStatusLabels[paymentStatuses.AWAITING_COMPLETION]).toBe("Aguardando conclusão");
  });
});
