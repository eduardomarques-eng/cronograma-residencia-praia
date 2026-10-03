import { round2 } from "./pricing";

/**
 * Tópico 38 — plano de parcelas derivado da proposta aprovada.
 *
 * O sistema não inventa a condição de pagamento (Tópico 30): ela vem da
 * proposta, na forma de percentuais. Este módulo apenas transforma esses
 * percentuais em valores, de forma determinística e reversível.
 *
 * Funções puras: nada aqui toca no banco, o que torna a regra de arredondamento
 * — a parte que mais costuma gerar divergência de centavos — testável.
 */

export type PaymentPlanEntry = {
  /** Marco do serviço, ex.: "assinatura", "anteprojeto", "entrega final". */
  label: string;
  /** Percentual do total. Todos somam exatamente 100. */
  percent: number;
  /** Ordem de cobrança. Determinística pela posição no array. */
  order: number;
};

export type PaymentPlanResult = {
  installments: Array<PaymentPlanEntry & { amount: number }>;
  total: number;
  /** Percentuais efetivamente distribuídos — confirma que somam 100. */
  percentSum: number;
};

/**
 * Distribui um percentual em parcelas de valor.
 *
 * Corrigir o arredondamento (Tópico 30): se cada parcela fosse arredondada de
 * forma independente, a soma poderia divergir do total em centavos. O resto
 * fica na última parcela, garantindo que a soma dos valores é EXATAMENTE o
 * total — sem criar nem apagar dinheiro.
 */
export function distributePercentage(total: number, percent: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(percent)) return 0;
  const raw = (total * percent) / 100;
  if (!Number.isFinite(raw)) return 0;
  return round2(raw);
}

/**
 * Monta as parcelas de um plano. `percentages` são as condições aprovadas na
 * proposta; a soma precisa fechar 100 para não distorcer o valor contratado.
 */
export function buildPaymentPlan(
  total: number,
  percentages: ReadonlyArray<{ label: string; percent: number }>,
): PaymentPlanResult {
  const normalizedTotal = Number.isFinite(total) ? round2(total) : 0;
  const valid = percentages.filter((entry) => entry.label.trim() && Number.isFinite(entry.percent));

  // Sem parcelas ou sem total, não há plano a montar — inventar seria pior.
  if (!valid.length || normalizedTotal <= 0) {
    return { installments: [], total: normalizedTotal, percentSum: 0 };
  }

  const amounts = valid.map((entry) => distributePercentage(normalizedTotal, entry.percent));
  // A diferença de arredondamento vai para a última parcela, nunca para uma
  // nova parcela e nunca some.
  const computedSum = round2(amounts.reduce((sum, amount) => sum + amount, 0));
  const residual = round2(normalizedTotal - computedSum);
  if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + residual);

  return {
    installments: valid.map((entry, index) => ({
      label: entry.label.trim(),
      percent: entry.percent,
      order: index + 1,
      amount: amounts[index],
    })),
    total: normalizedTotal,
    percentSum: round2(valid.reduce((sum, entry) => sum + entry.percent, 0)),
  };
}

/**
 * Extrai a condição de pagamento do texto formal da proposta.
 *
 * O formato aceito é o que o ADMIN escreve no campo de forma de pagamento:
 * "40% assinatura, 30% anteprojeto, 30% entrega final". Quando não há
 * percentuais reconhecíveis, devolve null — o sistema não adivinha (Tópico 30).
 *
 * A análise é feita por segmento (separado por vírgula, ponto e vírgula ou
 * barra) em vez de uma única expressão regular sobre o texto todo: na versão
 * anterior, o rótulo de uma parcela era absorvido como cadeia vazia e a soma
 * final não fechava em 100, descartando planos válidos.
 */
