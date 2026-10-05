import { describe, expect, it } from "vitest";
import {
  authoritativeValues,
  classifyCommercialIntent,
  CommercialActionRequired,
  findCommercialDrift,
  guardCommercialCommand,
  isCommercialCommand,
  parsePercent,
  planCommercialAction,
} from "./studio-ai-commercial";
import { readProposalItems, type ProposalItem } from "./proposal-item";

/** Duas linhas: 10 000 + 5 000, sem opção. Total contratado = 15 000. */
const rawItems = [
  { name: "Projecto", quantity: 1, unitPrice: 10000, order: 0 },
  { name: "Acompanhamento", quantity: 1, unitPrice: 5000, order: 1 },
];

const items = (): ProposalItem[] => readProposalItems(rawItems);

describe("item 55 — classificação de comando comercial", () => {
  it("reconhece um desconto pedido em linguagem natural", () => {
    expect(isCommercialCommand("reduza o preço em 20%")).toBe(true);
  });

  it("reconhece o desconto mesmo embrulhado num comando editorial", () => {
    // O caso perigoso: parece editorial, mas o verbo é comercial.
    expect(isCommercialCommand("melhora a proposta e aplica 10% de desconto")).toBe(true);
  });

  it("não confunde adjectivo comercial com comando comercial", () => {
    // "preço transparente" tem o campo, mas não tem verbo de mudança.
    expect(isCommercialCommand("reescreve isto com um preço transparente")).toBe(false);
  });

  it("deixa passar comandos puramente editoriais", () => {
    for (const comando of [
      "resuma este parágrafo",
      "melhora a redação",
      "torna mais técnico",
      "simplifica a frase",
      "",
    ]) {
      expect(isCommercialCommand(comando)).toBe(false);
    }
  });

  it("reconhece escopo, pagamento e validade como comerciais", () => {
    expect(isCommercialCommand("inclui a jardinagem no escopo")).toBe(true);
    expect(isCommercialCommand("estenda o prazo de pagamento")).toBe(true);
    expect(isCommercialCommand("aumente a validade")).toBe(true);
  });

  it("ignora acentos em PT-BR", () => {
    expect(isCommercialCommand("reduza o preço")).toBe(true);
    expect(isCommercialCommand("altere a prestação")).toBe(true);
  });

  it("relata os campos tocados", () => {
    const intent = classifyCommercialIntent("reduza o preço em 20%");
    expect(intent.commercial).toBe(true);
    expect(intent.fields).toContain("preco");
  });

  it("exige campo E mutação", () => {
    // Verbo sem campo comercial não é comercial.
    expect(classifyCommercialIntent("resuma e melhore").mutation).toBe(true);
    expect(classifyCommercialIntent("resuma e melhore").commercial).toBe(false);
  });
});

describe("item 55 — extracção da percentagem", () => {
  it("lê percentagens em vários formatos", () => {
    expect(parsePercent("reduza 20%")).toBe(-20);
    expect(parsePercent("reduza 20 %")).toBe(-20);
    expect(parsePercent("applique 20 por cento")).toBe(-20);
    expect(parsePercent("desconto de 12,5%")).toBe(-12.5);
    expect(parsePercent("desconto de 0,2")).toBe(-20);
    expect(parsePercent("aplique desconto de 15")).toBe(-15);
  });

  it("devolve null quando não há percentagem — nunca zero", () => {
    // null ≠ 0: tratar a ausência como 0% seria um "não faça nada" silencioso.
    expect(parsePercent("reduza o preço")).toBeNull();
    expect(parsePercent("aplique um desconto")).toBeNull();
  });
});

