/**
 * FASE 4A — Consolidação do briefing.
 *
 * É o contrato com a Fase 4B. Recebe o que está REALMENTE guardado e devolve
 * uma visão única, sem texto inventado: cada campo ou vem de uma resposta ou
 * fica nulo. A consolidação não decide, não completa e não suaviza — só
 * organiza.
 *
 * Regra que atravessa o módulo: o que o cliente RESPONDEU é facto; o que o
 * sistema SUGERE é `INFERENCE` e está sempre marcado. Uma consolidação que
 * misturasse os dois ensinaria o profissional a trabalhar sobre dados que
 * ninguém confirmou.
 */
import { formatAnswer, isAnswered, rawAnswer, type StoredAnswers } from "./briefing-answers";
import { meetsAll } from "./briefing-conditions";
import { computeBriefingProgress, type BriefingProgress } from "./briefing-progress";
import type {
  BriefingEnvironment,
  BriefingEnvironmentRelation,
  BriefingQuestion,
  BriefingSection,
} from "./briefing-schema";

export type BriefingReference = {
  id: string;
  category: string;
  fileName: string | null;
  /** O que o cliente diz que gosta. */
  likes: string | null;
  /** O que o cliente diz que NÃO gosta. Evita ler a imagem inteira como "sim". */
  dislikes: string | null;
  selected: boolean;
  discarded: boolean;
  /** Observação do profissional. Não altera a resposta do cliente. */
  professionalNote: string | null;
};

export type BriefingConflict = {
  id: string;
  severity: "warning" | "info";
  title: string;
  detail: string;
  /** Perguntas envolvidas, para o profissional saltar para lá. */
  questionIds: string[];
};

export type BriefingReadiness = {
  /**
   * Coerente com a arquitectura actual: NÃO é um estado novo na base.
   * `BriefingStatus` continua DRAFT/FINALIZED; isto é um indicador calculado.
   */
  ready: boolean;
  blockers: string[];
  /** O que ajuda mas não bloqueia. */
  advisories: string[];
};

export type BriefingConsolidation = {
  progress: BriefingProgress;
  readiness: BriefingReadiness;
  conflicts: BriefingConflict[];
  sections: {
    id: string;
    step: number;
    title: string;
    answered: { questionId: string; text: string; label: string; source: string }[];
    pendingRequired: string[];
  }[];
  /** Blocos estruturados que a Fase 4B consome directamente. */
  program: BriefingEnvironment[];
  relations: BriefingEnvironmentRelation[];
  users: Record<string, unknown>[];
  itemsToKeep: Record<string, unknown>[];
  technicalNeeds: Record<string, unknown>[];
  restrictions: Record<string, unknown>[];
  accessibility: Record<string, unknown>[];
  references: BriefingReference[];
  budget: { amount: number | null; range: string | null };
  deadline: { hasDeadline: boolean | null; date: string | null; reason: string | null; flexibility: string | null };
  services: string[];
  pendingDocuments: string | null;
};

export const BRIEFING_ID = {
  PROGRAM: "p3_ambientes",
  RELATIONS: "p3_relacoes",
  USERS: "p1_quem",
  ITEMS_KEEP: "p4_itens_manter",
  TECHNICAL: "p15_tecnicas",
  RESTRICTIONS: "p16_restricoes",
  ACCESSIBILITY: "p16_requisitos",
  BUDGET: "p10_orcamento",
  BUDGET_RANGE: "p17_faixa",
  DEADLINE_HAS: "p18_tem_prazo",
  DEADLINE_DATE: "p18_data",
  DEADLINE_REASON: "p18_motivo",
  DEADLINE_FLEX: "p18_flexibilidade",
  SERVICES: "p19_servicos",
  MISSING_DOCS: "p20_faltando",
  NATURE: "p2_natureza",
  DISTRIBUTION: "p3_distribuicao",
} as const;

/** Lê um grupo repetível como lista de registos, ignorando lixo guardado. */
function readGroup(answers: StoredAnswers, questionId: string): Record<string, unknown>[] {
  const value = rawAnswer(answers, questionId);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function readEnvironments(answers: StoredAnswers): BriefingEnvironment[] {
  return readGroup(answers, BRIEFING_ID.PROGRAM)
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id : `amb-${index}`,
      name: typeof item.name === "string" ? item.name.trim() : "",
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      priority: typeof item.priority === "string" ? item.priority : null,
      mandatory: typeof item.mandatory === "boolean" ? item.mandatory : null,
      desiredArea: typeof item.desiredArea === "number" ? item.desiredArea : null,
      users: typeof item.users === "string" ? item.users : null,
      purpose: typeof item.purpose === "string" ? item.purpose : null,
      frequency: typeof item.frequency === "string" ? item.frequency : null,
      usagePeriod: typeof item.usagePeriod === "string" ? item.usagePeriod : null,
      privacyNeeded: typeof item.privacyNeeded === "boolean" ? item.privacyNeeded : null,
      storageNeeded: typeof item.storageNeeded === "string" ? item.storageNeeded : null,
      naturalLightNeeded: typeof item.naturalLightNeeded === "boolean" ? item.naturalLightNeeded : null,
      ventilationNeeded: typeof item.ventilationNeeded === "boolean" ? item.ventilationNeeded : null,
      furniture: typeof item.furniture === "string" ? item.furniture : null,
      integration: typeof item.integration === "string" ? item.integration : null,
      specialRequirements: typeof item.specialRequirements === "string" ? item.specialRequirements : null,
      notes: typeof item.notes === "string" ? item.notes : null,
      attributes:
        item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
          ? (item.attributes as BriefingEnvironment["attributes"])
          : null,
    }))
    .filter((environment) => environment.name.length > 0);
}