export function parsePaymentPlanFromText(text: unknown): PaymentPlanEntry[] | null {
  if (typeof text !== "string" || !text.trim()) return null;

  const entries: PaymentPlanEntry[] = [];
  for (const rawSegment of text.split(/[,;/]+/)) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    // "40% assinatura" — percentual antes do rótulo.
    const leading = segment.match(/^(\d{1,3}(?:[.,]\d+)?)\s*%\s*(.*)$/);
    if (leading) {
      const label = (leading[2] ?? "").trim();
      const percent = Number(leading[1].replace(",", "."));
      if (Number.isFinite(percent) && percent > 0 && label) {
        entries.push({ label, percent, order: entries.length + 1 });
      }
      continue;
    }

    // "assinatura 40%" — rótulo antes do percentual.
    const trailing = segment.match(/^(.*?)\s*(\d{1,3}(?:[.,]\d+)?)\s*%$/);
    if (trailing) {
      const label = (trailing[1] ?? "").trim();
      const percent = Number(trailing[2].replace(",", "."));
      if (Number.isFinite(percent) && percent > 0 && label) {
        entries.push({ label, percent, order: entries.length + 1 });
      }
    }
  }

  if (!entries.length) return null;
  // Só aceita um plano fechado: soma diferente de 100 distorceria o valor.
  const sum = entries.reduce((total, entry) => total + entry.percent, 0);
  return Math.round(sum) === 100 ? entries : null;
}

/**
 * Converte as parcelas em registros prontos para o banco.
 *
 * A ordem começa em 1 porque `Payment` tem `@@unique([projectId, order])`:
 * reexecutar a conversão precisa colidir na chave, e não duplicar.
 */
export function toPaymentRecords(
  plan: PaymentPlanResult,
  options: { projectId: string; proposalId: string; proposalVersion: number; dueDate?: Date | null },
) {
  return plan.installments.map((installment) => ({
    projectId: options.projectId,
    name: installment.label,
    amount: installment.amount,
    order: installment.order,
    percentage: Math.round(installment.percent),
    status: "PENDING" as const,
    // Chave estável: mesma proposta + mesma versão + mesma ordem = mesma chave.
    // O índice único do banco é a garantia final contra parcela duplicada.
    sourceKey: `proposal:${options.proposalId}:v${options.proposalVersion}:p${installment.order}`,
    sourceProposalId: options.proposalId,
    dueDate: options.dueDate ?? null,
    note: `Gerado da proposta versão ${options.proposalVersion} (${Math.round(installment.percent)}%).`,
  }));
}

/** Estima um vencimento simples e sequencial a partir da data de início. */
export function buildInstallmentDueDates(start: Date, count: number, stepDays = 30): Array<Date> {
  const dayMs = 86_400_000;
  return Array.from({ length: Math.max(0, count) }, (_, index) => new Date(start.getTime() + (index + 1) * stepDays * dayMs));
}

/* -------------------------------------------------------------------------- */
/* CONGELAMENTO DO PLANO (Prompt 18, itens 2, 3 e 5)                            */
/* -------------------------------------------------------------------------- */

/**
 * Uma linha do plano, tal como é persistida e publicada.
 *
 * `order` entra no tipo persistido (e não só no interno) porque a ordem de
 * cobrança é parte do que o cliente aprova — omiti-la faria o plano público
 * divergir do administrativo na sequência das parcelas.
 */
export type PaymentPlanLine = {
  label: string;
  percent: number;
  amount: number;
  order: number;
};

/**
 * Plano CONGELADO numa versão da proposta.
 *
 * É este objecto — e não o texto livre — que é a fonte de verdade do plano.
 * Guardar o total e a origem torna o plano auto-descritivo e auditável.
 */
export type PaymentPlanSnapshot = {
  /** Versão do formato; permite migrar sem adivinhar. */
  format: 1;
  total: number;
  installments: PaymentPlanLine[];
  /** De onde o plano foi derivado, para a auditoria responder "porquê". */
  derivedFrom: "formalText.formaPagamento" | "NOT_DEFINED";
};

