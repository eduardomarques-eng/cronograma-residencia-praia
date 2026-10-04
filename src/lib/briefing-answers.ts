/**
 * FASE 4A — Modelo das RESPOSTAS do briefing.
 *
 * Antes: `Briefing.responses` era um `Json` livre, sem forma. Qualquer ecrã que
 * quisesse saber o que uma resposta significava tinha de adivinhar pelo tipo de
 * JavaScript — e a auditoria encontrou páginas inteiras a fazer exactamente
 * isso (`guided-briefing.tsx`, `answerText`).
 *
 * Agora o valor de cada pergunta tem uma forma declarada, e este módulo é o
 * ÚNICO sítio que sabe dizer:
 *   · se uma resposta foi dada (`hasAnswer`);
 *   · como se mostra em texto simples para a revisão (`formatAnswer`).
 *
 * É domínio puro: sem banco, sem React, sem rede. Testável por construção.
 */

/** Como a resposta foi registada — a distinção que a Fase 4B precisa. */
export const ANSWER_SOURCE = {
  /** O cliente respondeu. É a fonte de verdade. */
  CLIENT: "CLIENT",
  /** Derivado de outra resposta (por exemplo, ambientes criados a partir de "sim"). */
  DERIVED: "DERIVED",
  /** Sugestão do sistema. NUNCA é tratada como facto confirmado. */
  INFERENCE: "INFERENCE",
} as const;

export type AnswerSource = (typeof ANSWER_SOURCE)[keyof typeof ANSWER_SOURCE];

/** Como o cliente se relaciona com o imóvel — decide o que perguntar a seguir. */
export const CLIENT_RELATION = {
  OWNER: "Proprietário",
  BUYER: "Comprador",
  TENANT: "Locatário",
  INVESTOR: "Investidor",
  OTHER: "Outro",
} as const;

/** Prioridade declarada pelo cliente sobre cada item. */
export const PRIORITY_LEVEL = {
  ESSENTIAL: "Essencial",
  IMPORTANT: "Importante",
  DESEJAVEL: "Desejável",
  OPTIONAL: "Opcional",
  ADIAVEL: "Adiável",
} as const;

export type PriorityLevel = (typeof PRIORITY_LEVEL)[keyof typeof PRIORITY_LEVEL];

/**
 * Valor guardado para uma pergunta.
 *
 * Deliberadamente NÃO é uma união discriminada: o conteúdo de um ambiente, de
 * uma referência ou de uma nota de áudio varia demasiado para caber num tipo
 * fixo, e um tipo fixo obrigaria a mudar a base sempre que o briefing cresce.
 * O que é fixo — e o que a Fase 4B precisa — são o TEXTO validado, a origem e
 * o momento.
 */
export type BriefingAnswerValue = {
  /** Valor principal, já validado contra o tipo da pergunta. */
  value: unknown;
  /** Quem registrou. `INFERENCE` nunca substitui `CLIENT`. */
  source: AnswerSource;
  updatedAt: string;
  /** Nota do profissional. Não altera a resposta do cliente. */
  professionalNote?: string | null;
};

export type StoredAnswers = Record<string, BriefingAnswerValue>;

/**
 * Envelope guardado em `Briefing.responses`.
/**
 * Lê o que está guardado, seja do formato actual ou do legado.
 *
 * O legado era `{ "p1_quem": "texto", "p2_plantas": ["a", "b"] }`. Cada valor
 * passa a `CLIENT` com a data de modificação do próprio briefing, porque é o
 * único momento que se sabe — inventar "agora" seria inventar informação.
 */
export function readAnswers(
  raw: unknown,
  fallbackUpdatedAt: string | null = null,
): StoredAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;

  if (
    typeof record.v === "number" &&
    record.v >= 2 &&
    record.answers &&
    typeof record.answers === "object" &&
    !Array.isArray(record.answers)
  ) {
    return record.answers as StoredAnswers;
  }

  const legacy: StoredAnswers = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    legacy[key] = { value, source: ANSWER_SOURCE.CLIENT, updatedAt: fallbackUpdatedAt ?? "" };
  }
  return legacy;
}

/** Serializa no formato actual. Só isto é gravado na base. */
export function writeAnswers(answers: StoredAnswers, updatedAt: string): AnswersEnvelope {
  return { v: ANSWERS_FORMAT_VERSION, updatedAt, answers };
}

/** Resposta crua de uma pergunta (sem metadados). */
export function rawAnswer(answers: StoredAnswers, questionId: string): unknown {
  const entry = answers[questionId];
  if (!entry || entry.source === ANSWER_SOURCE.INFERENCE) return undefined;
  return entry.value;
}

/**
 * Uma resposta existe?
 *
 * A regra é "tem conteúdo", não "a chave existe": um `""`, um `[]` e um
 * `{ valor: "" }` são respostas vazias. Progresso que conta chaves vazias é
 * progresso que mente ao cliente.
 */
export function hasAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  // `false` É uma resposta: o cliente respondeu "Não". Devolver o próprio booleano
  // fazia "Nenhum animal" e "Prefiro não ter carro" contarem como vazios.
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Uma referência conta quando tem identificador; um ambiente conta quando
    // tem nome ou função preenchida.
    if (typeof record.id === "string" && record.id.trim()) return true;
    return Object.entries(record)
      .filter(([key]) => key !== "id")
      .some(([, item]) => hasAnswer(item));
  }
  return false;
}

/** O cliente respondeu a esta pergunta (ignorando inferências do sistema). */
export function isAnswered(answers: StoredAnswers, questionId: string): boolean {
  return hasAnswer(rawAnswer(answers, questionId));
}

/**
 * Representação textual de uma resposta, para a revisão e para a consolidação.
 *
 * Uma caixa de "Revise antes de enviar" que só diz "12 respostas" não deixa
 * confirmar nada: tem de mostrar o que a pessoa escolheu.
 */
export function formatAnswer(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.map(formatAnswer).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["label", "title", "name", "text", "value"]) {
      const item = record[key];
      if (typeof item === "string" && item.trim()) return item.trim();
    }
    return Object.entries(record)
      .filter(([key]) => key !== "id")
      .map(([key, item]) => `${key}: ${formatAnswer(item)}`)
      .filter((line) => !line.endsWith(": "))
      .join(" · ");
  }
  return String(value);
}

/**
 * Envelope guardado em `Briefing.responses`.
 *
 * Porquê um envelope e não o mapa cru como estava até agora: ao evoluir o
 * formato é preciso saber ler o que já lá está. O `v` diz qual a geração, e
 * `readAnswers` converte o formato antigo (`id -> valor`) sem perder resposta.
 */
export type AnswersEnvelope = {
  v: 2;
  updatedAt: string | null;
  answers: StoredAnswers;
};

export const ANSWERS_FORMAT_VERSION = 2;
