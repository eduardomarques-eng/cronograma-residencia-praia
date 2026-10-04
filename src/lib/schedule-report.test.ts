import { describe, expect, it } from "vitest";
import { buildScheduleReport, type ScheduleReportInput } from "./schedule-report";
import { renderScheduleReportPdf } from "./pdf/schedule-report-pdf";
import { hexString } from "./pdf/pdf-writer";

const EMITIDA = new Date("2026-08-19T12:00:00.000Z");

function etapa(over: Partial<ScheduleReportInput["stages"][number]> = {}) {
  return {
    id: "s1",
    name: "Estudo Preliminar",
    discipline: "Arquitetura",
    designer: "Eduardo Marques",
    startDate: null,
    endDate: null,
    dueDate: new Date("2026-06-12T00:00:00.000Z"),
    completion: 100,
    status: "COMPLETED",
    order: 1,
    dependencyName: null,
    dependencyStatus: null,
    ...over,
  };
}

function entrada(overrides: Partial<ScheduleReportInput> = {}): ScheduleReportInput {
  return {
    project: {
      id: "p1",
      name: "Residência de Praia",
      type: "Residencial",
      description: null,
      scope: null,
      startDate: new Date("2026-06-12T00:00:00.000Z"),
      expectedEndDate: new Date("2026-11-30T00:00:00.000Z"),
      status: "IN_PROGRESS",
      address: { localizacao: "Loteamento Praia Bela", areaConstruida: "385,00 m²" },
    },
    client: { name: "Pedro", fullName: "Pedro Silva", city: "Florianópolis", state: "SC" },
    stages: [
      etapa(),
      etapa({
        id: "s2",
        name: "Projeto Executivo",
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        completion: 20,
        status: "IN_PROGRESS",
        order: 3,
      }),
      etapa({
        id: "s3",
        name: "Projeto Formas Finais",
        discipline: "Estrutura",
        designer: "Luan Almeida",
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        completion: 90,
        status: "IN_PROGRESS",
        order: 7,
      }),
      etapa({
        id: "s4",
        name: "Projeto Fundação",
        discipline: "Estrutura",
        designer: "Luan Almeida",
        dueDate: new Date("2026-08-30T00:00:00.000Z"),
        completion: 0,
        status: "NOT_STARTED",
        order: 9,
        dependencyName: "Projeto Formas Finais",
        dependencyStatus: "IN_PROGRESS",
      }),
    ],
    payments: [
      {
        id: "pa1",
        name: "Entrada",
        amount: 30000,
        dueDate: new Date("2026-06-01T00:00:00.000Z"),
        paidAt: new Date("2026-06-01T00:00:00.000Z"),
        status: "PAID",
        stageName: "Estudo Preliminar",
      },
      {
        id: "pa2",
        name: "Projeto executivo",
        amount: 50000,
        dueDate: new Date("2026-09-30T00:00:00.000Z"),
        paidAt: null,
        status: "PENDING",
        stageName: "Projeto Executivo",
      },
    ],
    budget: 120000,
    emittedAt: EMITIDA,
    ...overrides,
  };
}
describe("regra única de progresso no relatório", () => {
  it("o progresso geral é a média das etapas pela regra oficial", () => {
    // (100 + 20 + 90 + 0) / 4 = 52,5 -> 53
    const report = buildScheduleReport(entrada());
    expect(report.overall.progress).toBe(53);
    expect(report.overall.completed).toBe(1);
    expect(report.overall.total).toBe(4);
  });

  it("o progresso por disciplina é a média das etapas da disciplina", () => {
    const report = buildScheduleReport(entrada());
    // Arquitetura: (100 + 20) / 2 = 60. Estrutura: (90 + 0) / 2 = 45.
    expect(report.disciplines).toEqual([
      { discipline: "Arquitetura", progress: 60, total: 2, completed: 1 },
      { discipline: "Estrutura", progress: 45, total: 2, completed: 0 },
    ]);
  });

  it("etapa concluída conta 100 mesmo com a percentagem por fechar", () => {
    const report = buildScheduleReport(entrada({ stages: [etapa({ completion: 40 })] }));
    expect(report.overall.progress).toBe(100);
    expect(report.overall.completed).toBe(1);
  });

  it("projeto sem etapas não devolve NaN nem percentagem inventada", () => {
    const report = buildScheduleReport(entrada({ stages: [] }));
    expect(report.empty).toBe(true);
    expect(report.overall.total).toBe(0);
    expect(report.overall.progress).toBe(0);
    expect(report.disciplines).toEqual([]);
  });
});

describe("alertas do relatório", () => {
  it("usa a regra única: atraso, bloqueio e prazo próximo", () => {
    const report = buildScheduleReport(entrada());
    // Emitida a 19/08: Formas Finais venceu a 01/08 (atraso); Fundação está
    // bloqueada pela dependência pendente; Executivo vence a 05/09 (17 dias).
    expect(report.alerts.overdue).toBe(1);
    expect(report.alerts.blocked).toBe(1);
    expect(report.alerts.dueSoon).toBe(0);
    expect(report.alertRows.map((row) => row.stage)).toEqual([
      "Projeto Fundação",
      "Projeto Formas Finais",
    ]);
  });

  it("etapa concluída nunca gera alerta, mesmo com prazo antigo", () => {
    const report = buildScheduleReport(entrada());
    const concluida = report.stages.find((stage) => stage.name === "Estudo Preliminar");
    expect(concluida?.alert.overdue).toBe(false);
    expect(concluida?.alertDetail).toBe("Concluída");
  });
});