/**
 * Deriva e CONGELA o plano a partir dos dados da própria versão.
 *
 * Ponto único de congelamento (Prompt 18, item 2): o plano é calculado uma
 * única vez, quando a versão é gravada, e a partir daí é apenas lido. Sem
 * isto, o plano seria re-interpretado do texto livre a cada leitura e uma
 * proposta já publicada mudaria sozinha — o que o item 5 proíbe.
 *
 * Devolve sempre um snapshot (mesmo vazio), para que "derivado sem plano" seja
 * distinguível de "nunca congelado".
 */
export function freezePaymentPlan(input: {
  formalText: Record<string, unknown> | null | undefined;
  total: number;
}): PaymentPlanSnapshot {
  const formalText = input.formalText ?? {};
  const raw = formalText.formaPagamento ?? formalText.paymentTerms;
  const parsed = parsePaymentPlanFromText(raw);
  const total = Number.isFinite(input.total) ? round2(input.total) : 0;
  const plan = buildPaymentPlan(total, parsed ?? []);

  return {
    format: 1,
    total,
    installments: plan.installments.map((item) => ({
      label: item.label,
      percent: item.percent,
      amount: item.amount,
      order: item.order,
    })),
    derivedFrom: parsed ? "formalText.formaPagamento" : "NOT_DEFINED",
  };
}

/**
 * Lê um plano persistido, validando a forma antes de confiar.
 *
 * `null` significa uma de duas coisas, e a distinção é explícita no tipo de
 * retorno do chamador: `LEGACY` (versão anterior a esta correcção) ou
 * inválido/corrompido. Nunca lançamos por um dado torto, e nunca devolvemos um
 * plano meio preenchido.
 */
export function readPaymentPlanSnapshot(raw: unknown): PaymentPlanSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.format !== 1) return null;
  if (!Array.isArray(record.installments)) return null;

  const installments: PaymentPlanLine[] = [];
  for (const entry of record.installments) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const percent = Number(item.percent);
    const amount = Number(item.amount);
    const order = Number(item.order);
    if (!label) return null;
    if (!Number.isFinite(percent) || !Number.isFinite(amount) || !Number.isFinite(order)) return null;
    installments.push({ label, percent, amount, order });
  }

  return {
    format: 1,
    total: Number.isFinite(Number(record.total)) ? round2(Number(record.total)) : 0,
    installments,
    derivedFrom: record.derivedFrom === "formalText.formaPagamento" ? "formalText.formaPagamento" : "NOT_DEFINED",
  };
}

/**
 * Resolve o plano a apresentar para uma versão.
 *
 * Ordem de prioridade, e a razão de cada ramo:
 *
 *  1. `CONGELADO` — o plano persistido. É o caminho normal e o único que
 *     satisfaz a reprodutibilidade histórica.
 *  2. `LEGACY_DERIVED` — versão criada antes desta correcção. Derivamos dos
 *     dados da PRÓPRIA versão (nunca de configuração global), sinalizamos com
 *     aviso, e assim que a proposta for reeditada passa a congelar.
 *
 * O item 5 do Prompt 18 exige que nunca se reconstrua uma proposta antiga a
 * partir de configuração actual; por isso este ramo só usa o texto da própria
 * versão e devolve um aviso visível ao ADMIN.
 */
export function resolvePaymentPlanForVersion(input: {
  frozen: unknown;
  formalText: Record<string, unknown> | null | undefined;
  total: number;
}): { snapshot: PaymentPlanSnapshot; source: "CONGELADO" | "LEGACY_DERIVED"; warnings: string[] } {
  const persisted = readPaymentPlanSnapshot(input.frozen);
  if (persisted) {
    return { snapshot: persisted, source: "CONGELADO", warnings: [] };
  }
  const derived = freezePaymentPlan({ formalText: input.formalText, total: input.total });
  return {
    snapshot: derived,
    source: "LEGACY_DERIVED",
    warnings: [
      "Esta versão foi criada antes do congelamento do plano de pagamento. O plano foi derivado do texto da própria versão e será congelado na próxima edição.",
    ],
  };
}
