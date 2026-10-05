import { describe, expect, it } from "vitest";
import { buildJourney, journeyHeadline, journeyProgress, nextAction, type JourneySnapshot } from "./portal-journey";

/** Um projeto novo: nada começou. E o estado mais comum na realidade. */
const vazio = (): JourneySnapshot => ({
  projeto: { id: "p1", nome: "Casa em Algés" },
  briefing: null,
  proposta: null,
  contrato: null,
  cronograma: null,
  documentos: { total: 0, maisRecente: null },
});

const passo = (jornada: ReturnType<typeof buildJourney>, key: string) => {
  const encontrado = jornada.find((p) => p.key === key);
  if (!encontrado) throw new Error(`passo ${key} em falta`);
  return encontrado;
};

describe("Fase 5 — nenhum ecrã fica sem orientação", () => {
  it("todo passo tem um resumo que diz algo", () => {
    // Um cartão sem texto é o defeito que o item 5 proíbe.
    for (const p of buildJourney(vazio())) {
      expect(p.resumo.length).toBeGreaterThan(10);
      expect(p.resumo.trim()).not.toBe("");
    }
  });

  it("a linha de topo nunca está vazia, mesmo sem projeto", () => {
    expect(journeyHeadline(buildJourney(vazio()), "Casa").length).toBeGreaterThan(10);
    expect(journeyHeadline(buildJourney(vazio()), "")).toBeTruthy();
  });

  it("um projeto sem nada mostra onde o cliente está", () => {
    expect(buildJourney(vazio()).every((p) => p.estado === "SEM_DADOS")).toBe(true);
  });
});

describe("Fase 5 — o briefing diz o que falta", () => {
  it("sem briefing, não há acção para o cliente", () => {
    expect(passo(buildJourney(vazio()), "BRIEFING").acao).toBeNull();
  });

  it("DRAFT por responder aponta para o que falta", () => {
    const b = passo(buildJourney({ ...vazio(), briefing: { status: "DRAFT", answered: 3, total: 7 } }), "BRIEFING");
    expect(b.estado).toBe("AGUARDA_CLIENTE");
    expect(b.resumo).toContain("4");
    expect(b.acao?.href).toBe("/portal/p1/briefing");
  });

  it("DRAFT sem falta já não diz que falta", () => {
    const b = passo(buildJourney({ ...vazio(), briefing: { status: "DRAFT", answered: 7, total: 7 } }), "BRIEFING");
    expect(b.resumo).toContain("Tudo respondido");
  });

  it("FINALIZED fica legível — o cliente vê o próprio registo", () => {
    const b = passo(buildJourney({ ...vazio(), briefing: { status: "FINALIZED", answered: 7, total: 7 } }), "BRIEFING");
    expect(b.estado).toBe("CONCLUIDO");
    expect(b.acao).not.toBeNull();
  });

  it("uma questão por responder é escrita no singular", () => {
    const b = passo(buildJourney({ ...vazio(), briefing: { status: "DRAFT", answered: 6, total: 7 } }), "BRIEFING");
    expect(b.resumo).toContain("1 questão");
  });
});

describe("Fase 5 — a proposta traduz cada estado REAL do banco", () => {
  const comProposta = (status: string, ligacao: string | null = null) =>
    buildJourney({ ...vazio(), proposta: { status: status as never, ligacao } });

  it("cada estado do enum tem um resumo — nenhum fica mudo", () => {
    for (const status of [
      "DRAFT", "GENERATED", "IN_REVIEW", "NEGOTIATING", "READY",
      "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "CONVERTED",
    ]) {
      expect(passo(comProposta(status), "PROPOSTA").resumo.length).toBeGreaterThan(10);
    }
  });

  it("SENT espera o cliente e dá o link", () => {
    const p = passo(comProposta("SENT", "/briefing-proposta/tok"), "PROPOSTA");
    expect(p.estado).toBe("AGUARDA_CLIENTE");
    expect(p.acao?.href).toBe("/briefing-proposta/tok");
  });

  it("VIEWED não volta a dizer por ler a quem já leu", () => {
    // Repetir "por ler" a quem abriu é o erro que faz uma pessoa deixar de
    // confiar no portal.
    expect(passo(comProposta("VIEWED", "/l"), "PROPOSTA").resumo).toContain("Já consultou");
  });

  it("APPROVED, REJECTED e CONVERTED estão concluídos", () => {
    for (const status of ["APPROVED", "REJECTED", "CONVERTED"]) {
      expect(passo(comProposta(status), "PROPOSTA").estado).toBe("CONCLUIDO");
    }
  });

  it("EXPIRED é pendente com o motivo", () => {
    const p = passo(comProposta("EXPIRED"), "PROPOSTA");
    expect(p.estado).toBe("PENDENTE");
    expect(p.resumo).toContain("Expirou");
  });

  it("estados de preparação não dão acção ao cliente", () => {
    for (const status of ["DRAFT", "GENERATED", "IN_REVIEW", "READY"]) {
      expect(passo(comProposta(status), "PROPOSTA").acao).toBeNull();
    }
  });

  it("NEGOTIATING diz que foi o cliente a pedir", () => {
    expect(passo(comProposta("NEGOTIATING"), "PROPOSTA").resumo).toContain("negociação");
  });

  it("sem link emitido, não há botão que não funciona", () => {
    // Um botão que abre uma página inexistente é pior do que nenhum.
    expect(passo(comProposta("SENT", null), "PROPOSTA").acao).toBeNull();
  });
});

