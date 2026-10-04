import { describe, expect, it } from "vitest";
import { consolidateBriefing } from "./briefing-consolidation";
import { ANSWER_SOURCE, type StoredAnswers } from "./briefing-answers";
import { allBriefingQuestions, briefingSections } from "./briefing-definition";

/**
 * Tópico 4A — a consolidação que a Fase 4B vai consumir.
 *
 * O teste mais importante aqui é o do vazio: com um briefing por responder, a
 * consolidação tem de devolver campos NULOS e não texto inventado. Uma
 * consolidação que preenche por omissão ensinaria o profissional a trabalhar
 * sobre decisões que o cliente nunca tomou.
 */
const AGORA = "2026-10-05T12:00:00.000Z";
const r = (valor: unknown): StoredAnswers[string] => ({
  value: valor,
  source: ANSWER_SOURCE.CLIENT,
  updatedAt: AGORA,
});

function consolidar(answers: StoredAnswers, references: [] = []) {
  return consolidateBriefing({
    answers,
    questions: allBriefingQuestions,
    sections: briefingSections,
    references,
  });
}

/** As respostas mínimas que deixam o briefing pronto para a Fase 4B. */
function completas(extra: StoredAnswers = {}): StoredAnswers {
  return {
    p1_relacao: r("OWNER"),
    p1_quem: r([{ id: "u1", label: "Ana", detail: "adulto" }]),
    p2_natureza: r("Reforma completa"),
    p3_porque_agora: r("O espaço não serve mais"),
    p3_problema: r("Cozinha pequena"),
    p3_prioridade_objetivo: r("essencial"),
    p3_ambientes: r([
      { id: "amb-1", name: "Cozinha", quantity: 1, priority: "essencial", mandatory: true },
      { id: "amb-2", name: "Sala", quantity: 1, priority: "importante" },
    ]),
    p15_tecnicas: r([{ id: "t1", label: "Elétrica" }]),
    p19_servicos: r(["ARQUITETURA", "INTERIORES"]),
    ...extra,
  };
}

describe("consolidação do briefing", () => {
  it("com o briefing vazio não inventa nada", () => {
    const c = consolidar({});
    expect(c.program).toEqual([]);
    expect(c.relations).toEqual([]);
    expect(c.budget.amount).toBeNull();
    expect(c.budget.range).toBeNull();
    expect(c.deadline.date).toBeNull();
    expect(c.deadline.hasDeadline).toBeNull();
    expect(c.services).toEqual([]);
    expect(c.pendingDocuments).toBeNull();
    expect(c.readiness.ready).toBe(false);
  });

  it("assinala o programa de necessidades vazio como bloqueio", () => {
    const c = consolidar({ p1_relacao: r("OWNER") });
    expect(c.readiness.ready).toBe(false);
    expect(c.readiness.blockers).toContain("Programa de necessidades vazio");
  });

  it("deixa o briefing pronto quando o essencial está respondido", () => {
    const c = consolidar(completas());
    expect(c.readiness.ready).toBe(true);
    expect(c.readiness.blockers).toEqual([]);
  });

  it("uma pergunta opcional vazia NÃO impede estar pronto", () => {
    const semOrcamento = consolidar(completas());
    expect(semOrcamento.readiness.ready).toBe(true);
    expect(semOrcamento.readiness.advisories).toContain("Orçamento ainda não informado");
  });

  it("lê o programa de necessidades estruturado", () => {
    const c = consolidar(completas());
    expect(c.program).toHaveLength(2);
    expect(c.program[0].name).toBe("Cozinha");
    expect(c.program[0].mandatory).toBe(true);
    expect(c.program[1].name).toBe("Sala");
  });

  it("descarta ambientes sem nome — cartão vazio não é ambiente", () => {
    const c = consolidar(completas({ p3_ambientes: r([{ id: "a", name: "   " }, { id: "b", name: "Sala" }]) }));
    expect(c.program).toHaveLength(1);
    expect(c.program[0].name).toBe("Sala");
  });

  it("descarta relações para ambientes que já não existem", () => {
    const c = consolidar(
      completas({
        p3_relacoes: r([
          { id: "r1", fromEnvironmentId: "amb-1", toEnvironmentId: "amb-2" },
          { id: "r2", fromEnvironmentId: "amb-1", toEnvironmentId: "fantasma" },
        ]),
      }),
    );
    expect(c.relations).toHaveLength(1);
    expect(c.relations[0].toEnvironmentId).toBe("amb-2");
  });

  it("lê orçamento e prazo quando existem", () => {
    const c = consolidar(
      completas({ p10_orcamento: r(180000), p17_faixa: r("De R$ 150.000 a R$ 300.000") }),
    );
    expect(c.budget.amount).toBe(180000);
    expect(c.budget.range).toBe("De R$ 150.000 a R$ 300.000");
  });

  it("lê serviços e pendências de documentos", () => {
    const c = consolidar(completas({ p20_faltando: r("Aguardo a planta") }));
    expect(c.services).toEqual(["ARQUITETURA", "INTERIORES"]);
    expect(c.pendingDocuments).toBe("Aguardo a planta");
  });

  it("assinala um prazo declarado sem data", () => {
    const c = consolidar(completas({ p18_tem_prazo: r(true) }));
    expect(c.conflicts.map((x) => x.id)).toContain("prazo-sem-data");
  });

  it("assinala orçamento em aberto com programa extenso", () => {
    const ambientes = Array.from({ length: 6 }, (_, i) => ({
      id: `amb-${i}`,
      name: `Ambiente ${i}`,
    }));
    const c = consolidar(
      completas({ p3_ambientes: r(ambientes), p17_faixa: r("Ainda não tenho ideia") }),
    );
    expect(c.conflicts.map((x) => x.id)).toContain("orcamento-programa");
  });

  it("não corrige a inconsistência: aponta e deixa a revisão ao humano", () => {
    const c = consolidar(
      completas({
        p3_ambientes: r([{ id: "amb-1", name: "Cozinha", integration: "Aberta, integrada à sala" }]),
        p3_distribuicao: r("Prefiro ambientes bem separados, não quero integração"),
      }),
    );
    const conflito = c.conflicts.find((x) => x.id === "integracao-ambientes");
    expect(conflito).toBeDefined();
    expect(conflito?.severity).toBe("warning");
    // A resposta do cliente fica intacta: o sistema não reescreve.
    expect(c.program[0].integration).toBe("Aberta, integrada à sala");
  });

  it("agrupa as respostas por etapa para a revisão", () => {
    const c = consolidar(completas());
    const contexto = c.sections.find((s) => s.id === "contexto");
    expect(contexto?.answered.length).toBeGreaterThan(0);
    expect(contexto?.answered.every((linha) => linha.source === "CLIENT")).toBe(true);
  });
});