import { describe, expect, it } from "vitest";
import {
  buildInstallmentDueDates,
  buildPaymentPlan,
  distributePercentage,
  parsePaymentPlanFromText,
  toPaymentRecords,
} from "./payment-plan";

describe("distributePercentage", () => {
  it("calcula a parcela percentual", () => {
    expect(distributePercentage(10_000, 40)).toBe(4000);
    expect(distributePercentage(10_000, 30)).toBe(3000);
  });

  it("arredonda para duas casas", () => {
    expect(distributePercentage(1000, 33.33)).toBe(333.3);
    expect(distributePercentage(0.01, 50)).toBe(0.01);
  });

  it("devolve zero para entradas inválidas em vez de NaN", () => {
    expect(distributePercentage(Number.NaN, 40)).toBe(0);
    expect(distributePercentage(1000, Number.NaN)).toBe(0);
    expect(distributePercentage(Number.POSITIVE_INFINITY, 40)).toBe(0);
  });
});

describe("buildPaymentPlan", () => {
  it("gera as parcelas na ordem aprovada", () => {
    const plan = buildPaymentPlan(10_000, [
      { label: "assinatura", percent: 40 },
      { label: "anteprojeto", percent: 30 },
      { label: "entrega final", percent: 30 },
    ]);
    expect(plan.installments).toHaveLength(3);
    expect(plan.installments.map((i) => i.label)).toEqual(["assinatura", "anteprojeto", "entrega final"]);
    expect(plan.installments.map((i) => i.order)).toEqual([1, 2, 3]);
    expect(plan.installments.map((i) => i.amount)).toEqual([4000, 3000, 3000]);
  });

  it("a soma das parcelas é exatamente o total, sem perder centavos", () => {
    // Caso clássico de divergência: 33/33/34% de um total não divisível.
    const plan = buildPaymentPlan(999.99, [
      { label: "a", percent: 33 },
      { label: "b", percent: 33 },
      { label: "c", percent: 34 },
    ]);
    const sum = plan.installments.reduce((total, i) => total + i.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(plan.total);
  });

  it("nunca cria dinheiro do nada em divisões que não fecham", () => {
    for (const total of [1000, 3333.33, 12345.67, 0.07]) {
      const plan = buildPaymentPlan(total, [
        { label: "a", percent: 17.5 },
        { label: "b", percent: 32.5 },
        { label: "c", percent: 50 },
      ]);
      const sum = plan.installments.reduce((acc, i) => acc + i.amount, 0);
      expect(Math.round(sum * 100) / 100).toBe(plan.total);
    }
  });

  it("não monta plano sem total ou sem parcelas", () => {
    expect(buildPaymentPlan(0, [{ label: "a", percent: 100 }]).installments).toHaveLength(0);
    expect(buildPaymentPlan(1000, []).installments).toHaveLength(0);
  });

  it("ignora entradas inválidas em vez de gerar parcela quebrada", () => {
    const plan = buildPaymentPlan(1000, [
      { label: "   ", percent: 50 },
      { label: "ok", percent: Number.NaN },
      { label: "válida", percent: 100 },
    ]);
    expect(plan.installments).toHaveLength(1);
    expect(plan.installments[0].label).toBe("válida");
  });

  it("reporta a soma dos percentuais para conferência", () => {
    const plan = buildPaymentPlan(1000, [
      { label: "a", percent: 40 },
      { label: "b", percent: 30 },
      { label: "c", percent: 30 },
    ]);
    expect(plan.percentSum).toBe(100);
  });
});

describe("parsePaymentPlanFromText", () => {
  it("lê a condição escrita pelo ADMIN", () => {
    expect(parsePaymentPlanFromText("40% assinatura, 30% anteprojeto, 30% entrega final")).toEqual([
      { label: "assinatura", percent: 40, order: 1 },
      { label: "anteprojeto", percent: 30, order: 2 },
      { label: "entrega final", percent: 30, order: 3 },
    ]);
  });

  it("aceita o percentual antes do rótulo", () => {
    const parsed = parsePaymentPlanFromText("50% projeto, 50% entrega");
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]).toEqual({ label: "projeto", percent: 50, order: 1 });
  });

  it("recusa planos que não somam 100", () => {
    // Tópico 30: não inventar. Um plano incompleto distorceria o valor.
    expect(parsePaymentPlanFromText("40% assinatura, 30% entrega")).toBeNull();
  });

  it("devolve null para texto sem percentuais", () => {
    expect(parsePaymentPlanFromText("a combinar após entrega")).toBeNull();
    expect(parsePaymentPlanFromText("")).toBeNull();
    expect(parsePaymentPlanFromText(null)).toBeNull();
    expect(parsePaymentPlanFromText(42)).toBeNull();
  });
});

describe("toPaymentRecords", () => {
  it("gera chaves estáveis para a mesma proposta e versão", () => {
    const plan = buildPaymentPlan(1000, [{ label: "a", percent: 100 }]);
    const options = { projectId: "p1", proposalId: "prop1", proposalVersion: 3 };
    const first = toPaymentRecords(plan, options);
    const second = toPaymentRecords(plan, options);
    // Mesma chave => o índice único do banco impede a duplicação.
    expect(first[0].sourceKey).toBe(second[0].sourceKey);
    expect(first[0].sourceKey).toBe("proposal:prop1:v3:p1");
  });

  it("versions diferentes geram chaves diferentes", () => {
    const plan = buildPaymentPlan(1000, [{ label: "a", percent: 100 }]);
    const v3 = toPaymentRecords(plan, { projectId: "p1", proposalId: "prop1", proposalVersion: 3 });
    const v4 = toPaymentRecords(plan, { projectId: "p1", proposalId: "prop1", proposalVersion: 4 });
    expect(v3[0].sourceKey).not.toBe(v4[0].sourceKey);
  });

  it("mantém a ordem e o percentual originais", () => {
    const plan = buildPaymentPlan(10_000, [
      { label: "assinatura", percent: 40 },
      { label: "entrega", percent: 60 },
    ]);
    const records = toPaymentRecords(plan, { projectId: "p1", proposalId: "prop1", proposalVersion: 1 });
    expect(records[0].order).toBe(1);
    expect(records[1].order).toBe(2);
    expect(records[0].percentage).toBe(40);
    expect(records[1].percentage).toBe(60);
    expect(records[0].status).toBe("PENDING");
  });
});

describe("buildInstallmentDueDates", () => {
  it("distribui vencimentos a cada intervalo", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const dates = buildInstallmentDueDates(start, 3, 30);
    expect(dates).toHaveLength(3);
    // 1ª parcela: +30 dias; 2ª: +60; 3ª: +90 (contando os meses de 31 dias).
    expect(dates[0].toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(dates[1].toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(dates[2].toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("devolve lista vazia para contagem negativa", () => {
    expect(buildInstallmentDueDates(new Date(), -1)).toEqual([]);
  });
});