describe("item 55 — a acção passa pelo pricing oficial", () => {
  it("calcula o desconto com computeTotals, não aritmética da IA", () => {
    const action = planCommercialAction({ instruction: "reduza o preço em 20%", items: items() });

    expect(action.kind).toBe("AJUSTE_PERCENTUAL");
    if (action.kind !== "AJUSTE_PERCENTUAL") return;
    expect(action.base).toBe(15000);
    expect(action.adjustment).toBe(-3000);
    expect(action.total).toBe(12000);
  });

  it("acumula sobre um ajuste já existente", () => {
    const action = planCommercialAction({
      instruction: "aplique mais 10% de desconto",
      items: items(),
      adjustment: -1000,
    });
    if (action.kind !== "AJUSTE_PERCENTUAL") return;
    // Base já ajustada: 14 000. 10% → -1 400. Total 12 600.
    expect(action.base).toBe(14000);
    expect(action.adjustment).toBe(-1400);
    expect(action.total).toBe(12600);
  });

  it("exige percentagem explícita em vez de adivinhar", () => {
    const action = planCommercialAction({ instruction: "reduza o preço", items: items() });
    expect(action.kind).toBe("REQUER_REVISAO_HUMANA");
  });

  it("recusa desconto sobre total zero", () => {
    const action = planCommercialAction({ instruction: "reduza o preço em 20%", items: [] });
    expect(action.kind).toBe("REQUER_REVISAO_HUMANA");
    if (action.kind !== "REQUER_REVISAO_HUMANA") return;
    expect(action.reason).toContain("zero");
  });

  it("manda para revisão humana o que é contrato, não aritmética", () => {
    // Escopo, prazo e pagamento não são um desconto.
    for (const comando of [
      "inclui a jardinagem no escopo",
      "estenda a validade para 90 dias",
      "muda as parcelas de pagamento",
    ]) {
      const action = planCommercialAction({ instruction: comando, items: items() });
      expect(action.kind).toBe("REQUER_REVISAO_HUMANA");
    }
  });

  it("nunca produz total negativo", () => {
    // Desconto de 100% deixa zero, não menos.
    const action = planCommercialAction({ instruction: "reduza 100%", items: items() });
    if (action.kind !== "AJUSTE_PERCENTUAL") return;
    expect(action.total).toBe(0);
  });
});

describe("item 55 — a porta de entrada bloqueia a escrita", () => {
  it("devolve null para um comando editorial", () => {
    expect(guardCommercialCommand({ instruction: "resuma este texto", items: items() })).toBeNull();
  });

  it("bloqueia um comando comercial com a acção oficial anexada", () => {
    const guard = guardCommercialCommand({ instruction: "reduza o preço em 20%", items: items() });
    expect(guard).toBeInstanceOf(CommercialActionRequired);
    expect(guard?.action.kind).toBe("AJUSTE_PERCENTUAL");
  });

  it("o erro carrega a acção, para o editor poder executá-la", () => {
    const guard = guardCommercialCommand({ instruction: "reduza o preço em 20%", items: items() });
    // Sem a acção anexada, o editor teria de recalcular — e recalcular é como o
    // número se desincroniza do contrato.
    expect(guard?.action).toBeDefined();
  });
});

describe("item 55 — verificação da saída da IA", () => {
  const authoritative = () =>
    authoritativeValues({
      items: items(),
      totals: { contractedSubtotal: 15000, optionalSubtotal: 0, adjustment: 0, total: 15000 },
    });

  it("apanha o número inventado num comando editorial", () => {
    // O caso que a classificação NÃO apanha: o comando não falava de preço.
    const drifts = findCommercialDrift({
      before: "Um projeto pensado para durar.",
      after: "Um projeto pensado para durar. Investimento: R$ 36.000.",
      authoritative: authoritative(),
    });
    expect(drifts).toHaveLength(1);
    expect(drifts[0].found).toBe("36000");
  });

  it("aceita um valor que já estava — repetir não é deriva", () => {
    const drifts = findCommercialDrift({
      before: "Investimento: R$ 36.000.",
      after: "Investimento: R$ 36.000. Um valor transparente.",
      authoritative: authoritative(),
    });
    expect(drifts).toHaveLength(0);
  });

  it("aceita um valor que bate com a fonte comercial", () => {
    // 15 000 é o total real: citar o total verdadeiro não é invenção.
    const drifts = findCommercialDrift({
      before: "Escopo detalhado.",
      after: "Escopo detalhado. Total: R$ 15.000.",
      authoritative: authoritative(),
    });
    expect(drifts).toHaveLength(0);
  });

  it("compara 36.000 e 36000 como o mesmo número", () => {
    const drifts = findCommercialDrift({
      before: "R$ 36.000,00 no total.",
      after: "R$ 36000 no total.",
      authoritative: [],
    });
    expect(drifts).toHaveLength(0);
  });

  it("apanha uma percentagem inventada", () => {
    const drifts = findCommercialDrift({
      before: "Condições comerciais em anexo.",
      after: "Condições comerciais em anexo. Desconto de 30% já aplicado.",
      authoritative: authoritative(),
    });
    expect(drifts.length).toBeGreaterThan(0);
  });

  it("não acusa texto sem valores", () => {
    const drifts = findCommercialDrift({
      before: "Um projeto.",
      after: "Um projeto pensado para a família, com luz natural.",
      authoritative: authoritative(),
    });
    expect(drifts).toHaveLength(0);
  });
});