function readRelations(
  answers: StoredAnswers,
  environments: BriefingEnvironment[],
): BriefingEnvironmentRelation[] {
  const known = new Set(environments.map((environment) => environment.id));
  return readGroup(answers, BRIEFING_ID.RELATIONS)
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id : `rel-${index}`,
      fromEnvironmentId: typeof item.fromEnvironmentId === "string" ? item.fromEnvironmentId : "",
      toEnvironmentId: typeof item.toEnvironmentId === "string" ? item.toEnvironmentId : "",
      proximity: typeof item.proximity === "string" ? item.proximity : null,
      integration: typeof item.integration === "string" ? item.integration : null,
      priority: typeof item.priority === "string" ? item.priority : null,
      notes: typeof item.notes === "string" ? item.notes : null,
    }))
    // Uma relação para um ambiente que deixou de existir não é informação, é
    // lixo. Não a passa para a Fase 4B.
    .filter(
      (relation) => known.has(relation.fromEnvironmentId) && known.has(relation.toEnvironmentId),
    );
}

/**
 * Inconsistências que o sistema APONTA mas nunca corrige.
 *
 * O enunciante é explícito: mostrar "possível inconsistência" e deixar a revisão
 * ao humano. Um sistema que decide sozinho que o cliente se enganou apaga a
 * única coisa que ele disse.
 */
function detectConflicts(
  answers: StoredAnswers,
  program: BriefingEnvironment[],
  references: BriefingReference[],
): BriefingConflict[] {
  const conflicts: BriefingConflict[] = [];

  const distribution = formatAnswer(rawAnswer(answers, BRIEFING_ID.DISTRIBUTION));
  const cozinha = program.find((environment) => environment.name.toLowerCase().includes("cozinha"));
  if (
    cozinha?.integration &&
    /abert|integrad/i.test(cozinha.integration) &&
    /n[aã]o (quero|gosto).*(integr|abr)/i.test(distribution)
  ) {
    conflicts.push({
      id: "integracao-ambientes",
      severity: "warning",
      title: "Integração dos ambientes",
      detail:
        "A cozinha foi marcada como integrada e a resposta sobre distribuição pede separação. Pode ser só uma preferência, mas convém confirmar.",
      questionIds: [BRIEFING_ID.DISTRIBUTION, BRIEFING_ID.PROGRAM],
    });
  }

  if (references.filter((reference) => reference.likes && reference.dislikes).length > 1) {
    conflicts.push({
      id: "referencias-contrarias",
      severity: "info",
      title: "Referências com gostos e desgostos em simultâneo",
      detail:
        "Há mais de uma referência com o que gosta e o que não gosta preenchidos. Vale confirmar qual é a referência que manda.",
      questionIds: [],
    });
  }

  const budgetRange = formatAnswer(rawAnswer(answers, BRIEFING_ID.BUDGET_RANGE));
  if (/não tenho ideia/i.test(budgetRange) && program.length >= 6) {
    conflicts.push({
      id: "orcamento-programa",
      severity: "warning",
      title: "Orçamento em aberto com programa extenso",
detail:
        "O orçamento ainda não está definido e o programa tem seis ou mais ambientes. Vale alinhar o programa ou fechar a faixa antes de orçar.",
      questionIds: [BRIEFING_ID.BUDGET_RANGE, BRIEFING_ID.PROGRAM],
    });
  }

  if (
    rawAnswer(answers, BRIEFING_ID.DEADLINE_HAS) === true &&
    !isAnswered(answers, BRIEFING_ID.DEADLINE_DATE)
  ) {
    conflicts.push({
      id: "prazo-sem-data",
      severity: "info",
      title: "Prazo indicado sem data",
      detail: "O cliente disse que existe uma data desejada, mas não a indicou.",
      questionIds: [BRIEFING_ID.DEADLINE_DATE],
    });
  }

  return conflicts;
}

/**
 * Critérios para a Fase 4B poder começar a trabalhar.
 *
 * O enunciante é claro: o sistema NÃO pode bloquear o profissional só porque
 * uma pergunta opcional está vazia. Bloqueia pelo que é mesmo estrutural — o
 * programa de necessidades e as obrigatórias que se aplicam a este cliente.
 */
