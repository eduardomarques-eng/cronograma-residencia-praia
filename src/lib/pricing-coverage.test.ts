import { describe, expect, it } from "vitest";
import {
  calculateQuote,
  normalizeQuantity,
  priceLine,
  PricingError,
  SERVICE_UNITS,
  type CatalogService,
  type PricingLevelName,
} from "./pricing";

const servico: CatalogService = {
  id: "svc-1",
  name: "Projeto arquitetônico",
  discipline: "ARQUITETURA",
  unit: "M2",
  baseLow: 20,
  baseMedium: 30,
  baseHigh: 40,
  minPrice: 0,
  estimatedDays: 30,
};

/**
 * Prompt 19, item 51 — lacunas identificadas na auditoria de cobertura do
 * motor de precificação. O resto (níveis, mínimo/máximo/incremento, memória de
 * cálculo, origem do ajuste, arredondamento) já tinha teste.
 */
describe("precificação — unidade m²", () => {
  it("preço unitário aplica-se à área em m²", () => {
    const line = priceLine(servico, { level: "MEDIO", serviceId: "svc-1", quantity: 220 });
    // 220 m² × R$ 30,00
    expect(line.subtotal).toBe(6600);
    expect(line.unit).toBe("M2");
  });

  it("a unidade faz parte do contrato do serviço, não do valor", () => {
    // Trocar a unidade sem trocar o preço unitário não pode mudar o subtotal:
    // quem define o preço por m² continua a cobrar por m².
    const porAmbiente = { ...servico, id: "svc-2", unit: "AMBIENTE" as const };
    const a = priceLine(servico, { level: "MEDIO", serviceId: "svc-1", quantity: 10 });
    const b = priceLine(porAmbiente, { level: "MEDIO", serviceId: "svc-2", quantity: 10 });
    expect(a.subtotal).toBe(b.subtotal);
    expect(a.unit).not.toBe(b.unit);
  });

  it("unidades configuráveis são aceites pelo motor", () => {
    for (const unit of SERVICE_UNITS) {
      const linha = priceLine({ ...servico, unit }, { level: "MEDIO", serviceId: "svc-1", quantity: 2 });
      expect(linha.unit).toBe(unit);
    }
  });
});

describe("precificação — acréscimo, desconto e mínimo", () => {
  it("aplica acréscimo (taxa) e desconto sobre o subtotal", () => {
    const quote = calculateQuote([servico], {
      level: "MEDIO",
      lines: [{ serviceId: "svc-1", quantity: 100 }],
      discountPercent: 10,
      extraFee: 500,
    });
    // 100 × 30 = 3000; −10% = 2700; +500 taxa = 3200
    expect(quote.subtotal).toBe(3000);
    expect(quote.extraFee).toBe(500);
    expect(quote.total).toBe(3200);
  });

  it("o acréscimo obriga a autorização do ADMIN", () => {
    const quote = calculateQuote([servico], {
      level: "MEDIO",
      lines: [{ serviceId: "svc-1", quantity: 10 }],
      extraFee: 100,
    });
    expect(quote.requiresAdminApproval).toBe(true);
  });

  it("sem ajuste, desconto ou taxa, não exige autorização adicional", () => {
    const quote = calculateQuote([servico], {
      level: "MEDIO",
      lines: [{ serviceId: "svc-1", quantity: 10 }],
    });
    expect(quote.requiresAdminApproval).toBe(false);
  });

  it("a memória de cálculo regista o acréscimo e o desconto", () => {
    const quote = calculateQuote([servico], {
      level: "MEDIO",
      lines: [{ serviceId: "svc-1", quantity: 10 }],
      discountPercent: 10,
      extraFee: 250,
    });
    const memoria = quote.memory.join(" | ");
    expect(memoria).toContain("Desconto");
    expect(memoria).toContain("Taxa adicional");
    expect(memoria).toContain("Valor final");
  });
});

describe("precificação — pacote (cobertura composta)", () => {
  it("calcula um pacote pela soma das linhas, com a mesma memória de cálculo", () => {
    const estrutural: CatalogService = { ...servico, id: "svc-2", name: "Projeto estrutural", unit: "UNIDADE" as const };
    const quote = calculateQuote([servico, estrutural], {
      level: "BAIXO",
      lines: [
        { serviceId: "svc-1", quantity: 100 }, // 100 × 20 = 2000
        { serviceId: "svc-2", quantity: 2 }, // 2 × 20 = 40
      ],
    });
    expect(quote.subtotal).toBe(2040);
    expect(quote.total).toBe(2040);
    expect(quote.lines.map((line) => line.name)).toEqual(["Projeto arquitetônico", "Projeto estrutural"]);
  });

  it("um serviço do pacote ausente do catálogo invalida a proposta toda", () => {
    // Falhar cedo é melhor do que orçar um pacote pela metade.
    expect(() =>
      calculateQuote([servico], {
        level: "MEDIO",
        lines: [{ serviceId: "svc-inexistente", quantity: 1 }],
      }),
    ).toThrow(PricingError);
  });
});

describe("precificação — integridade", () => {
  it("rejeita quantidade não numérica ou negativa", () => {
    expect(() => normalizeQuantity(servico, -5)).toThrow(PricingError);
    expect(() => normalizeQuantity(servico, Number.NaN)).toThrow(PricingError);
  });

  it("não inventa preço quando o serviço não tem valor no nível", () => {
    const semValor: CatalogService = { ...servico, baseMedium: 0 };
    expect(() => priceLine(semValor, { level: "MEDIO", serviceId: "svc-1", quantity: 10 })).toThrow(
      PricingError,
    );
  });

  it("cada nível devolve o seu próprio valor", () => {
    const niveis: Array<[PricingLevelName, number]> = [
      ["BAIXO", 20],
      ["MEDIO", 30],
      ["ALTO", 40],
    ];
    for (const [nivel, esperado] of niveis) {
      expect(priceLine(servico, { level: nivel, serviceId: "svc-1", quantity: 1 }).subtotal).toBe(esperado);
    }
  });

  it("o ajuste do ADMIN vence o catálogo e fica marcado como ajuste", () => {
    const line = priceLine(servico, {
      level: "MEDIO",
      serviceId: "svc-1",
      quantity: 10,
      unitPriceOverride: 25,
    });
    expect(line.unitPrice).toBe(25);
    expect(line.origin).toBe("AJUSTE_ADMIN");
    // A origem fica registada para a auditoria responder "de onde veio este valor".
    expect(line.notes.join(" ")).toContain("catálogo");
  });
});
