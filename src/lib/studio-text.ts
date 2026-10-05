/**
 * FASE 4C — OPERAÇÕES DE TEXTO (item 18).
 *
 * Este módulo separa "pedir à IA para melhorar o texto" de "ter um editor que
 * sabe o que perguntar". A regra central do item 18 é `PRESERVE`: quando o
 * ADMIN pede preservação literal, NENHUMA palavra muda.
 *
 * A divisão é deliberada:
 *
 *  · **Transformações estruturais** (resumir, listar, paragrafar) são funções
 *    puras e determinísticas implementadas AQUI. Não precisam de provider, não
 *    inventam e são testáveis.
 *  · **Reescrita de linguagem** (mais comercial, mais técnico) precisa de um
 *    modelo. É o ÚNICO ponto que chama o provider — e valida o que ele devolve
 *    antes de deixar entrar.
 *
 * Esta separação é o que permite ao Studio funcionar sem nenhuma chave de API
 * configurada, sem fingir que "melhorou" texto que não mudou.
 */

export type TextIntent =
  | "PRESERVE"
  | "IMPROVE"
  | "REWRITE"
  | "SHORTEN"
  | "EXPAND"
  | "COMMERCIAL"
  | "TECHNICAL"
  | "SOPHISTICATED"
  | "SIMPLIFY"
  | "FIX_PT"
  | "TO_LIST"
  | "TO_CARDS"
  | "TRANSLATE";

/**
 * A lista de intenções que o editor mostra é derivada de `planText`, mais
 * abaixo. Houve aqui uma lista paralela de rótulos, e duas listas de intenções
 * divergem na primeira alteração a um rótulo — o editor passava a oferecer
 * "Simplificar" com a ajuda de outra intenção.
 */

const FRAGMENT_TAG = /^[-–—*•]\s*/;

/**
 * Valores comerciais: dinheiro, prazo, área ou quantidade seguida de unidade.
 *
 * Não basta apanhar `R$`: um modelo que "melhora" "o serviço demora pouco" para
 * "o serviço demora 45 dias" inventou um PRAZO — e um prazo inventado é uma
 * promessa que o estúdio nunca fez. A regra do item 5 é sobre dados comerciais,
 * não só sobre os que têm cifrão.
 */
const MONEY = /(?:r\$\s*\d|€\s*\d|\d[\d.]*\s*(?:reais|euros|eur|usd))/i;

/** Prazo, área, quantidade ou percentagem — a mesma regra, outras unidades. */
const COMMITMENT = /\d[\d.,]*\s*(?:dias?|semanas?|meses|anos?|m²|m2|mil\s?m2|metros?|unidades?|ambientes?|%)/i;

/** Qualquer número com unidade comercial. */
const COMMERCIAL_NUMBER = new RegExp(`${MONEY.source}|${COMMITMENT.source}`, "i");

/**
 * Divide texto em frases.
 *
 * Não é divisão naïf por ponto: `1.2.500` e `R$ 45.000,00` partem-se com a
 * naïf e produzem fragmentos sem sentido. Um valor comercial partido a meio
 * lê-se como uma proposta com dois números, que é exactamente o defeito que
 * este módulo existe para evitar.
 */
export function splitSentences(text: string): string[] {
  // Protege os separadores numéricos antes de partir, e restaura depois.
  // Sem isto, "R$ 45.000,00" viraria duas frases e o valor apareceria partido.
  const marks: string[] = [];
  const guarded = text.replace(/\d[\d.,]*\d/g, (match) => {
    marks.push(match);
    return `\u0000${marks.length - 1}\u0000`;
  });

  return guarded
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) =>
      sentence.replace(/\u0000(\d+)\u0000/g, (_, index: string) => marks[Number(index)] ?? ""),
    );
}

/** Divide texto em linhas de lista, removendo marcadores já existentes. */
export function splitList(text: string): string[] {
  return text
    .split(/\r?\n|\s*;\s*/)
    .map((line) => line.replace(FRAGMENT_TAG, "").trim())
    .filter(Boolean);
}

/** Número de palavras. Mede se um texto "excede" o que cabe. */
export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * TETO DE PALAVRAS por função de texto numa página.
 *
 * Não é uma regra estética arbitrária: é o ponto em que o texto deixa de caber
 * na área da página sem ficar ilegível. O "Melhorar layout" usa este número
 * para decidir se o texto EXCESSO precisa de ir para outro elemento.
 */
export const ROLE_WORD_BUDGET: Readonly<Record<string, number>> = {
  kicker: 6,
  title: 14,
  lead: 45,
  body: 110,
  caption: 28,
};

