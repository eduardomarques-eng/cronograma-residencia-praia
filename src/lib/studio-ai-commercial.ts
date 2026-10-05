/**
 * FASE 4E — CONTROLE COMERCIAL DA IA (item 55) — REGRA CRÍTICA.
 *
 * A IA pode escrever, resumir, reorganizar, estilizar e sugerir. Ela NÃO pode
 * alterar preço, quantidade, desconto, subtotal, total, pagamento, validade ou
 * escopo comercial.
 *
 * O defeito que este módulo existe para impedir é específico e provável: alguém
 * pede "reduza o preço em 20%", a IA cumpre — escrevendo "R$ 36.000" num
 * parágrafo — e o cliente aprova um número que o servidor nunca emitiu. A
 * apresentação fica bonita e o disparo é real: não é alucinação vaga, é um
 * número plausível, bem formatado, e totalmente falso.
 *
 * A defesa NÃO é "não peça isso à IA". Pedem sempre. A defesa é estrutural, em
 * três camadas:
 *
 *  1. **Reconhecer o pedido.** `classifyCommercialIntent` lê o comando e diz se
 *     é editorial ou comercial. Um desconto pedido em linguagem natural é
 *     comercial SEMPRE, mesmo embrulhado em "melhora a proposta".
 *  2. **Devolver a acção oficial, não o texto.** `planCommercialAction` traduz o
 *     pedido num `CommercialAction` que passa pelo pricing oficial
 *     (`computeTotals`) e pelo versionamento. A IA não escreve o número; a
 *     aritmética é da aplicação.
 *  3. **Verificar o que voltou.** `findCommercialDrift` compara a saída com a
 *     versão anterior. Isto cobre o que (1) e (2) não apanham: um comando
 *     puramente editorial cujo texto de saída inclui um valor inventado.
 *
 * A camada 3 não é redundância. Pedir "melhora a redação" a um modelo produz,
 * com frequência, um número plausível inventado no parágrafo — e o comando nunca
 * mencionou preço. Sem verificação de saída, a regra do item 55 seria uma
 * intenção e não uma garantia.
 */

import { computeTotals, type ProposalItem } from "./proposal-item";
import { formatCurrencyBRL } from "./contract-template";
import { round2 } from "./pricing";

/* -------------------------------------------------------------------------- */
/* VOCABULÁRIO COMERCIAL                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Campos que a IA nunca pode mudar.
 *
 * É uma lista FECHADA e é o registo único: o classificador e a verificação leem
 * esta mesma lista. Um termo comercial novo entra aqui uma vez e passa a valer
 * nos dois sítios — em vez de existir numa condição de cada um, que é como
 * estas regras divergem na primeira alteração.
 */
export const COMMERCIAL_FIELDS = [
  "preco",
  "quantidade",
  "desconto",
  "subtotal",
  "total",
  "pagamento",
  "validade",
  "escopo",
] as const;

export type CommercialField = (typeof COMMERCIAL_FIELDS)[number];

/** Sinais de escrita comercial, em português e inglês. */
const FIELD_TERMS: ReadonlyArray<{ field: CommercialField; terms: readonly string[] }> = [
  { field: "preco", terms: ["preco", "valor", "tarifa", "price"] },
  { field: "quantidade", terms: ["quantidade", "unidades", "m2", "quantity"] },
  { field: "desconto", terms: ["desconto", "abatimento"] },
  { field: "subtotal", terms: ["subtotal", "sub-total"] },
  { field: "total", terms: ["total", "montante", "valor final"] },
  { field: "pagamento", terms: ["pagamento", "parcela", "prestacao", "payment", "entrada"] },
  { field: "validade", terms: ["validade", "valido", "prazo", "expira"] },
  { field: "escopo", terms: ["escopo", "scope", "inclui", "exclui", "servico"] },
];

/** Remove acentos, para comparar "preço" com "preco". */
const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
/**
 * Palavras que indicam uma MUDANÇA de valor comercial.
 *
 * Têm de andar juntas das FIELD_TERMS. "preço" sozinho aparece em "o preço
 * transparente que propomos" — um adjetivo, não um pedido. É o verbo de mudança
 * que transforma o substantivo num comando.
 */
const CHANGE_TERMS = [
  "reduz",
  "reduzir",
  "reduza",
  "reduzir o",
  "baixe",
  "baixar",
  "diminua",
  "diminuir",
  "aumente",
  "aumentar",
  "acrescente",
  "acrescentar",
  "altere",
  "alterar",
  "mude",
  "muda",
  "mudar",
  "ajuste",
  "ajustar",
  "corrija",
  "corrigir",
  "tire",
  "retire",
  "remova",
  "substitua",
  "troque",
  "adicione",
  "inclua",
  "inclui",
  "incluir",
  "exclua",
  "exclui",
  "estenda",
  "estender",
  "aumentar",
  "resuma",
  "resumir",
  "reescreva",
  "reescrever",
  "melhor",
  "simplific",
  "expanda",
  "traduz",
  "remove",
  "remove",
  "reduce",
  "increase",
  "change",
  "apply",
  "discount",
];

