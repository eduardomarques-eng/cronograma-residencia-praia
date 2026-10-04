/**
 * FASE 4A — Progresso real do briefing.
 *
 * A versão anterior calculava `respondidas / total`. Isso é mentira em dois
 * sentidos que o enunciante aponta: contava perguntas obrigatórias como se
 * fossem opcionais, e contava perguntas que nem se aplicam a este cliente.
 * Um cliente sem cachorro vê "p1_animais_detalhe" como pendente para sempre.
 *
 * Aqui o progresso responde a três perguntas distintas:
 *   · obrigatório pendente  — bloqueia o "pronto para projeto";
 *   · obrigatório respondido — o que o estúdio precisa;
 *   · opcional pendente   — informative, não bloqueia.
 * E o resultado só considera perguntas APLICÁVEIS a este cliente.
 */
import { meetsAll } from "./briefing-conditions";
import { isAnswered, type StoredAnswers } from "./briefing-answers";
import type { BriefingQuestion } from "./briefing-schema";

export type BriefingProgress = {
  /** 0-100 sobre as perguntas aplicáveis. */
  percent: number;
  applicable: number;
  requiredApplicable: number;
  requiredAnswered: number;
  requiredPending: number;
  optionalApplicable: number;
  optionalAnswered: number;
  optionalPending: number;
  /** Perguntas que hoje não se aplicam e por isso não contam. */
  notApplicable: number;
  /** Perguntas obrigatórias ainda em falta, para a interface apontar. */
  missingRequired: string[];
  /** Cada etapa com o seu próprio progresso. */
  sections: {
    id: string;
    step: number;
    title: string;
    percent: number;
    applicable: number;
    requiredPending: number;
  }[];
};

/** Contexto de respostas para avaliar condições. */
function contextOf(answers: StoredAnswers) {
  return (questionId: string) => {
    const entry = answers[questionId];
    return entry ? entry.value : undefined;
  };
}

/**
 * Calcula o progresso.
 *
 * Determinístico e sem I/O: a mesma resposta dá sempre o mesmo número, o que o
 * torna testável e permite ao cliente ver o número mexer só quando responde.
 */
export function computeBriefingProgress(
  answers: StoredAnswers,
  questions: readonly BriefingQuestion[],
  sections: readonly { id: string; step: number; title: string; questions: readonly BriefingQuestion[] }[],
): BriefingProgress {
  const context = contextOf(answers);

  const applicable = questions.filter((question) => meetsAll(question.showIf, context));
  const notApplicable = questions.length - applicable.length;

  const required = applicable.filter((question) => question.required);
  const optional = applicable.filter((question) => !question.required);

  const requiredAnswered = required.filter((question) => isAnswered(answers, question.id)).length;
  const optionalAnswered = optional.filter((question) => isAnswered(answers, question.id)).length;

  const answered = requiredAnswered + optionalAnswered;
  const total = applicable.length;

  return {
    percent: total > 0 ? Math.round((answered / total) * 100) : 0,
    applicable: total,
    requiredApplicable: required.length,
    requiredAnswered,
    requiredPending: required.length - requiredAnswered,
    optionalApplicable: optional.length,
    optionalAnswered,
    optionalPending: optional.length - optionalAnswered,
    notApplicable,
    missingRequired: required
      .filter((question) => !isAnswered(answers, question.id))
      .map((question) => question.id),
    sections: sections.map((section) => {
      const visiveis = section.questions.filter((question) => meetsAll(question.showIf, context));
      const respondidas = visiveis.filter((question) => isAnswered(answers, question.id)).length;
      return {
        id: section.id,
        step: section.step,
        title: section.title,
        percent: visiveis.length > 0 ? Math.round((respondidas / visiveis.length) * 100) : 100,
        applicable: visiveis.length,
        requiredPending: visiveis.filter(
          (question) => question.required && !isAnswered(answers, question.id),
        ).length,
      };
    }),
  };
}