/** O texto excede o orçamento em quantas palavras. `0` quando cabe. */
export function excessWords(text: string, role: string): number {
  const budget = ROLE_WORD_BUDGET[role] ?? ROLE_WORD_BUDGET.body;
  return Math.max(0, wordCount(text) - budget);
}

/**
 * Resumo determinístico: fica com as frases mais relevantes.
 *
 * "Relevante" aqui é POSICIONAL, não semântico. Com um modelo de linguagem a
 * sumarização é boa mas imprevisível, e o item 5 proíbe inventar. Sem
 * provider, devolver a primeira e a última frase — quase sempre o enquadramento
 * e a conclusão — é mais fiel do que fingir um resumo sem o fazer.
 *
 * Devolve `null` quando a redução não cabe: o chamador mostra então o original
 * com aviso, em vez de um resumo que perdeu o essencial.
 */
export function shorten(text: string, maxWords: number): string | null {
  if (wordCount(text) <= maxWords) return text;
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    const words = text.trim().split(/\s+/);
    return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}…`;
  }
  const first = sentences[0];
  const last = sentences[sentences.length - 1];
  const merged = first === last ? first : `${first} ${last}`;
  return wordCount(merged) <= maxWords ? merged : null;
}

/**
 * Torna o texto corrido em lista.
 *
 * Devolve `null` quando não há nada a listar. Converter um parágrafo sem
 * separadores numa lista de uma linha seria pior do que o parágrafo original.
 */
export function toList(text: string): string[] | null {
  const explicit = splitList(text);
  if (explicit.length >= 2) return explicit;
  const sentences = splitSentences(text);
  return sentences.length >= 2 ? sentences : null;
}

/**
 * Separa um texto em cards: título + descrição por item.
 *
 * A primeira frase de cada item é o título. É a convenção que o ADMIN já vê nos
 * cards do editor, o que evita ter de explicar o formato.
 */
export function toCards(text: string): Array<{ title: string; body: string }> | null {
  const items = splitList(text);
  if (items.length < 2) return null;
  return items.map((item) => {
    const [first, ...rest] = splitSentences(item);
    return {
      title: (first ?? item).replace(FRAGMENT_TAG, "").trim().slice(0, 60),
      body: rest.join(" ").trim(),
    };
  });
}

/**
 * Verifica se a saída do provider é aceitável.
 *
 * Três recusas, e a razão de cada uma:
 *
 *  · `PRESERVE` devolveu outra coisa — a mais grave, porque o ADMIN pediu
 *    explicitamente que o texto não mudasse.
 *  · Vazio — o modelo falhou. Aplicar um vazio apagaria o conteúdo do ADMIN
 *    sem que ele pedisse.
 *  · Número novo num texto que não o tinha — a forma mais provável de um modelo
 *    "melhorar" um texto e inventar um prazo ou um valor pelo caminho.
 *
 * Devolve o texto ou `null` com o motivo, para a interface mostrar a acção
 * correcta em vez de um erro genérico.
 */
export function validateProviderText(input: {
  original: string;
  produced: unknown;
  intent: TextIntent;
}): { ok: true; text: string } | { ok: false; reason: string } {
  const produced = typeof input.produced === "string" ? input.produced.trim() : "";

  if (!produced) return { ok: false, reason: "O modelo não devolveu texto. O texto original foi mantido." };

  if (input.intent === "PRESERVE" && produced !== input.original.trim()) {
    return {
      ok: false,
      reason: "O texto foi pedido como preservado e o modelo devolveu outra redação. O original foi mantido.",
    };
  }

  // Um número com unidade comercial que não existia no original é um dado
  // inventado — mesmo que não leve cifrão.
  const hadNumbers = COMMERCIAL_NUMBER.test(input.original);
  if (!hadNumbers && COMMERCIAL_NUMBER.test(produced)) {
    return {
      ok: false,
      reason:
        "O texto original não tinha valores e o resultado passou a ter. Um valor novo nunca é aceite.",
    };
  }

  return { ok: true, text: produced };
}

/* -------------------------------------------------------------------------- */
/* PLANO DE TEXTO (item 18)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Como cada intenção é executada.
 *
 * `LOCAL` corre no STUDIO, sem provider, sem rede, sem custo. `MODEL` exige um
 * serviço de linguagem configurado. A distinção é operacional, não teórica: o
 * editor tem de saber se pode oferecer "Resumir" mesmo sem chave de API — e
 * `LOCAL` garante que a maioria das ações funciona sempre.
 */
export type TextStrategy = "LOCAL" | "MODEL";

export type TextPlan = {
  intent: TextIntent;
  label: string;
  help: string;
  strategy: TextStrategy;
  /**
   * `true` quando o resultado muda a ESTRUTURA do texto em vez do conteúdo —
   * é o que permite à interface oferecer "transformar em lista" como acção
   * separada de "melhorar texto".
   */
  restructures: boolean;
};

/**
 * Plano de execução de cada intenção.
 *
 * `EXPAND` e `TRANSLATE` só podem ser feitos por um modelo — e mesmo aí, a
 * expansão está limitada pela regra do item 5: nunca introduzir um dado
 * comercial novo. É por isso que `EXPAND` não é `LOCAL`: expandindo texto sem
 * fonte, só se pode repetir o que já lá está, e isso não é expandir.
 */
const PLAN: Readonly<Record<TextIntent, Omit<TextPlan, "intent">>> = {
  PRESERVE: { label: "Preservar texto", help: "Não altera uma palavra.", strategy: "LOCAL", restructures: false },
  IMPROVE: { label: "Melhorar texto", help: "Afina a redação mantendo o sentido.", strategy: "MODEL", restructures: false },
  REWRITE: { label: "Reescrever", help: "Nova redação com a mesma informação.", strategy: "MODEL", restructures: false },
  SHORTEN: { label: "Resumir", help: "Menos texto, mesmas ideias.", strategy: "LOCAL", restructures: false },
  EXPAND: { label: "Expandir", help: "Mais detalhe, sem inventar factos.", strategy: "MODEL", restructures: false },
  COMMERCIAL: { label: "Mais comercial", help: "Mais orientado a decisão.", strategy: "MODEL", restructures: false },
  TECHNICAL: { label: "Mais técnico", help: "Mais rigor técnico.", strategy: "MODEL", restructures: false },
  SOPHISTICATED: { label: "Mais sofisticado", help: "Vocabulário mais cuidado.", strategy: "MODEL", restructures: false },
  SIMPLIFY: { label: "Simplificar", help: "Frases mais curtas.", strategy: "MODEL", restructures: false },
  FIX_PT: { label: "Corrigir português", help: "Ortografia e pontuação.", strategy: "MODEL", restructures: false },
  TO_LIST: { label: "Transformar em lista", help: "Um ponto por linha.", strategy: "LOCAL", restructures: true },
  TO_CARDS: { label: "Transformar em cards", help: "Separa título e descrição.", strategy: "LOCAL", restructures: true },
  TRANSLATE: { label: "Traduzir", help: "Mantém o sentido noutro idioma.", strategy: "MODEL", restructures: false },
};

/** Como uma intenção vai ser executada. */
export function planText(intent: TextIntent): TextPlan {
  const plan = PLAN[intent];
  return { intent, ...plan };
}

/**
 * Execução local de uma intenção.
 *
 * Devolve `null` quando a transformação é local mas não é possível com este
 * texto — "não há frases para resumir", "não há itens para listar". O editor
 * mostra então o original com a explicação, em vez de o substituir por algo
 * vazio.
 */

export function applyLocalText(intent: TextIntent, text: string, maxWords = 90): string | null {
  switch (intent) {
    case "PRESERVE":
      return text;
    case "SHORTEN":
      return shorten(text, maxWords);
    case "TO_LIST":
      return toList(text)?.join("\n") ?? null;
    case "TO_CARDS":
      return toCards(text)?.map((card) => `${card.title}${card.body ? ` — ${card.body}` : ""}`).join("\n") ?? null;
    default:
      return null;
  }
}

/**
 * A execução local está disponível?
 *
 * `false` para as intenções que precisam de modelo. O editor usa isto para não
 * oferecer um botão que não pode cumprir.
 */
export function canRunLocally(intent: TextIntent): boolean {
  return PLAN[intent].strategy === "LOCAL";
}

/**
 * Todas as intenções, para o menu de texto.
 *
 * Derivado de `PLAN` — a lista que o utilizador vê e a que o motor executa
 * não podem ser duas. `localFirst` põe à frente o que funciona sem provider,
 * porque é isso que funciona numa instalação sem chave configurada.
 */
export function allTextIntents(localFirst = false): TextPlan[] {
  const plans = (Object.keys(PLAN) as TextIntent[]).map(planText);
  return localFirst
    ? [...plans.filter((plan) => plan.strategy === "LOCAL"), ...plans.filter((plan) => plan.strategy === "MODEL")]
    : plans;
}
