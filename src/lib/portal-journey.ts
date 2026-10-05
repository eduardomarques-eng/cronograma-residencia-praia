/**
 * FASE 5 — A JORNADA DO CLIENTE (modelo puro).
 *
 * O problema que este módulo resolve não é de dados: é de **percepção**. O
 * cliente entra no portal e vê coisas — um projeto, um briefing, uma proposta,
 * um contrato — como se fossem módulos separados. A jornada não é uma lista de
 * ecrãs; é a resposta a "o que é que eu tenho de fazer a seguir, e o que já
 * está feito".
 *
 * Duas regras estruturais:
 *
 *  1. **Não inventar estados.** Cada passo traduz os enums REAIS do banco
 *     (`BriefingStatus`, `ProposalStatus`, `ContractStatus`, `SignatureStatus`).
 *     Não existe um estado "a rever" inventado porque o esquema não o tem. Um
 *     estado que o banco não conhece é um estado que a interface não consegue
 *     cumprir — e o cliente fica à espera de algo que ninguém está a fazer.
 *
 *  2. **Um passo não nasce sem acção.** `acao` diz o que o cliente pode fazer;
 *     um passo sem acção é um ponto morto, e um ponto morto sem explicação é a
 *     pior coisa que um portal pode mostrar.
 *
 * É PURO e não conhece Prisma: recebe snapshots e devolve a jornada. É isso que
 * permite testar os estados sem base de dados — e testar os estados é
 * obrigatório, porque é neles que a jornada vive ou morre.
 */

/** Os estados de UX do portal. Não são estados de negócio. */
export type UxState = "PENDENTE" | "CONCLUIDO" | "AGUARDA_CLIENTE" | "SEM_DADOS";

/** Um passo da jornada. */
export type JourneyStep = {
  /** Identificador estável, usado em links e testes. */
  key: "BRIEFING" | "CRONOGRAMA" | "PROPOSTA" | "CONTRATO" | "DOCUMENTOS";
  /** O que se lê, em português simples. */
  label: string;
  /** Uma frase que diz o estado actual. Nunca vazia. */
  resumo: string;
  /** O estado de UX deste passo. Derivado dos enums reais do banco. */
  estado: UxState;
  /** O que o cliente pode fazer a partir daqui. `null` quando não pode. */
  acao: { label: string; href: string } | null;
};

/** O retrato que a jornada lê. Vem do servidor, já autorizado. */
export type JourneySnapshot = {
  projeto: { id: string; nome: string } | null;
  /** Estado real do briefing. `null` quando ainda não existe. */
  briefing: { status: "DRAFT" | "FINALIZED"; answered: number; total: number } | null;

  /** Estado real da proposta mais recente. */
  proposta: {
    status:
      | "DRAFT"
      | "IN_REVIEW"
      | "NEGOTIATING"
      | "READY"
      | "GENERATED"
      | "SENT"
      | "VIEWED"
      | "APPROVED"
      | "REJECTED"
      | "EXPIRED"
      | "CANCELLED"
      | "CONVERTED";
    /** Link público emitido, se existir. */
    ligacao: string | null;
  } | null;

  /** Estado real do contrato. */
  contrato: {
    status: "DRAFT" | "IN_REVIEW" | "READY" | "SENT" | "VIEWED" | "SIGNED" | "CANCELLED";
    assinatura: "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "COMPLETED" | "CANCELLED" | "FAILED" | null;
  } | null;

  /** Etapas do cronograma, pelo estado real. */
  cronograma: { total: number; concluidas: number; proxima: { label: string; percentagem: number } | null } | null;

  /** Documentos liberados para o cliente. */
  documentos: { total: number; maisRecente: { nome: string; em: string } | null };
};

/* -------------------------------------------------------------------------- */
/* TRADUCAO DE ESTADOS                                                        */
/* -------------------------------------------------------------------------- */

/**
 * O que um estado do briefing significa para o cliente.
 *
 * `DRAFT` com respostas incompletas e a diferenca entre "faltam coisas" e "esta
 * pronto". Sem esta distincao o cliente ve um ecra morto e não sabe se o
 * escritório esta a precisar dele.
 */
function passoBriefing(snapshot: JourneySnapshot): JourneyStep {
  const briefing = snapshot.briefing;
  const href = `/portal/${snapshot.projeto?.id ?? ""}/briefing`;

  if (!briefing) {
    return { key: "BRIEFING", label: "Briefing", resumo: "O escritório ainda não abriu o questionário. Não precisa de fazer nada para já.", estado: "SEM_DADOS", acao: null };
  }

  if (briefing.status === "FINALIZED") {
    // Continua legível depois de concluído: fechar o acesso ao que o cliente
    // ja respondeu seria esconder o registo do proprio cliente.
    return { key: "BRIEFING", label: "Briefing", resumo: "Concluído. As suas respostas estão com o escritório.", estado: "CONCLUIDO", acao: { label: "Ver respostas", href } };
  }

  const faltam = briefing.total - briefing.answered;
  return {
    key: "BRIEFING",
    label: "Briefing",
    resumo: faltam > 0 ? `Por responder: ${faltam} ${faltam === 1 ? "questão" : "questões"} de ${briefing.total}.` : "Tudo respondido. O escritório vai rever e confirmar.",
    estado: "AGUARDA_CLIENTE",
    acao: { label: "Continuar o briefing", href },
  };
}

