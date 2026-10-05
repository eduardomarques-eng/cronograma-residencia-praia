import { UNIT_LABELS, round2, type CatalogService, type PricingLevelName, type ServiceUnitName } from "./pricing";

/**
 * FASE 4C — O ITEM DA PROPOSTA (`ProposalItem` conceptual).
 *
 * O banco não tem tabela `ProposalItem`: as linhas vivem em
 * `ProposalVersion.services` (Json). Este módulo é o CONTRATO desse Json — a
 * forma única e validada de uma linha. Existe para que editor, motor de preços,
 * gerador de documentos, PDF e DTO público leiam e escrevam a MESMA estrutura,
 * em vez de cada consumidor inventar os seus campos.
 *
 * Três decisões estruturais:
 *
 *  1. **`optional` é parte da linha, não do total.** O item 17 exige que o
 *     cliente veja o que é obrigatório e o que é opcional, e o item 71 proíbe
 *     somar opcionais não contratados. Guardar a flag na linha é o que torna
 *     ambos verificáveis: quem calcula o total filtra por `optional === false`.
 *
 *  2. **O preço vem congelado.** `unitPrice` é o preço EFECTIVAMENTE usado nesta
 *     versão, não uma referência ao catálogo. É o que permite reconstruir a
 *     proposta depois de o ADMIN mudar o preço (item 24).
 *
 *  3. **`serviceId` é preservado, mas o texto também.** Guardamos o id para
 *     rastreabilidade E o nome/unit no momento da versão. Se o serviço for
 *     renomeado ou desactivado no catálogo, a proposta já enviada continua
 *     legível — o contrato não pode quebrar por uma edição de catálogo.
 */

export type ProposalItemInput = {
  serviceId?: string | null;
  name: string;
  discipline?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  /** `true` = ofertado como opção; NÃO entra no total contratado. */
  optional?: boolean;
  order?: number;
  notes?: string | null;
  /** Escopo comercial desta linha, congelado na versão (itens 25 e 26). */
  scope?: string | null;
  exclusions?: string | null;
  /** Nível do catálogo de onde veio o preço (item 23). */
  level?: PricingLevelName | null;
  /** Se true, o preço foi ajustado pelo ADMIN em vez de vir do catálogo. */
  priceOverridden?: boolean;
  /** Prazo do serviço em dias, herdado do catálogo (item 28). */
  estimatedDays?: number | null;
};

/** Linha persistida: a mesma coisa, já normalizada para gravação. */
export type ProposalItem = ProposalItemInput & {
  subtotal: number;
  order: number;
  optional: boolean;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Texto limpo ou `null` — nunca string vazia a persistir. */
function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Erro de uma linha inválida.
 *
 *Existe com nome próprio em vez de `Error` genérico porque o editor precisa
 * distinguir "o ADMIN escreveu algo errado" (mostrar junto ao formulário) de
 * "o servidor falhou" (mostrar como erro de sistema). Uma `instanceof` resolve
 * os dois casos sem parsing de mensagem.
 */
export class ProposalItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalItemError";
  }
}

/**
 * Normaliza uma linha vinda do editor ou do catálogo.
 *
 * O subtotal é SEMPRE recalculado aqui (`quantidade × preço`), nunca aceito do
 * chamador. Esta é a protecção central do item 19: se o navegador mandar
 * `subtotal: 0`, o servidor ignora e recalcula. Aceitar o subtotal do frontend é
 * o que permitiria a um cliente mostrar "R$ 0,00" numa proposta de R$ 40.000 e
 * aprová-la.
 */
export function normalizeProposalItem(input: ProposalItemInput, fallbackOrder = 0): ProposalItem {
  const name = text(input.name);
  if (!name) throw new ProposalItemError("Toda linha da proposta precisa de um nome de serviço.");

  const quantity = round2(toFiniteNumber(input.quantity, 0));
  if (quantity <= 0) throw new ProposalItemError(`“${name}” precisa de uma quantidade maior que zero.`);

  const unitPrice = round2(toFiniteNumber(input.unitPrice, 0));
  if (unitPrice < 0) throw new ProposalItemError(`“${name}” não pode ter preço unitário negativo.`);

  return {
    serviceId: text(input.serviceId),
    name,
    discipline: text(input.discipline),
    description: text(input.description),
    unit: text(input.unit),
    quantity,
    unitPrice,
    subtotal: round2(quantity * unitPrice),
    optional: Boolean(input.optional),
    order: toFiniteNumber(input.order, fallbackOrder),
    notes: text(input.notes),
    scope: text(input.scope),
    exclusions: text(input.exclusions),
    level: input.level ?? null,
    priceOverridden: Boolean(input.priceOverridden),
    estimatedDays: input.estimatedDays ?? null,
  };
}