function computeReadiness(
  answers: StoredAnswers,
  progress: BriefingProgress,
  program: BriefingEnvironment[],
  questions: readonly BriefingQuestion[],
): BriefingReadiness {
  const blockers: string[] = [];
  const advisories: string[] = [];
  const context = (questionId: string) => {
    const entry = answers[questionId];
    return entry ? entry.value : undefined;
  };

  // Uma pergunta obrigatória que não se aplica a este cliente não bloqueia.
  for (const id of progress.missingRequired) {
    const question = questions.find((candidate) => candidate.id === id);
    if (question && !meetsAll(question.showIf, context)) continue;
    blockers.push(`Pergunta obrigatória por responder: ${question?.text ?? id}`);
  }

  if (program.length === 0) blockers.push("Programa de necessidades vazio");
  if (!isAnswered(answers, BRIEFING_ID.NATURE)) advisories.push("Natureza do projeto por definir");
  if (!isAnswered(answers, BRIEFING_ID.BUDGET) && !isAnswered(answers, BRIEFING_ID.BUDGET_RANGE)) {
    advisories.push("Orçamento ainda não informado");
  }
  if (!isAnswered(answers, BRIEFING_ID.SERVICES)) {
    advisories.push("Serviços pretendidos ainda não escolhidos");
  }

  return { ready: blockers.length === 0, blockers, advisories };
}

export type BuildConsolidationInput = {
  answers: StoredAnswers;
  questions: readonly BriefingQuestion[];
  sections: readonly BriefingSection[];
  /** Referências visuais já persistidas (ficheiros e opções escolhidas). */
  references?: readonly BriefingReference[];
};

/** Consolida o briefing. É pura: os mesmos dados dão sempre o mesmo resultado. */
export function consolidateBriefing(input: BuildConsolidationInput): BriefingConsolidation {
  const { answers, questions, sections } = input;
  const references = [...(input.references ?? [])];
  const progress = computeBriefingProgress(answers, questions, sections);
  const program = readEnvironments(answers);
  const context = (questionId: string) => {
    const entry = answers[questionId];
    return entry ? entry.value : undefined;
  };

  return {
    progress,
    readiness: computeReadiness(answers, progress, program, questions),
    conflicts: detectConflicts(answers, program, references),
    sections: sections.map((section) => {
      const visible = section.questions.filter((question) => meetsAll(question.showIf, context));
      return {
        id: section.id,
        step: section.step,
        title: section.title,
        answered: visible
          .filter((question) => isAnswered(answers, question.id))
          .map((question) => {
            const entry = answers[question.id];
            return {
              questionId: question.id,
              text: formatAnswer(entry?.value),
              label: question.text,
              source: entry?.source ?? "CLIENT",
            };
          }),
        pendingRequired: visible
          .filter((question) => question.required && !isAnswered(answers, question.id))
          .map((question) => question.id),
      };
    }),
    program,
    relations: readRelations(answers, program),
    users: readGroup(answers, BRIEFING_ID.USERS),
    itemsToKeep: readGroup(answers, BRIEFING_ID.ITEMS_KEEP),
    technicalNeeds: readGroup(answers, BRIEFING_ID.TECHNICAL),
    restrictions: readGroup(answers, BRIEFING_ID.RESTRICTIONS),
    accessibility: readGroup(answers, BRIEFING_ID.ACCESSIBILITY),
    references,
    budget: {
      amount:
        typeof rawAnswer(answers, BRIEFING_ID.BUDGET) === "number"
          ? (rawAnswer(answers, BRIEFING_ID.BUDGET) as number)
          : null,
      range: isAnswered(answers, BRIEFING_ID.BUDGET_RANGE)
        ? formatAnswer(rawAnswer(answers, BRIEFING_ID.BUDGET_RANGE))
        : null,
    },
    deadline: {
      hasDeadline:
        typeof rawAnswer(answers, BRIEFING_ID.DEADLINE_HAS) === "boolean"
          ? (rawAnswer(answers, BRIEFING_ID.DEADLINE_HAS) as boolean)
          : null,
      date: isAnswered(answers, BRIEFING_ID.DEADLINE_DATE)
        ? formatAnswer(rawAnswer(answers, BRIEFING_ID.DEADLINE_DATE))
        : null,
      reason: isAnswered(answers, BRIEFING_ID.DEADLINE_REASON)
        ? formatAnswer(rawAnswer(answers, BRIEFING_ID.DEADLINE_REASON))
        : null,
      flexibility: isAnswered(answers, BRIEFING_ID.DEADLINE_FLEX)
        ? formatAnswer(rawAnswer(answers, BRIEFING_ID.DEADLINE_FLEX))
        : null,
    },
    services: Array.isArray(rawAnswer(answers, BRIEFING_ID.SERVICES))
      ? (rawAnswer(answers, BRIEFING_ID.SERVICES) as unknown[]).map((item) => String(item))
      : [],
    pendingDocuments: isAnswered(answers, BRIEFING_ID.MISSING_DOCS)
      ? formatAnswer(rawAnswer(answers, BRIEFING_ID.MISSING_DOCS))
      : null,
  };
}

/** Rótulo legível de uma opção, para a revisão mostrar o texto e não o código. */
export function optionLabel(question: BriefingQuestion, value: string): string {
  return question.options?.find((candidate) => candidate.value === value)?.label ?? value;
}
