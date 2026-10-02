export const paymentStatuses = {
  PAID: "PAID",
  PENDING: "PENDING",
  AWAITING_COMPLETION: "AWAITING_COMPLETION",
} as const;

export type PaymentStatus = (typeof paymentStatuses)[keyof typeof paymentStatuses];

export type FinancialPayment = {
  amount: number | string;
  status: PaymentStatus;
};

export type FinancialSummary = {
  contractedValue: number | null;
  totalInstallments: number;
  totalPaid: number;
  totalPending: number;
  remainingBalance: number | null;
  paidPercentage: number | null;
};

function toAmount(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Valor financeiro inválido.");
  return amount;
}

export function calculateFinancialSummary(
  contractedValue: number | string | null | undefined,
  payments: readonly FinancialPayment[],
): FinancialSummary {
  const contracted = contractedValue == null ? null : toAmount(contractedValue);
  const totalInstallments = payments.reduce((sum, payment) => sum + toAmount(payment.amount), 0);
  const totalPaid = payments
    .filter((payment) => payment.status === paymentStatuses.PAID)
    .reduce((sum, payment) => sum + toAmount(payment.amount), 0);
  const totalPending = totalInstallments - totalPaid;
  const remainingBalance = contracted == null ? null : Math.max(contracted - totalPaid, 0);
  const paidPercentage = contracted && contracted > 0 ? (totalPaid / contracted) * 100 : null;

  return { contractedValue: contracted, totalInstallments, totalPaid, totalPending, remainingBalance, paidPercentage };
}

export function calculatePaidAmount(payments: readonly FinancialPayment[]): number {
  return payments
    .filter((payment) => payment.status === paymentStatuses.PAID)
    .reduce((sum, payment) => sum + toAmount(payment.amount), 0);
}

export function calculatePendingAmount(payments: readonly FinancialPayment[]): number {
  return payments.reduce((sum, payment) => sum + toAmount(payment.amount), 0) - calculatePaidAmount(payments);
}

export function calculateRemainingBalance(
  contractedValue: number | string | null | undefined,
  payments: readonly FinancialPayment[],
): number | null {
  if (contractedValue == null) return null;
  return Math.max(toAmount(contractedValue) - calculatePaidAmount(payments), 0);
}

export function calculatePaidPercentage(
  contractedValue: number | string | null | undefined,
  payments: readonly FinancialPayment[],
): number | null {
  if (contractedValue == null || toAmount(contractedValue) <= 0) return null;
  return (calculatePaidAmount(payments) / toAmount(contractedValue)) * 100;
}

export function getProjectFinancialSummary(
  contractedValue: number | string | null | undefined,
  payments: readonly FinancialPayment[],
): FinancialSummary {
  return calculateFinancialSummary(contractedValue, payments);
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  [paymentStatuses.PAID]: "Pago",
  [paymentStatuses.PENDING]: "Pendente",
  [paymentStatuses.AWAITING_COMPLETION]: "Aguardando conclusão",
};