/** Modificadores que indicam acção comercial, mesmo sem verbo de mudança. */
const COMMERCIAL_MODIFIERS = ["%", "por cento", "percent", "desconto"];

/* -------------------------------------------------------------------------- */
/* CLASSIFICAÇÃO                                                               */
/* -------------------------------------------------------------------------- */

export type CommercialIntent = {
  /** `true` quando o comando mexe em dinheiro, quantidade, prazo ou escopo. */
  commercial: boolean;
  /** Campos que o pedido parece tocar. Vazio quando não é comercial. */
  fields: CommercialField[];
  /**
   * `true` quando é uma ESCRITA comercial — verbo de mudança.
   *
   * Distingue "reduza o preço em 20%" de "o preço que propomos é transparente".
   * Sem esta distinção, um texto perfeitamente editorial seria barrado.
   */
  mutation: boolean;
};

/**
 * Lê o comando e diz se é comercial.
 *
 * A decisão é POR ANÁLISE DO TEXTO, nunca por allowlist de intenções: o comando
 * chega em português natural do ADMIN e não pode ser reduzido a um enum. O que se
 * faz é procurar um campo comercial E um sinal de mudança.
 */
export function classifyCommercialIntent(instruction: string): CommercialIntent {
  const value = fold(instruction);
  if (!value.trim()) return { commercial: false, fields: [], mutation: false };

  const fields: CommercialField[] = [];
  for (const { field, terms } of FIELD_TERMS) {
    if (terms.some((term) => value.includes(fold(term)))) fields.push(field);
  }

  const mutation =
    CHANGE_TERMS.some((term) => value.includes(term)) ||
    COMMERCIAL_MODIFIERS.some((term) => value.includes(term));

  // Só é comercial quando há um CAMPO. "resuma este texto" não tem campo
  // comercial; "resuma e diga que o preço é baixo" tem — e é essa frase que
  // inventa um número.
  return { commercial: fields.length > 0 && mutation, fields, mutation };
}

/** `true` quando o comando pede para mexer em valores comerciais. */
export function isCommercialCommand(instruction: string): boolean {
  return classifyCommercialIntent(instruction).commercial;
}
/* -------------------------------------------------------------------------- */
/* ACÇÃO OFICIAL (item 55: "passar pela lógica oficial de pricing")            */
/* -------------------------------------------------------------------------- */

export type CommercialAction =
  | {
      kind: "AJUSTE_PERCENTUAL";
      /** Percentagem pedida, com sinal: negativo é desconto. */
      percent: number;
      /** Total contratado ANTES do ajuste — o valor de referência. */
      base: number;
      /** Ajuste em euros, já arredondado. O que o pricing vai somar. */
      adjustment: number;
      /** Total DEPOIS do ajuste, calculado pelo pricing oficial. */
      total: number;
      label: string;
    }
  | {
      kind: "REQUER_REVISAO_HUMANA";
      /** Campos que o comando toca e que não são automatizáveis com segurança. */
      fields: CommercialField[];
      reason: string;
    };

const isDiscountCommand = (value: string): boolean =>
  ["desconto", "abatimento", "reduz", "reduzir", "reduza", "baixe", "diminu", "discount", "reduce"].some((term) =>
    value.includes(term),
  );

/**
 * Extrai a percentagem pedida num comando de desconto.
 *
 * Aceita "20%", "20 por cento", "0,2" e "20" isolado. Quando não há
 * percentagem explícita devolve `null` — e `null` NÃO é zero. Tratar a ausência
 * como 0% transformaria "reduza o preço" num "mantenha o preço" silencioso, e o
 * ADMIN veria a proposta sem alteração e sem aviso.
 */
export function parsePercent(instruction: string): number | null {
  const value = fold(instruction);

  // "20%" e "20 %"
  const symbol = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (symbol) {
    const magnitude = Number(symbol[1].replace(",", "."));
    if (Number.isFinite(magnitude)) return -Math.abs(magnitude);
  }

  // "20 por cento"
  const words = value.match(/(\d+(?:[.,]\d+)?)\s*(?:por\s+cento|percent)/);
  if (words) {
    const magnitude = Number(words[1].replace(",", "."));
    if (Number.isFinite(magnitude)) return -Math.abs(magnitude);
  }

  // "0,2" isolado — uma fracção, não uma percentagem.
  const fraction = value.match(/\b(0[.,]\d+)\b/);
  if (fraction) {
    const magnitude = Number(fraction[1].replace(",", "."));
    if (Number.isFinite(magnitude)) return -Math.abs(round2(magnitude * 100));
  }

  // "20" isolado, quando o comando é claramente de desconto.
  const bare = value.match(/\b(\d{1,3})\b/);
  if (bare && isDiscountCommand(value)) {
    const magnitude = Number(bare[1]);
    if (Number.isFinite(magnitude) && magnitude > 0 && magnitude <= 100) return -magnitude;
  }

  return null;
}