describe("Fase 5 — contrato, assinatura, cronograma e documentos", () => {
  const comContrato = (status: string, assinatura: string | null = null) =>
    buildJourney({ ...vazio(), contrato: { status: status as never, assinatura: assinatura as never } });

  it("sem contrato, diz que ele nasce da aprovação", () => {
    const c = passo(buildJourney(vazio()), "CONTRATO");
    expect(c.estado).toBe("SEM_DADOS");
    expect(c.resumo).toContain("aprovada");
  });

  it("SENT com assinatura pendente espera o cliente", () => {
    const c = passo(comContrato("SENT", "PENDING"), "CONTRATO");
    expect(c.estado).toBe("AGUARDA_CLIENTE");
    expect(c.acao?.label).toContain("Assinar");
  });

  it("assinatura FAILED diz-se em vez de ficar em curso", () => {
    // Esconder a falha deixa o cliente à espera de algo que não vai acontecer.
    const c = passo(comContrato("SENT", "FAILED"), "CONTRATO");
    expect(c.estado).toBe("PENDENTE");
    expect(c.resumo).toContain("não ficou registada");
  });

  it("assinatura concluída encerra o contrato", () => {
    expect(passo(comContrato("SIGNED", "COMPLETED"), "CONTRATO").estado).toBe("CONCLUIDO");
  });

  it("contrato em preparação não dá acção", () => {
    for (const status of ["DRAFT", "IN_REVIEW", "READY", "CANCELLED"]) {
      expect(passo(comContrato(status), "CONTRATO").acao).toBeNull();
    }
  });

  it("cronograma sem etapas diz que ainda não foi publicado", () => {
    const c = passo(buildJourney(vazio()), "CRONOGRAMA");
    expect(c.estado).toBe("SEM_DADOS");
    expect(c.resumo).toContain("publicado");
  });

  it("cronograma em curso nomeia a etapa", () => {
    const c = passo(buildJourney({ ...vazio(), cronograma: { total: 4, concluidas: 1, proxima: { label: "Projeto", percentagem: 25 } } }), "CRONOGRAMA");
    expect(c.resumo).toContain("Projeto");
    expect(c.resumo).toContain("25%");
  });

  it("cronograma totalmente feito é concluído", () => {
    expect(passo(buildJourney({ ...vazio(), cronograma: { total: 3, concluidas: 3, proxima: null } }), "CRONOGRAMA").estado).toBe("CONCLUIDO");
  });

  it("documentos: um usa o singular, nenhum explica o vazio", () => {
    expect(passo(buildJourney(vazio()), "DOCUMENTOS").resumo).toContain("liberados");
    expect(passo(buildJourney({ ...vazio(), documentos: { total: 1, maisRecente: null } }), "DOCUMENTOS").resumo).toContain("1 documento liberado");
  });
});

describe("Fase 5 — o próximo passo e o progresso", () => {
  it("sem nada pendente, não há próximo passo", () => {
    const jornada = buildJourney({
      projeto: { id: "p1", nome: "Casa" },
      briefing: { status: "FINALIZED", answered: 5, total: 5 },
      proposta: { status: "APPROVED", ligacao: null },
      contrato: { status: "SIGNED", assinatura: "COMPLETED" },
      cronograma: { total: 2, concluidas: 2, proxima: null },
      documentos: { total: 3, maisRecente: null },
    });
    expect(nextAction(jornada)).toBeNull();
  });

  it("o que espera o cliente ganha ao que o escritório trata", () => {
    // "O escritório está a trabalhar" e "tem de agir" não são a mesma caixa.
    const jornada = buildJourney({
      ...vazio(),
      proposta: { status: "SENT", ligacao: "/l" },
      cronograma: { total: 4, concluidas: 1, proxima: { label: "Obra", percentagem: 25 } },
    });
    expect(nextAction(jornada)?.key).toBe("PROPOSTA");
  });

  it("um passo sem acção nunca é próximo passo", () => {
    // Um botão que não existe não pode ser o que pedimos ao cliente para fazer.
    expect(nextAction(buildJourney({ ...vazio(), proposta: { status: "DRAFT", ligacao: null } }))).toBeNull();
  });

  it("o que o escritório ainda não abriu não conta como falta", () => {
    // Uma secção por abrir não é uma etapa em falta do cliente.
    const p = journeyProgress(buildJourney(vazio()));
    expect(p.total).toBe(0);
    expect(p.percentagem).toBe(0);
  });

  it("conta os concluídos sobre os contáveis", () => {
    const p = journeyProgress(buildJourney({
      projeto: { id: "p1", nome: "Casa" },
      briefing: { status: "FINALIZED", answered: 5, total: 5 },
      proposta: { status: "APPROVED", ligacao: null },
      contrato: null,
      cronograma: { total: 2, concluidas: 2, proxima: null },
      documentos: { total: 0, maisRecente: null },
    }));
    expect(p.concluidos).toBe(3);
    expect(p.total).toBe(3);
    expect(p.percentagem).toBe(100);
  });

  it("a percentagem nunca passa de 100", () => {
    const p = journeyProgress(buildJourney({
      projeto: { id: "p1", nome: "Casa" },
      briefing: { status: "FINALIZED", answered: 5, total: 5 },
      proposta: { status: "APPROVED", ligacao: null },
      contrato: { status: "SIGNED", assinatura: "COMPLETED" },
      cronograma: { total: 2, concluidas: 2, proxima: null },
      documentos: { total: 1, maisRecente: null },
    }));
    expect(p.percentagem).toBeLessThanOrEqual(100);
  });
});