describe("estrutura do relatório", () => {
  it("preserva as secções e a nomenclatura da referência", () => {
    const report = buildScheduleReport(entrada());
    expect(report.title).toBe("RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS");
    expect(report.criteria.length).toBeGreaterThan(0);
    expect(report.stages).toHaveLength(4);
    expect(report.ficha.map((row) => row.label)).toContain("Cronograma contratual");
    expect(report.ficha.map((row) => row.label)).toContain("Área construída");
    expect(report.financial.rows.map((row) => row.label)).toContain("Valor contratado");
    expect(report.signatures.at(-1)?.role).toBe("Cliente / Contratante");
  });

  it("lê área e localização do address, e diz 'Não informado' quando falta", () => {
    const com = buildScheduleReport(entrada());
    expect(com.ficha.find((row) => row.label === "Área construída")?.value).toBe("385,00 m²");
    const sem = buildScheduleReport(entrada({ project: { ...entrada().project, address: null } }));
    expect(sem.ficha.find((row) => row.label === "Área construída")?.value).toBe("Não informado");
    expect(sem.ficha.find((row) => row.label === "Lote / Quadra")?.value).toBe("Não informado");
  });

  it("usa o valor formatado em reais no resumo financeiro", () => {
    const report = buildScheduleReport(entrada());
    expect(report.financial.rows[0].value).toBe("R$ 120.000,00");
    expect(report.financial.rows[1].value).toBe("R$ 30.000,00");
    expect(report.financial.rows[2].value).toBe("R$ 50.000,00");
  });

  it("só assina quem é responsável real de uma etapa, mais o cliente", () => {
    const report = buildScheduleReport(entrada());
    expect(report.signatures.map((person) => person.name)).toEqual([
      "Eduardo Marques",
      "Luan Almeida",
      "Pedro Silva",
    ]);
  });

  it("não inventa pessoas quando não há responsável atribuído", () => {
    const report = buildScheduleReport(entrada({ stages: [etapa({ designer: null })] }));
    expect(report.equipe).toEqual([]);
    expect(report.signatures.map((person) => person.name)).toEqual(["Pedro Silva"]);
  });

  it("o parecer menciona concluídas, em curso e atrasadas", () => {
    const text = buildScheduleReport(entrada()).parecer.join(" ");
    expect(text).toContain("Pedro Silva");
    expect(text).toContain("Residência de Praia");
    expect(text).toContain("Estudo Preliminar");
    expect(text).toContain("Projeto Formas Finais");
    expect(text).toContain("prazo vencido");
  });

  it("o parecer explica a ausência de dados em vez de mostrar 0% como verdade", () => {
    const report = buildScheduleReport(entrada({ stages: [], payments: [], budget: null }));
    expect(report.parecer.join(" ")).toContain("ainda não tem etapas cadastradas");
    expect(report.financial.rows[0].value).toBe("Não informado");
    expect(report.financial.rows[1].value).toBe("—");
  });

  it("é determinístico: os mesmos dados dão o mesmo relatório", () => {
    expect(JSON.stringify(buildScheduleReport(entrada()))).toBe(
      JSON.stringify(buildScheduleReport(entrada())),
    );
  });
});
describe("PDF do relatório", () => {
  function pdf(input = entrada()): string {
    return Buffer.from(renderScheduleReportPdf(buildScheduleReport(input))).toString("latin1");
  }

  it("gera um PDF válido", () => {
    const bytes = pdf();
    expect(bytes.startsWith("%PDF-1.4")).toBe(true);
    expect(bytes.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(bytes).toContain("/Type /Catalog");
  });

  it("inclui as secções da referência", () => {
    const bytes = pdf();
    for (const section of [
      "1. DADOS DE ENTRADA",
      "2. QUADRO T",
      "3. FASE ATUAL",
      "4. PARECER",
      "5. RESUMO DE AVAN",
      "6. RESUMO FINANCEIRO",
      "7. QUADRO CONSOLIDADO",
      "8. CRIT",
    ]) {
      expect(bytes).toContain(hexString(section).slice(1, -1));
    }
  });

  it("leva os dados reais, com acentuação correcta", () => {
    const bytes = pdf();
    expect(bytes).toContain(hexString("Residência de Praia"));
    expect(bytes).toContain(hexString("Eduardo Marques"));
    expect(bytes).toContain(hexString("R$ 120.000,00"));
    expect(bytes).toContain(hexString("RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS"));
  });

  it("pagina com muitas etapas, sem perder o cabeçalho da tabela", () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      etapa({
        id: `s${index}`,
        name: `Etapa de projeto número ${index + 1}`,
        dueDate: new Date("2026-10-01T00:00:00.000Z"),
        completion: 50,
        status: "IN_PROGRESS",
        order: index + 1,
      }),
    );
    const bytes = pdf(entrada({ stages: many }));
    const pages = (bytes.match(/\/Type \/Page /g) ?? []).length;
    expect(pages).toBeGreaterThan(2);
    const header = hexString("Descrição / Etapa").slice(1, 20);
    expect(bytes.split(header).length - 1).toBeGreaterThanOrEqual(pages - 1);
  });

  it("gera PDF mesmo sem nenhum dado", () => {
    const bytes = pdf(entrada({ stages: [], payments: [], budget: null }));
    expect(bytes.startsWith("%PDF-1.4")).toBe(true);
    expect(bytes).toContain(hexString("Sem etapas cadastradas").slice(1, 20));
  });

  it("o mesmo relatório produz sempre o mesmo ficheiro", () => {
    expect(pdf()).toBe(pdf());
  });
});
