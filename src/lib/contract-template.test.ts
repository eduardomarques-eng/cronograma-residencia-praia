import { describe, expect, it } from "vitest";
import {
  buildContractText,
  CONTRACT_CLAUSE_SECTIONS,
  formatCurrencyBRL,
  formatDateBR,
  formatDateLongBR,
  REQUIRED_CONTRACT_VARIABLES,
} from "./contract-template";
import { extractTemplateKeys, renderTemplate } from "./template-engine";

describe("motor de templates contratuais", () => {
  it("substitui variáveis e normaliza a grafia das chaves", () => {
    const rendered = buildContractText("Cliente {{cliente_nome}} — total {{VALOR_TOTAL}}", {
      CLIENTE_NOME: "Ana",
      VALOR_TOTAL: "R$ 10,00",
    });
    expect(rendered.text).toBe("Cliente Ana — total R$ 10,00");
    expect(rendered.missing).toEqual([]);
  });

  it("não inventa valores: mantém o placeholder e reporta o que falta", () => {
    const rendered = buildContractText("CPF: {{CLIENTE_CPF}}", {});
    expect(rendered.text).toBe("CPF: {{CLIENTE_CPF}}");
    expect(rendered.missing).toEqual(["CLIENTE_CPF"]);
    expect(rendered.missingRequired).toEqual([]);
  });

  it("bloqueia a geração quando falta variável obrigatória", () => {
    const rendered = buildContractText("Total {{VALOR_TOTAL}}", {});
    expect(rendered.missingRequired).toEqual(["VALOR_TOTAL"]);
    expect(REQUIRED_CONTRACT_VARIABLES).toContain("VALOR_TOTAL");
    expect(REQUIRED_CONTRACT_VARIABLES).toContain("DATA_CONTRATO");
  });

  it("mantém a estrutura normalizada de cláusulas exigida no Tópico 25", () => {
    expect(CONTRACT_CLAUSE_SECTIONS.map((section) => section.key)).toEqual([
      "objeto",
      "etapas",
      "prazos",
      "honorarios",
      "obrigacoes",
      "responsabilidades",
      "direitos_autoriais",
      "documentos",
      "condicoes",
      "assinatura",
    ]);
    expect(CONTRACT_CLAUSE_SECTIONS.map((section) => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("formata valores em pt-BR de forma estável", () => {
    expect(formatCurrencyBRL(18450)).toBe("R$ 18.450,00");
    expect(formatCurrencyBRL(18450.5)).toBe("R$ 18.450,50");
    expect(formatCurrencyBRL(null)).toBe("R$ 0,00");
    expect(formatDateBR(new Date(Date.UTC(2026, 9, 3)))).toBe("03/10/2026");
    expect(formatDateLongBR(new Date(Date.UTC(2026, 9, 3)))).toBe("3 de outubro de 2026");
  });

  it("extrai chaves normalizadas e ordena o resultado", () => {
    expect(extractTemplateKeys("{{cliente}} e {{ VALOR_TOTAL }} e {{cliente}}")).toEqual(["CLIENTE", "VALOR_TOTAL"]);
  });

  it("ignora chaves não usadas e devolve as utilizadas", () => {
    const rendered = renderTemplate("Olá {{CLIENTE}}!", { CLIENTE: "Ana", PROJETO_NOME: "Casa" });
    expect(rendered.used).toEqual(["CLIENTE"]);
  });
});