/** Lê um item já persistido, normalizando e recalculando o subtotal. */
export function readProposalItem(raw: unknown): ProposalItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const name = text(record.name);
  const quantity = round2(toFiniteNumber(record.quantity, 0));
  if (!name || quantity <= 0) return null;
  return normalizeProposalItem({ ...(record as unknown as ProposalItemInput), name, quantity }, toFiniteNumber(record.order, 0));
}

/**
 * Lê a lista persistida, descartando linhas irrecuperáveis.
 *
 * Linhas que não passam pela validação são removidas em vez de falhar a leitura
 * inteira: uma proposta antiga gravada pelo editor anterior não pode ficar
 * ilegível para sempre por causa de uma linha sem quantidade.
 */
export function readProposalItems(raw: unknown): ProposalItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ProposalItem[] = [];
  raw.forEach((entry, index) => {
    try {
      items.push(normalizeProposalItem({ ...(entry as ProposalItemInput), order: toFiniteNumber((entry as Record<string, unknown>)?.order, index) }));
    } catch {
      // Linha irrecuperável: omitida, não inválida a proposta inteira.
    }
  });
  return items;
}

/**
 * Constrói uma linha a partir de um serviço do catálogo e da quantidade pedida.
 *
 * O preço vem do CATÁLOGO sempre que existe. O `unitPriceOverride` só é usado
 * quando o ADMIN escreve um valor, e nesse caso a linha fica marcada como
 * ajustada — para que a memória de cálculo explique ao ADMIN de onde veio o
 * número, em vez de o preço parecer ter saído do catálogo sem explicação.
 */
export function itemFromCatalog(
  service: CatalogService,
  input: { quantity: number; level: PricingLevelName; unitPriceOverride?: number | null; optional?: boolean; order?: number },
): ProposalItem {
  const catalogPrice =
    input.level === "BAIXO" ? service.baseLow : input.level === "MEDIO" ? service.baseMedium : service.baseHigh;
  const overridden = input.unitPriceOverride !== null && input.unitPriceOverride !== undefined;
  const unitPrice = overridden ? round2(Number(input.unitPriceOverride)) : round2(Number(catalogPrice));

  return normalizeProposalItem({
    serviceId: service.id,
    name: service.name,
    discipline: service.discipline,
    unit: UNIT_LABELS[service.unit as ServiceUnitName] ?? service.unit,
    quantity: input.quantity,
    unitPrice,
    optional: input.optional ?? false,
    order: input.order ?? 0,
    level: input.level,
    priceOverridden: overridden,
    estimatedDays: service.estimatedDays ?? null,
  });
}

/**
 * Totais da proposta, com a separação OBRIGATÓRIO/OPCIONAL do item 17.
 *
 * O total contratado SOMA APENAS as linhas obrigatórias. Opcionais são
 * contabilizadas à parte para que o cliente veja o que seria um upgrade, mas o
 * número que vira contrato e parcelas nunca as inclui (item 71).
 */
export type ProposalTotals = {
  /** Soma das linhas obrigatórias. */
  contractedSubtotal: number;
  /** Soma das linhas marcadas como opcionais. */
  optionalSubtotal: number;
  /** Ajuste comercial: desconto negativo, acréscimo positivo. */
  adjustment: number;
  /** Total contratado = subtotal obrigatório + ajuste. Nunca negativo. */
  total: number;
  /** Soma de tudo, para conferência visual do ADMIN. */
  grossSubtotal: number;
};

export function computeTotals(items: ReadonlyArray<ProposalItem>, adjustment = 0): ProposalTotals {
  const contractedSubtotal = round2(
    items.filter((item) => !item.optional).reduce((sum, item) => sum + item.subtotal, 0),
  );
  const optionalSubtotal = round2(
    items.filter((item) => item.optional).reduce((sum, item) => sum + item.subtotal, 0),
  );
  const delta = round2(adjustment);
  // Nunca devolver total negativo: um desconto maior que o subtotal é erro de
  // digitação, e mostrar "R$ -500,00" numa proposta é pior que recusar.
  const total = round2(Math.max(0, contractedSubtotal + delta));
  return {
    contractedSubtotal,
    optionalSubtotal,
    adjustment: delta,
    total,
    grossSubtotal: round2(contractedSubtotal + optionalSubtotal),
  };
}
