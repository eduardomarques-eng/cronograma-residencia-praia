/**
 * FASE 4A — Tipos de pergunta e os dois blocos estruturados centrais.
 *
 * `AnswerKind` é a lista de tipos que o enunciado exige. É uma união fechada de
 * propósito: cada tipo novo precisa de ser desenhado, validado e renderizado,
 * e "adicionar um tipo sem reescrever o briefing" significa acrescentar um
 * membro aqui e um `case` no renderizador — não abrir um buraco tipo `any`.
 *
 * `showIf` é a condicional, em forma de DADO e não de código: a pergunta diz
 * "mostra-me se a resposta a `p2_natureza` for X", e o motor avalia. Nenhum
 * `if` com o id de outra pergunta espalhado pelo código.
 */

/** Tipos de resposta suportados. */
export const ANSWER_KIND = {
  SHORT_TEXT: "SHORT_TEXT",
  LONG_TEXT: "LONG_TEXT",
  NUMBER: "NUMBER",
  MONEY: "MONEY",
  DATE: "DATE",
  PHONE: "PHONE",
  EMAIL: "EMAIL",
  BOOLEAN: "BOOLEAN",
  SINGLE_SELECT: "SINGLE_SELECT",
  MULTI_SELECT: "MULTI_SELECT",
  SCALE: "SCALE",
  SLIDER: "SLIDER",
  IMAGE_CHOICE: "IMAGE_CHOICE",
  IMAGE_UPLOAD: "IMAGE_UPLOAD",
  FILE: "FILE",
  AUDIO: "AUDIO",
  REPEAT_GROUP: "REPEAT_GROUP",
  ENVIRONMENT_GROUP: "ENVIRONMENT_GROUP",
} as const;

export type AnswerKind = (typeof ANSWER_KIND)[keyof typeof ANSWER_KIND];

/** Os tipos que guardam mais do que texto — a interface sabe o que montar. */
export const MULTIMODAL_KINDS: readonly AnswerKind[] = [
  ANSWER_KIND.IMAGE_CHOICE,
  ANSWER_KIND.IMAGE_UPLOAD,
  ANSWER_KIND.FILE,
  ANSWER_KIND.AUDIO,
  ANSWER_KIND.REPEAT_GROUP,
  ANSWER_KIND.ENVIRONMENT_GROUP,
];

/** Uma opção de escolha simples ou múltipla. */
export type BriefingOption = {
  value: string;
  label: string;
  description?: string;
  /** Só para `IMAGE_CHOICE`: ligação à imagem persistida pelo ADMIN. */
  imageUrl?: string | null;
  altText?: string | null;
};

/** Uma opção de escala/slider com dois extremosrotulados. */
export type BriefingScale = {
  min: number;
  max: number;
  /** Rótulo do extremo esquerdo — "Mais aberto". */
  leftLabel: string;
  /** Rótulo do extremo direito — "Mais reservado". */
  rightLabel: string;
};

/**
 * Condicional declarada. `questionId` responde com `equals`/`includes`;
 * `notAnswered` cobre "ainda não sei", que precisa de ser distinto de "não".
 */
export type BriefingCondition =
  | { questionId: string; kind: "equals"; value: string }
  | { questionId: string; kind: "includes"; value: string }
  | { questionId: string; kind: "answered" }
  | { questionId: string; kind: "notAnswered" }
  /**
   * Existe um ambiente com este nome no programa de necessidades.
   *
   * Condição própria e não um `includes` genérico porque o programa guarda
   * registos estruturados (nome, área, função) e não valores de escolha: o
   * cliente não marca "Sala" numa lista, escreve "Sala de estar" num cartão.
   */
  | { questionId: string; kind: "hasEnvironmentNamed"; value: string };

export type BriefingQuestion = {
  id: string;
  type: AnswerKind;
  text: string;
  hint?: string;
  /** Ajuda adicional para um campo de resposta livre. */
  placeholder?: string;
  required?: boolean;
  options?: BriefingOption[];
  visualOptions?: BriefingOption[];
  scale?: BriefingScale;
  /** Todas as condições têm de ser verdadeiras para a pergunta aparecer. */
  showIf?: BriefingCondition[];
  /** Pergunta a que a resposta de upload se liga, para a referência ter origem. */
  referenceCategory?: string;
  /**
   * Perguntas cujo texto é preferível não mostrar depois de respondidas de forma
   * satisfatória. Nunca esconde uma pergunta respondida — só evita repetir.
   */
  collapsible?: boolean;
};

export type BriefingSection = {
  id: string;
  /** Número da etapa, como no enunciado (01 a 22). */
  step: number;
  title: string;
  summary: string;
  questions: BriefingQuestion[];
};

/* ------------------------------------------------------------------ */
/* Programa de necessidades                                            */
/* ------------------------------------------------------------------ */

/** Ambientes de referência. NÃO é um enum do banco: o cliente pode escrever
 *  qualquer ambiente, e o sistema apenas sugere o que é comum. */
export const COMMON_ROOMS = [
  "Sala",
  "Cozinha",
  "Área de serviço",
  "Banheiro",
  "Dormitório",
  "Home office",
  "Varanda",
  "Garagem",
  "Jardim",
  "Escritório",
] as const;

/** Como o ambiente se relaciona com o resto da casa. */
export const ENVIRONMENT_INTEGRATION = {
  OPEN: "Aberto / integrado",
  PARTIAL: "Parcialmente integrado",
  CLOSED: "Fechado / independente",
} as const;

/** Frequência de uso declarada — alimenta o programa, não decide nada sozinho. */
export const USAGE_FREQUENCY = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  OCCASIONAL: "Ocasional",
  SEASONAL: "Sazonal",
} as const;

/**
 * Um ambiente do programa de necessidades.
 *
 * `id` é gerado pelo cliente e persiste na resposta — sem ele não há como
 * editar, relacionar ou apontar uma referência visual para um ambiente.
 */
export type BriefingEnvironment = {
  id: string;
  /** Nome livre: o cliente escreve o que precisa, o sistema não restringe. */
  name: string;
  quantity?: number | null;
  priority?: string | null;
  mandatory?: boolean | null;
  desiredArea?: number | null;
  users?: string | null;
  purpose?: string | null;
  frequency?: string | null;
  usagePeriod?: string | null;
  privacyNeeded?: boolean | null;
  storageNeeded?: string | null;
  naturalLightNeeded?: boolean | null;
  ventilationNeeded?: boolean | null;
  furniture?: string | null;
  integration?: string | null;
  specialRequirements?: string | null;
  notes?: string | null;
  /** Atributos específicos do ambiente, indexados pelo tipo. */
  attributes?: Record<string, string | number | boolean | null> | null;
};

/**
 * Relação entre dois ambientes.
 *
 * Guarda os dois lados por id (e não os nomes) para sobreviver a uma
 * renomeação do ambiente, e guarda a relación como dado — não como decisão de
 * planta. A organização espacial é trabalho da Fase 4B.
 */
export type BriefingEnvironmentRelation = {
  id: string;
  fromEnvironmentId: string;
  toEnvironmentId: string;
  /** Quanto quer estes dois ambientes perto um do outro. */
  proximity?: string | null;
  integration?: string | null;
  priority?: string | null;
  notes?: string | null;
};