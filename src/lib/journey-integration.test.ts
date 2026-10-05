import { describe, expect, it } from "vitest";
import { computeTotals, readProposalItems, itemFromCatalog } from "./proposal-item";
import { freezePaymentPlan, readPaymentPlanSnapshot, resolvePaymentPlanForVersion } from "./payment-plan";
import { readCommercialData, resolveBinding } from "./studio-commercial";

/**
 * FASE 6 — TESTES DE INTEGRAÇÃO (item 4 da Fase 6).
 *
 * Validam a CADEIA entre módulos, não cada módulo isolado: um teste de
 * `computeTotals` pode passar e o total chegar errado à parcela se o elo
 * seguinte arredondar de outra maneira. É por isso que estes testes existem
 * apesar de haver testes unitários para cada peça.
 *
 * São PUROS de propósito: a cadeia é o que se quer provar, e provar que
 * depende da base de dados só a tornaria mais frágil, não mais verdadeira.
 */

/** O cenário de sempre: dois serviços, sem opção. Total 50 000. */
const servicos = [
  { serviceId: "s1", name: "Projeto", quantity: 1, unitPrice: 45000, optional: false, order: 0 },
  { serviceId: "s2", name: "Acompanhamento", quantity: 1, unitPrice: 5000, optional: false, order: 1 },
];

/** O texto formal que o ADMIN escreve, na forma que o sistema lê. */
const formalText = { formaPagamento: "40% assinatura, 30% anteprojeto, 30% entrega final" };

describe("cadeia: Proposal -> ProposalVersion -> PaymentPlan", () => {
  it("o total das linhas é o total que o plano usa", () => {
    const itens = readProposalItems(servicos);
    const totais = computeTotals(itens, 0);

    // O ponto do encadeamento: o plano recebe o TOTAL CALCULADO, e não um
    // número escrito à mão. É esta passagem que não pode divergir.
    const plano = freezePaymentPlan({ formalText, total: totais.total });
    expect(totais.total).toBe(50000);
    expect(plano.total).toBe(totais.total);
  });

  it("as parcelas somam EXATAMENTE o total, em centavos", () => {
    const total = computeTotals(readProposalItems(servicos), 0).total;
    const plano = freezePaymentPlan({ formalText, total });

    const soma = round(plano.installments.reduce((s, i) => s + i.amount, 0));
    // A razão de o resíduo ir para a última parcela: sem isto, um total
    // como 9 999,99 com 3 parcelas de 33,33% perde centavos — e o cliente
    // pagava um valor diferente do contratado.
    expect(soma).toBe(total);
    expect(plano.installments).toHaveLength(3);
  });

  it("os percentuais do plano fecham 100", () => {
    const plano = freezePaymentPlan({ formalText, total: 50000 });
    expect(plano.installments.reduce((s, i) => s + i.percent, 0)).toBe(100);
  });

  it("um plano sem percentuais não inventa parcelas", () => {
    // Inventar uma condição de pagamento seria pior do que nenhuma: o cliente
    // veria um plano que ninguém aprovou.
    const plano = freezePaymentPlan({ formalText: {}, total: 50000 });
    expect(plano.installments).toHaveLength(0);
    expect(plano.derivedFrom).toBe("NOT_DEFINED");
  });
});

/** Arredonda a dois decimais, como o sistema faz. */
const round = (value: number) => Math.round(value * 100) / 100;


describe("cadeia: versao aprovada -> plano congelado -> leitura publica", () => {
  it("um plano CONGELADO sobrevive a uma reedicao do texto da proposta", () => {
    const total = computeTotals(readProposalItems(servicos), 0).total;
    const congelado = freezePaymentPlan({ formalText, total });

    // Este e o ponto do congelamento: a proposta foi reeditada e o texto da
    // condicao de pagamento mudou. O cliente que aprovou a versao antiga tem de
    // continuar a ver o plano antigo - e o que assinou.
    const textoReeditado = { formaPagamento: "100% na entrega" };
    const resolvido = resolvePaymentPlanForVersion({
      frozen: congelado,
      formalText: textoReeditado,
      total, 
    });

    expect(resolvido.source).toBe("CONGELADO");
    expect(resolvido.warnings).toHaveLength(0);
    expect(resolvido.snapshot.installments).toHaveLength(3);
    expect(resolvido.snapshot.installments[0].percent).toBe(40);
  });

  it("uma versao SEM plano congelado deriva do proprio texto, com aviso", () => {
    // Ramo LEGACY: a versao nasceu antes do congelamento. Derivamos do texto
    // DA PROPRIA versao - nunca de configuracao global - e avisamos.
    const total = computeTotals(readProposalItems(servicos), 0).total;
    const resolvido = resolvePaymentPlanForVersion({ frozen: null, formalText, total });

    expect(resolvido.source).toBe("LEGACY_DERIVED");
    // Sem aviso, o ADMIN nao saberia que o plano nao esta congelado.
    expect(resolvido.warnings.length).toBeGreaterThan(0);
    expect(resolvido.snapshot.installments).toHaveLength(3);
  });

  it("um snapshot corrompido e recusado em vez de meio lido", () => {
    // Metade de um plano de pagamento e pior do que nenhum: o cliente
    // veria parcelas sem saber o que falta.
    expect(readPaymentPlanSnapshot({ format: 1, installments: [{ label: "x" }] })).toBeNull();
    expect(readPaymentPlanSnapshot({ format: 2, installments: [] })).toBeNull();
    expect(readPaymentPlanSnapshot("isto nao e um plano")).toBeNull();
  });

  it("o plano lido e o plano congelado, numero a numero", () => {
    const total = computeTotals(readProposalItems(servicos), 0).total;
    const congelado = freezePaymentPlan({ formalText, total });
    const relido = readPaymentPlanSnapshot(JSON.parse(JSON.stringify(congelado)));

    // A prova de que o que o cliente vê e o que foi assinado.
    expect(relido).not.toBeNull();
    expect(relido!.total).toBe(congelado.total);
    expect(relido!.installments.map((i) => i.amount)).toEqual(congelado.installments.map((i) => i.amount));
  });
});
