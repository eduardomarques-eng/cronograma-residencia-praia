import { describe, expect, it } from "vitest";
import { deriveCommercialInsights } from "./commercial-insights";

describe("inteligência determinística do sistema", () => {
  it("só recomenda a partir de dados cadastrados e sempre mostra a origem", () => {
    const insights = deriveCommercialInsights({
      briefingResponses: { area: "180 m²", rooms: ["sala", "cozinha"] },
      services: [{ discipline: "ARQUITETURA" }],
    });
    const area = insights.find((insight) => insight.code === "AREA_DETECTED");
    expect(area?.detail).toBe("O briefing informa 180 m².");
    expect(area?.origin).toBe("BRIEFING");
    expect(insights.every((insight) => Boolean(insight.origin) && Boolean(insight.originRef))).toBe(true);
  });

  it("sugere complementares sem aplicá-los e sinaliza aprovação do ADMIN", () => {
    const insights = deriveCommercialInsights({ services: [{ discipline: "ARQUITETURA" }] });
    const suggestions = insights.filter((insight) => insight.code === "SUGGEST_COMPLEMENTARY");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((insight) => insight.requiresAdminApproval)).toBe(true);
  });

  it("não inventa nada quando não há briefing nem escopo", () => {
    expect(deriveCommercialInsights({})).toEqual([]);
  });

  it("aponta pacote do catálogo que cobre as disciplinas contratadas", () => {
    const insights = deriveCommercialInsights({
      services: [{ discipline: "ARQUITETURA" }],
      packages: [{ name: "Essencial", disciplines: ["ARQUITETURA"] }],
    });
    const pack = insights.find((insight) => insight.code === "PACKAGE_MATCH");
    expect(pack?.detail).toContain("Essencial");
    expect(pack?.origin).toBe("CATALOGO");
  });

  it("é determinístico: mesmas entradas, mesma saída", () => {
    const input = { briefingResponses: { area: "120 m²" }, services: [{ discipline: "INTERIORES" }] };
    expect(deriveCommercialInsights(input)).toEqual(deriveCommercialInsights(input));
  });
});