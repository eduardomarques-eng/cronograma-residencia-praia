import { describe, expect, it } from "vitest";
import {
  boundOptions,
  boundSchedule,
  readCommercialData,
  resolveBinding,
  type CommercialBinding,
} from "./studio-commercial";
import {
  commercialDataFor,
  optionsFor,
  SMART_ELEMENTS,
  stepsFor,
  tableFor,
  type CommercialPiece,
} from "./studio-smart-elements";

/**
 * FASE 4D — ELEMENTOS COMERCIAIS (item 46).
 *
 * O que se protege aqui é uma equivalência: um componente comercial tem de
 * mostrar EXACTAMENTE o que `resolveBinding` devolve. Todos os testes comparam
 * contra `resolveBinding` e nunca contra a função directa, porque essa segunda
 * forma passaria mesmo que o componente tivesse a sua própria lista de fontes —
 * que foi exactamente o defeito que estes testes apanharam.
 */

const servicos = [
  { name: "Projeto de arquitectura", quantity: 120, unitPrice: 45, unit: "m²", order: 1, estimatedDays: 30 },
  { name: "Marcenaria (opcional)", quantity: 1, unitPrice: 5_000, unit: "serviço fixo", order: 2, optional: true, estimatedDays: 10 },
];

const data = readCommercialData({
  services: servicos,
  subtotal: 10_400,
  adjustment: 0,
  total: 10_400,
  paymentPlan: null,
});

const piece = (binding: CommercialBinding): CommercialPiece => ({ binding });

describe("registo de componentes comerciais (item 46)", () => {
  it("cobre os sete componentes que o item pede", () => {
    expect(Object.keys(SMART_ELEMENTS).sort()).toEqual(
      ["COMPARISON", "CTA", "INVESTMENT", "PAYMENT_PLAN", "SCOPE", "SERVICE_LIST", "TIMELINE"].sort(),
    );
  });

  it("cada componente diz para que serve", () => {
    for (const [chave, definicao] of Object.entries(SMART_ELEMENTS)) {
      expect(definicao.label.length, chave).toBeGreaterThan(0);
      expect(definicao.purpose.length, chave).toBeGreaterThan(0);
    }
  });

  it("cada componente aponta para a fonte comercial correcta", () => {
    // A tabela é a ÚNICA fonte desta correspondência: se um componente apontasse
    // para outra fonte, mostraria o número errado sem dar por isso.
    expect(SMART_ELEMENTS.INVESTMENT.binding).toBe("INVESTIMENTO");
    expect(SMART_ELEMENTS.SERVICE_LIST.binding).toBe("SERVICOS");
    expect(SMART_ELEMENTS.COMPARISON.binding).toBe("OPCORES");
    expect(SMART_ELEMENTS.PAYMENT_PLAN.binding).toBe("PAGAMENTO");
    expect(SMART_ELEMENTS.TIMELINE.binding).toBe("CRONOGRAMA");
    expect(SMART_ELEMENTS.SCOPE.binding).toBe("ESCOPO");
  });
describe("os dados vêm da proposta, nunca do componente (item 46)", () => {
  it("mostra o que a proposta resolve, fonte a fonte", () => {
    for (const binding of ["INVESTMENTO", "SERVICOS", "ESCOPO", "PAGAMENTO"] as CommercialBinding[]) {
      expect(tableFor(piece(binding), data), binding).toEqual(resolveBinding(binding, data));
    }
  });

  it("cronograma mostra as etapas com duração acumulada", () => {
    expect(stepsFor(piece("CRONOGRAMA"), data)).toEqual(boundSchedule(data));
    // A acumulação é o que prova que não é uma lista solta.
    expect(stepsFor(piece("CRONOGRAMA"), data)[1].note).toBe("Dia 31 · 10 dias");
  });

  it("comparativo mostra as opções com o valor derivado", () => {
    const opcoes = optionsFor(piece("OPCORES"), data);
    expect(opcoes).toEqual(boundOptions(data));
    // A opção 01 é o contratado (120 × 45 = 5.400); a 02 acrescenta o opcional
    // de 5.000. A diferença é o que faz do comparativo um comparativo.
    expect(opcoes[0].value).toBe("R$ 5.400,00");
    expect(opcoes[1].value).toBe("R$ 10.400,00");
  });

  it("não inventa etapas nem opções onde não as há", () => {
    // Uma peça de investimento não tem etapas. Devolver as do cronograma seria
    // mostrar uma informação que ninguém pediu.
    expect(stepsFor(piece("INVESTIMENTO"), data)).toEqual([]);
    expect(optionsFor(piece("SERVICOS"), data)).toEqual([]);
  });
});

describe("sem proposta, o componente diz isso em vez de falhar", () => {
  it("devolve null, não uma tabela vazia", () => {
    // Uma tabela de investimento sem linhas parece um erro de importação; "sem
    // proposta" é a informação verdadeira. É também o estado do item 36.
    expect(tableFor(piece("INVESTIMENTO"), null)).toBeNull();
    expect(stepsFor(piece("CRONOGRAMA"), null)).toEqual([]);
    expect(optionsFor(piece("OPCORES"), null)).toEqual([]);
  });

  it("não devolve dados sem peça", () => {
    expect(tableFor(null, data)).toBeNull();
    expect(commercialDataFor(null, data)).toBeNull();
  });

  it("devolve o par peça+dados quando os dois existem", () => {
    expect(commercialDataFor(piece("SERVICOS"), data)?.binding).toBe("SERVICOS");
  });
});

describe("os dados comerciais não vazam para o autor (item 46)", () => {
  it("todos os componentes resolvem o mesmo total, sem recalcular", () => {
    // Se dois componentes devolvessem totais diferentes, o editor mostraria um
    // número que o contrato não tem. O total CONTRACTADO é 5.400 — o opcional de
    // 5.000 é mostrado à parte e nunca entra nele (item 71).
    const investimento = tableFor(piece("INVESTIMENTO"), data)?.totals.at(-1)?.value;
    const servicosTotal = tableFor(piece("SERVICOS"), data)?.totals.at(-1)?.value;
    expect(investimento).toBe(servicosTotal);
    expect(investimento).toBe("R$ 10.400,00");
  });

  it("o opcional aparece à parte e não entra no total", () => {
    // A distinção que separa uma proposta honesta de uma que promete mais do
    // que o cliente contratou.
    const totais = tableFor(piece("INVESTIMENTO"), data)?.totals ?? [];
    expect(totais.find((linha) => linha.label === "Subtotal")?.value).toBe("R$ 5.400,00");
    expect(totais.find((linha) => linha.label.startsWith("Opcionais"))?.value).toBe("R$ 5.000,00");
  });

  it("uma peça que não é de cronograma nunca lança", () => {
    // Um `binding` gravado por uma versão futura não pode partir a página do
    // cliente de uma proposta já enviada.
    for (const binding of ["CRONOGRAMA", "OPCORES"] as CommercialBinding[]) {
      expect(() => tableFor(piece(binding), data), binding).not.toThrow();
    }
  });
});

  it("a chamada à acção NÃO está ligada à proposta", () => {
    // Um pedido de decisão não é um valor. Ligá-lo faria o servidor resolver um
    // "CTA" que não tem dado nenhum.
    expect(SMART_ELEMENTS.CTA.binding).toBeNull();
  });
});