/**
 * O que um estado da proposta significa.
 *
 * Os estados terminais (APPROVED, REJECTED, EXPIRED, CANCELLED) são distintos de
 * proposito: um cliente cuja proposta expirou precisa de uma acção do escritório, e
 * dizer-lhe so "não esta disponível" não diz qual.
 */
function passoProposta(snapshot: JourneySnapshot): JourneyStep {
  const proposta = snapshot.proposta;
  if (!proposta) {
    return { key: "PROPOSTA", label: "Proposta", resumo: "Ainda não ha proposta. O escritório prepara-a a partir do briefing e do escopo.", estado: "SEM_DADOS", acao: null };
  }

  const P = (resumo: string, estado: UxState, acao: { label: string; href: string } | null = null) => ({ key: "PROPOSTA" as const, label: "Proposta", resumo, estado, acao });

  switch (proposta.status) {
    case "APPROVED":
      return P("Aprovada. É esta versão que vai para contrato.", "CONCLUIDO");
    case "REJECTED":
      return P("Recusada. O escritório pode preparar uma nova versão.", "CONCLUIDO");
    case "CONVERTED":
      return P("Aprovada e ja convertida em contrato.", "CONCLUIDO");
    case "EXPIRED":
      return P("Expirou a validade. Peça ao escritório uma versão actualizada.", "PENDENTE");
    case "CANCELLED":
      return P("Cancelada. Fale com o escritório para saber o próximo passo.", "PENDENTE");
    case "DRAFT":
      return P("Em preparação pelo escritório. Ainda não esta pronta para ler.", "PENDENTE");
    case "GENERATED":
      return P("Gerada. Aguarda revisão do escritório antes de ser enviada.", "PENDENTE");
    case "IN_REVIEW":
      return P("Em revisão interna. Não precisa de fazer nada.", "PENDENTE");
    case "READY":
      return P("Pronta, mas ainda não foi enviada.", "PENDENTE");
    case "NEGOTIATING":
      return P("Em negociação — pediu alterações. O escritório responde numa nova versão.", "AGUARDA_CLIENTE");
    case "SENT":
    case "VIEWED": {
      // VIEWED quer dizer que o cliente JA ABRIU. Dizer "por ler" a quem leu e
      // o erro que faz uma pessoa deixar de confiar no portal.
      const lido = proposta.status === "VIEWED";
      // Sem link emitido não ha botão: um botão que abre uma pagina inexistente
      // e pior do que nenhum.
      const acao = proposta.ligacao ? { label: "Abrir proposta", href: proposta.ligacao } : null;
      return P(lido ? "Já consultou. A decisão continua em aberto." : "Enviada para si. Abra, leia e registe a sua decisão.", "AGUARDA_CLIENTE", acao);
    }
  }
}

/** O que um estado do contrato e da assinatura significa. */
function passoContrato(snapshot: JourneySnapshot): JourneyStep {
  const contrato = snapshot.contrato;
  const voltar = `/portal/${snapshot.projeto?.id ?? ""}`;
  if (!contrato) {
    return { key: "CONTRATO", label: "Contrato", resumo: "Sem contrato. Ele nasce depois de a proposta ser aprovada.", estado: "SEM_DADOS", acao: null };
  }
  if (contrato.assinatura === "COMPLETED" || contrato.assinatura === "SIGNED" || contrato.status === "SIGNED") {
    return { key: "CONTRATO", label: "Contrato", resumo: "Assinado. Está tudo em dia.", estado: "CONCLUIDO", acao: null };
  }
  const C = (resumo: string, estado: UxState, acao: { label: string; href: string } | null = null) => ({ key: "CONTRATO" as const, label: "Contrato", resumo, estado, acao });
  switch (contrato.status) {
    case "CANCELLED":
      return C("Cancelado. Fale com o escritório.", "PENDENTE");
    case "DRAFT":
    case "IN_REVIEW":
      return C("Em preparação pelo escritório.", "PENDENTE");
    case "READY":
      return C("Pronto, ainda não enviado.", "PENDENTE");
    case "SENT":
    case "VIEWED": {
      if (contrato.assinatura === "VIEWED") {
        return C("Abriu o contrato; a assinatura continua à espera.", "AGUARDA_CLIENTE", { label: "Ver contrato", href: voltar });
      }
      // Falha de assinatura e estado seu e merece dizer-se: esconder a falha
      // deixa o cliente a espera de algo que não vai acontecer.
      if (contrato.assinatura === "FAILED") {
        return C("A assinatura não ficou registada. Contacte o escritório.", "PENDENTE", { label: "Ver contrato", href: voltar });
      }
      return C("Enviado para assinatura.", "AGUARDA_CLIENTE", { label: "Assinar contrato", href: voltar });
    }
  }
}

