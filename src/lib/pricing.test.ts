import { describe, expect, it } from "vitest";
import {
  calculateQuote,
  levelPrice,
  normalizeQuantity,
  PricingError,
  priceLine,
  round2,
  type CatalogService,
} from "./pricing";

const arquitetura: CatalogService = {
  id: "arq",
  name: "Projeto Arquitetônico",
  discipline: "ARQUITETURA",
  unit: "M2",
  baseLow: 45,
  baseMedium: 62.5,
  baseHigh: 85,
};

const estrutural: CatalogService = {
  id: "est",
  name: "Projeto Estrutural",
  discipline: "ESTRUTURAL",
  unit: "M2",
  baseLow: 38,
  baseMedium: 52,
  baseHigh: 70,
};

const interiores: CatalogService = {
  id: "int",
  name: "Projeto de Interiores",
  discipline: "INTERIORES",
  unit: "AMBIENTE",
  baseLow: 900,
  baseMedium: 1400,
  baseHigh: 2100,
};

const render3d: CatalogService = {
  id: "r3d",
  name: "Render 3D",
  discipline: "3D_RENDER",
  unit: "IMAGEM",
  baseLow: 180,
  baseMedium: 250,
  baseHigh: 380,
};

const catalogo = [arquitetura, estrutural, interiores, render3d];

describe("motor de precificação", () => {
  it("usa o valor do nível escolhido pelo ADMIN", () => {
    expect(levelPrice(arquitetura, "BAIXO")).toBe(45);
    expect(levelPrice(arquitetura, "MEDIO")).toBe(62.5);
    expect(levelPrice(arquitetura, "ALTO")).toBe(85);
  });

  it("não inventa preço quando o nível não está cadastrado", () => {
    const semPreco: CatalogService = { ...render3d, baseLow: 0, baseMedium: 0, baseHigh: 0 };
    expect(levelPrice(semPreco, "MEDIO")).toBeNull();
    expect(() => priceLine(semPreco, { serviceId: "r3d", quantity: 4, level: "MEDIO" })).toThrow(PricingError);
  });

  it("aplica quantidade mínima, máxima e incremento", () => {
    const comLimites: CatalogService = { ...render3d, minQuantity: 4, maxQuantity: 12, increment: 0.5 };
    expect(normalizeQuantity(comLimites, 1).quantity).toBe(4);
    expect(normalizeQuantity(comLimites, 30).quantity).toBe(12);
    const meio = normalizeQuantity(comLimites, 7.2);
    expect(meio.quantity).toBe(7.5);
    expect(meio.notes.join(" ")).toContain("múltiplo");
  });

  it("calcula a memória de cálculo no formato do Tópico 9", () => {
    const quote = calculateQuote(catalogo, {
      level: "MEDIO",
      lines: [
        { serviceId: "arq", quantity: 180 },
        { serviceId: "est", quantity: 180 },
        { serviceId: "int", quantity: 4 },
        { serviceId: "r3d", quantity: 6 },
      ],
      serviceAdjustment: -950,
    });

    expect(quote.subtotal).toBe(27710);
    expect(quote.total).toBe(26760);
    expect(quote.requiresAdminApproval).toBe(true);
    expect(quote.memory[0]).toBe("Projeto Arquitetônico: 180 m² × R$ 62,50/m² = R$ 11.250,00");
    expect(quote.memory[1]).toBe("Projeto Estrutural: 180 m² × R$ 52,00/m² = R$ 9.360,00");
    expect(quote.memory.some((line) => line.startsWith("Ajuste administrativo"))).toBe(true);
    expect(quote.memory).toContain("Subtotal: R$ 27.710,00");
    expect(quote.memory[quote.memory.length - 1]).toBe("Valor final: R$ 26.760,00");
  });

  it("registra a origem quando o ADMIN ajusta o preço unitário", () => {
    const line = priceLine(arquitetura, {
      serviceId: "arq",
      quantity: 100,
      level: "MEDIO",
      unitPriceOverride: 55,
    });
    expect(line.origin).toBe("AJUSTE_ADMIN");
    expect(line.notes.join(" ")).toContain("ajustado pelo ADMIN");
  });

  it("aplica o preço mínimo do serviço", () => {
    const comMinimo: CatalogService = { ...render3d, minPrice: 500 };
    const line = priceLine(comMinimo, { serviceId: "r3d", quantity: 1, level: "MEDIO" });
    expect(line.subtotal).toBe(500);
    expect(line.notes.join(" ")).toContain("Preço mínimo");
  });

  it("aplica desconto percentual e pedido mínimo", () => {
    const quote = calculateQuote([render3d], {
      level: "MEDIO",
      lines: [{ serviceId: "r3d", quantity: 6 }],
      discountPercent: 10,
      minimumOrder: 2000,
    });
    expect(quote.subtotal).toBe(1500);
    expect(quote.total).toBe(2000);
    expect(quote.memory.join(" ")).toContain("Pedido mínimo");
  });

  it("rejeita serviço fora do catálogo e serviço inativo", () => {
    expect(() =>
      calculateQuote([render3d], { level: "MEDIO", lines: [{ serviceId: "nao-existe", quantity: 1 }] }),
    ).toThrow(PricingError);
    const inativo: CatalogService = { ...render3d, active: false };
    expect(() => priceLine(inativo, { serviceId: "r3d", quantity: 1, level: "MEDIO" })).toThrow("inativo");
  });

  it("arredonda valores monetários com segurança", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(10.005)).toBe(10.01);
  });

  it("é determinístico: mesmas entradas, mesma saída", () => {
    const input = { level: "MEDIO" as const, lines: [{ serviceId: "arq", quantity: 180 }] };
    expect(calculateQuote(catalogo, input)).toEqual(calculateQuote(catalogo, input));
  });
});