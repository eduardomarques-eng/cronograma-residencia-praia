import { describe, expect, it } from "vitest";
import { buildCommercialNarrative } from "./commercial-narrative";

const completo = {
  clientName: "Maria Silva",
  projectName: "Residência em São Paulo",
  projectDescription: "Reforma completa de uma residência unifamiliar",
  briefingResponses: {
    area: "180 m²",
    rooms: ["Sala", "Cozinha", "Três quartos"],
    p2_natureza: "Reforma completa",
    p3_indispensaveis: "cozinha e sala integradas",
    p4_estilos: "contemporâneo com madeira",
  },
  services: [
    { name: "Projeto arquitetônico", discipline: "ARQUITETURA" },
    { name: "Projeto estrutural", discipline: "ESTRUTURAL" },
  ],
  total: 45_000,
  paymentCondition: "assinatura (40%), entrega (60%)",
  scheduleSummary: "previsto em 60 dias",
  nextStep: "assinatura do contrato e início do levantamento",
  validityDays: 30,
};

describe("buildCommercialNarrative — estrutura do Tópico 43", () => {
  it("cria as sete secções na ordem de leitura", () => {
    const sections = buildCommercialNarrative(completo);
    expect(sections.map((s) => s.key)).toEqual([
      "CLIENT_PROJECT",
      "IDENTIFIED",
      "APPROACH",
      "DELIVERABLES",
      "PROCESS",
      "INVESTMENT",
      "AFTER_APPROVAL",
    ]);
    expect(sections[0].title).toBe("O projeto do cliente");
  });

  it("cada secção declara a origem da informação", () => {
    const sections = buildCommercialNarrative(completo);
    expect(sections.every((s) => typeof s.origin === "string" && s.origin.length > 0)).toBe(true);
    expect(sections.every((s) => s.evidence.length > 0)).toBe(true);
  });
});

describe("buildCommercialNarrative — o que NÃO pode fazer", () => {
  it("omite secções sem dado em vez de escrever frase genérica", () => {
    // Sem nome de projecto não há sequer o que identificar.
    expect(buildCommercialNarrative({})).toHaveLength(0);

    // Com o nome do projecto, a secção de contexto EXISTE e é legítima —
    // mas continua sem inventar área, briefing, valor ou prazo.
    const sections = buildCommercialNarrative({ projectName: "Projeto X" });
    expect(sections.map((s) => s.key)).toEqual(["CLIENT_PROJECT"]);
    expect(sections[0].body).not.toMatch(/m²|ambientes|desconto|dias/i);
  });

  it("não inventa valor quando o total é zero ou ausente", () => {
    const sections = buildCommercialNarrative({ projectName: "P", total: 0 });
    expect(sections.some((s) => s.key === "INVESTMENT")).toBe(false);
  });

  it("não inventa prazo quando o cronograma é inconclusivo", () => {
    const sections = buildCommercialNarrative({
      projectName: "P",
      services: [{ name: "Serviço" }],
      scheduleSummary: null,
    });
    expect(sections.some((s) => s.key === "PROCESS")).toBe(false);
  });

  it("não inventa o passo seguinte: usa apenas o que o ADMIN escreveu", () => {
    const semPasso = buildCommercialNarrative({ projectName: "P", validityDays: 30 });
    const comPasso = buildCommercialNarrative({
      projectName: "P",
      validityDays: 30,
      nextStep: "reunião técnica",
    });
    // Sem nextStep, a secção só existe se houver validade — e sem promessa.
    expect(semPasso.find((s) => s.key === "AFTER_APPROVAL")?.body).not.toMatch(/próximo passo/i);
    expect(comPasso.find((s) => s.key === "AFTER_APPROVAL")?.body).toContain("reunião técnica");
  });

  it("não inventa desconto nem urgência", () => {
    const texto = buildCommercialNarrative(completo)
      .map((s) => s.body)
      .join(" ")
      .toLowerCase();
    for (const proibido of ["desconto", "promoção", "últimas vagas", "apenas hoje", "por tempo limitado", "garantido"]) {
      expect(texto).not.toContain(proibido);
    }
  });

  it("não afirma quantidade de clientes ou projectos concluídos", () => {
    const texto = buildCommercialNarrative(completo)
      .map((s) => s.body)
      .join(" ")
      .toLowerCase();
    expect(texto).not.toMatch(/\d+\s*(projetos|clientes|casas)\s*(já\s*)?(entregues|concluídos|realizados)/);
    expect(texto).not.toMatch(/\+\s*\d+/);
  });
});

describe("buildCommercialNarrative — determinismo", () => {
  it("mesmas entradas produzem exatamente a mesma saída", () => {
    const first = buildCommercialNarrative(completo);
    const second = buildCommercialNarrative({ ...completo });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("não depende de data nem de aleatoriedade", () => {
    const a = buildCommercialNarrative(completo);
    const b = buildCommercialNarrative(completo);
    expect(a.map((s) => s.body)).toEqual(b.map((s) => s.body));
  });
});