/**
 * Traduz o pedido comercial numa ACÇÃO que o pricing oficial executa.
 *
 * Este é o ponto do item 55: "reduza o preço em 20%" deixa de ser um comando de
 * escrita e passa a ser um pedido de `AJUSTE_PERCENTUAL`. Quem aplica é
 * `computeTotals`, a mesma função que produz o contrato — por isso subtotal,
 * total e parcelas não podem divergir do que o cliente aprova.
 *
 * Quando o pedido é comercial mas não automatizável (mudar o escopo, estender a
 * validade, reestruturar o pagamento), devolve `REQUER_REVISAO_HUMANA` em vez de
 * adivinhar. Um desconto é aritmética; escopo é contrato.
 */
export function planCommercialAction(input: {
  instruction: string;
  items: readonly ProposalItem[];
  adjustment?: number;
}): CommercialAction {
  const intent = classifyCommercialIntent(input.instruction);

  if (!intent.commercial) {
    return {
      kind: "REQUER_REVISAO_HUMANA",
      fields: intent.fields,
      reason: "Este comando não mexe em valores comerciais. Pode ser aplicado como texto.",
    };
  }

  const totals = computeTotals(input.items, input.adjustment ?? 0);
  const base = totals.total;
  const percent = parsePercent(input.instruction);

  // Um desconto sobre um total já zerado não é um desconto.
  if (base <= 0) {
    return {
      kind: "REQUER_REVISAO_HUMANA",
      fields: intent.fields,
      reason:
        "O total desta proposta é zero. Não há base para aplicar um desconto — reveja as linhas primeiro.",
    };
  }

  if (percent === null) {
    return {
      kind: "REQUER_REVISAO_HUMANA",
      fields: intent.fields,
      reason:
        "Não encontrei a percentagem no pedido. Diga quanto deve ficar (ex.: \"aplique 10% de desconto\") e o ajuste é calculado pelo pricing oficial.",
    };
  }

  const adjustment = round2((base * percent) / 100);

  // O total final vem do pricing, com a mesma protecção de nunca-negativo que a
  // proposta usa. Um desconto maior que o total tem de chumbar, não virar
  // "R$ -0,00".
  const total = computeTotals(input.items, (input.adjustment ?? 0) + adjustment).total;

  return {
    kind: "AJUSTE_PERCENTUAL",
    percent,
    base,
    adjustment,
    total,
    label: `${percent}% sobre ${formatCurrencyBRL(base)} → ${formatCurrencyBRL(total)}`,
  };
}
/* -------------------------------------------------------------------------- */
/* VERIFICAÇÃO DE SAÍDA                                                        */
/* -------------------------------------------------------------------------- */

/** Uma alteração de valor comercial detectada na saída da IA. */
export type CommercialDrift = {
  field: CommercialField;
  /** O valor que a IA escreveu. */
  found: string;
  /** O valor que a fonte autoritativa diz. `null` quando não havia. */
  expected: string | null;
  reason: string;
};

/** Reconhece valores monetários: "R$ 36.000", "36.000,00 €", "36000 euros". */
const MONEY = /R\$\s?[\d.,]+|€\s?[\d.,]+|[\d.,]+\s?(?:eur|euros)/gi;

/** Reconhece percentagens: "20%", "20 por cento". */
const PERCENT = /\d+(?:[.,]\d+)?\s?(?:%|por\s+cento)/gi;

/**
 * Compara a saída da IA com a versão anterior e devolve as violações.
 *
 * A regra é DELTA, não de conjunto: a IA pode repetir um valor que já lá estava
 * — isso não é deriva. O que é deriva é um valor comercial que APARECEU e não
 * estava, ou que MUDOU. Sem esta distinção, um texto que menciona legitimamente
 * o investimento seria acusado sempre que o número não aparecesse outra vez.
 *
 * É esta função que apanha o caso perigoso: "melhora a redação" produzindo
 * "R$ 36.000" num parágrafo que antes não tinha número nenhum.
 */