/** O andamento do cronograma - sempre visivel, mesmo sem etapas. */
function passoCronograma(snapshot: JourneySnapshot): JourneyStep {
  const cronograma = snapshot.cronograma;
  const voltar = `/portal/${snapshot.projeto?.id ?? ""}`;
  if (!cronograma || cronograma.total === 0) {
    return { key: "CRONOGRAMA", label: "Cronograma", resumo: "O cronograma ainda não foi publicado pelo escritório.", estado: "SEM_DADOS", acao: null };
  }
  if (cronograma.concluidas === cronograma.total) {
    return { key: "CRONOGRAMA", label: "Cronograma", resumo: `Concluído: ${cronograma.total} de ${cronograma.total} etapas.`, estado: "CONCLUIDO", acao: { label: "Ver cronograma", href: voltar } };
  }
  const percentagem = Math.round(cronograma.proxima?.percentagem ?? Math.round((cronograma.concluidas / cronograma.total) * 100));
  const resumo = cronograma.proxima
    ? `Em curso: ${cronograma.proxima.label} (${percentagem}%). ${cronograma.concluidas} de ${cronograma.total} etapas feitas.`
    : `${cronograma.concluidas} de ${cronograma.total} etapas feitas.`;
  return { key: "CRONOGRAMA", label: "Cronograma", resumo, estado: "PENDENTE", acao: { label: "Ver cronograma", href: voltar } };
}

/** Documentos: so os liberados, e o total e o que o cliente pode contar. */
function passoDocumentos(snapshot: JourneySnapshot): JourneyStep {
  const voltar = `/portal/${snapshot.projeto?.id ?? ""}`;
  const total = snapshot.documentos.total;
  if (total === 0) {
    return { key: "DOCUMENTOS", label: "Documentos", resumo: "Ainda não ha documentos liberados para si.", estado: "SEM_DADOS", acao: null };
  }
  return {
    key: "DOCUMENTOS",
    label: "Documentos",
    resumo: `${total} ${total === 1 ? "documento liberado" : "documentos liberados"} para si.`,
    estado: "CONCLUIDO",
    acao: { label: "Ver documentos", href: voltar },
  };
}

/* -------------------------------------------------------------------------- */
/* A JORNADA                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Monta a jornada completa, na ordem em que o cliente a vive.
 *
 * A ordem e a do COMERCIAL, não a do banco: briefing, cronograma, proposta,
 * contrato, documentos. O banco não tem tabela de "jornada", e não deve ter - a
 * ordem acima e uma decisão de leitura, e escreve-la no esquema transformaria
 * uma escolha de interface numa migracao.
 */
export function buildJourney(snapshot: JourneySnapshot): JourneyStep[] {
  return [
    passoBriefing(snapshot),
    passoCronograma(snapshot),
    passoProposta(snapshot),
    passoContrato(snapshot),
    passoDocumentos(snapshot),
  ];
}

/**
 * O PROXIMO PASSO: o primeiro que precisa do cliente.
 *
 * E a pergunta que o portal responde primeiro. AGUARDA_CLIENTE tem prioridade
 * sobre PENDENTE: "o escritório esta a trabalhar" e "tem de agir" não podem
 * aparecer na mesma caixa.
 */
export function nextAction(jornada: readonly JourneyStep[]): JourneyStep | null {
  return (
    jornada.find((p) => p.estado === "AGUARDA_CLIENTE" && p.acao !== null) ??
    jornada.find((p) => p.estado === "PENDENTE" && p.acao !== null) ??
    null
  );
}

/** Quantos passos estao concluidos - a medida de progresso. */
export function journeyProgress(jornada: readonly JourneyStep[]): { concluidos: number; total: number; percentagem: number } {
  // SEM_DADOS não conta como pendência: uma seccao que o escritório ainda não
  // abriu não e uma etapa em falta do cliente.
  const contaveis = jornada.filter((p) => p.estado === "CONCLUIDO" || p.estado === "AGUARDA_CLIENTE" || p.estado === "PENDENTE");
  const concluidos = jornada.filter((p) => p.estado === "CONCLUIDO").length;
  const total = contaveis.length;
  return { concluidos, total, percentagem: total ? Math.round((concluidos / total) * 100) : 0 };
}

/**
 * A linha de topo da jornada.
 *
 * Devolve sempre texto: um ecrã sem orientação e o que o item 5 proíbe.
 */
export function journeyHeadline(jornada: readonly JourneyStep[], projectName: string): string {
  const próximo = nextAction(jornada);
  if (próximo) return `Próximo passo: ${próximo.label.toLowerCase()} - ${próximo.resumo}`;
  const pendentes = jornada.filter((p) => p.estado === "PENDENTE" || p.estado === "AGUARDA_CLIENTE");
  if (pendentes.length === 0) return `${projectName} está em dia. Não tem nada pendente.`;
  return `${projectName}: o escritório está a tratar de ${pendentes[0].label.toLowerCase()}.`;
}