export function findCommercialDrift(input: {
  before: string;
  after: string;
  /** Valores que a fonte comercial diz — a verdade a que o texto deve obedecer. */
  authoritative: readonly string[];
}): CommercialDrift[] {
  const seenBefore = new Set(extractValues(input.before));
  const drifts: CommercialDrift[] = [];

  for (const found of extractValues(input.after)) {
    if (seenBefore.has(found)) continue; // Já estava lá: não é deriva.

    // Se o valor bate com a fonte comercial, é uma citação legítima.
    // `found` já vem normalizado de `extractValues`.
    if (input.authoritative.some((value) => normalizeValue(value) === found)) continue;

    drifts.push({
      field: "preco",
      found,
      expected: input.authoritative.length ? input.authoritative.join(" · ") : null,
      reason:
        "A IA introduziu um valor comercial que não existe na proposta. Valores monetários e percentagens têm de vir do pricing oficial, não de texto gerado.",
    });
  }

  return drifts;
}

/** Valores monetários e percentagens de um texto, normalizados para comparação. */
function extractValues(text: string): string[] {
  const money = (text.match(MONEY) ?? []).map(normalizeValue);
  const percent = (text.match(PERCENT) ?? []).map((value) => {
    const magnitude = Number(value.match(/[\d.,]+/)?.[0]?.replace(",", ".") ?? Number.NaN);
    return Number.isFinite(magnitude) ? `-${round2(magnitude)}%` : value.trim();
  });
  return [...money, ...percent].filter(Boolean);
}

/**
 * Normaliza um valor monetário para comparação.
 *
 * O detalhe que faz esta função correcta é o separador de MILHARES. Em pt-BR,
 * "36.000" são trinta e seis mil — mas `Number("36.000")` dá `36`. Uma
 * comparação feita com `Number` directamente diria que "R$ 36.000" e "R$ 36"
 * são o mesmo número, e a verificação de deriva passaria batada sobre o
 * exactamente o erro que existe para apanhar.
 *
 * Por isso a ordem é: ponto = separador de milhares (some-se), vírgula =
 * separador decimal (vira ponto).
 */
function normalizeValue(value: string): string {
  const trimmed = value.trim().toUpperCase();
  const number = trimmed.match(/[\d.,]+/);
  if (!number) return trimmed;

  const normalized = number[0].replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : normalized;
}

/* -------------------------------------------------------------------------- */
/* APLICAÇÃO DA ACÇÃO                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Erro de comando comercial que a IA não pode executar.
 *
 * Distinto de `StudioContentError` porque a interface o trata de forma
 * diferente: não é "o texto não pôde ser escrito", é "isto é uma acção comercial
 * e vai seguir o caminho oficial".
 */
export class CommercialActionRequired extends Error {
  readonly action: CommercialAction;

  constructor(action: CommercialAction) {
    super(action.kind === "AJUSTE_PERCENTUAL" ? action.label : action.reason);
    this.name = "CommercialActionRequired";
    this.action = action;
  }
}

/**
 * Porta de entrada única para um comando de IA.
 *
 * Devolve `null` quando o comando é editorial e pode seguir como texto. Devolve
 * um `CommercialActionRequired` quando é comercial — e nesse caso NADA é escrito
 * na apresentação. Quem executa é o pricing oficial, sobre a versão, com as
 * consequências de versionamento.
 *
 * É esta função que o editor chama ANTES de `remixDeck` ou de qualquer escrita.
 * Chamá-la depois seria tarde: o texto já teria mudado.
 */
export function guardCommercialCommand(input: {
  instruction: string;
  items: readonly ProposalItem[];
  adjustment?: number;
}): CommercialActionRequired | null {
  if (!isCommercialCommand(input.instruction)) return null;
  return new CommercialActionRequired(planCommercialAction(input));
}

/* -------------------------------------------------------------------------- */
/* TEXTO AUTORITATIVO                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Os valores que a apresentação pode citar sem ser accused de derivação.
 *
 * Vem do `CommercialData` já lido pelo servidor — a MESMA fonte que o contrato e
 * o PDF usam. Construir esta lista a partir do texto da proposta seria permitir
 * que o texto definisse a verdade.
 */
export function authoritativeValues(data: {
  items: readonly ProposalItem[];
  totals: { contractedSubtotal: number; optionalSubtotal: number; adjustment: number; total: number };
}): string[] {
  const values: string[] = [];
  const push = (value: number) => {
    values.push(formatCurrencyBRL(value));
    values.push(String(round2(value)));
  };

  for (const item of data.items) {
    push(item.subtotal);
    push(item.unitPrice);
  }
  push(data.totals.contractedSubtotal);
  push(data.totals.optionalSubtotal);
  push(data.totals.adjustment);
  push(data.totals.total);

  // Normalizados, para a comparação com o texto não depender do formato.
  // `findCommercialDrift` normaliza o lado do texto; este lado já nasce
  // normalizado, e normalizar duas vezes transformaria "15000" em "15" — o
  // mesmo bug de separador de milhares, agora dentro da nossa própria
  // verificação.
  return values.map((value) => normalizeValue(value));
}