/**
 * FASE 4C — LIGAÇÃO À FONTE COMERCIAL (itens 26, 27, 28, 29 e 30).
 *
 * Os cinco itens partilham o mesmo problema: tabelas, comparativos, cronogramas,
 * investimento e pagamento querem MOSTRAR números, e a tentação natural — e errada
 * — é escrevê-los como texto dentro da apresentação. É assim que uma proposta
 * passa a dizer "R$ 45.000" num título enquanto o servidor cobra R$ 50.000, e o
 * cliente aprova um valor que ninguém emitiu.
 *
 * Este módulo é a ÚNICA forma de levar um valor comercial da `ProposalVersion`
 * para a apresentação. Regra única:
 *
 *   **O ELEMENTO NÃO GUARDA O VALOR — GUARDA A FONTE.**
 *
 * Um elemento ligado (`binding`) guarda apenas QUAL dado comercial quer mostrar
 * (`SERVICOS`, `INVESTIMENTO`, `ESCOPO`, `PAGAMENTO`, `CRONOGRAMA`, `OPCORES`).
 * As linhas são RESOLVIDAS a cada leitura, a partir da `ProposalVersion`. Três
 * consequências que valem mais do que a economia de código:
 *
 *  1. **Um valor comercial não diverge da proposta**, porque é lido da proposta.
 *     Não há cópia a sincronizar.
 *  2. **Reeditar o preço obriga a passar pela proposta**, que recalcula
 *     subtotais, totais e parcelas. É o "mecanismo comercial" do item 26.
 *  3. **A proposta pública e a apresentação mostram o mesmo número**, porque as
 *     duas leem esta função — que é o que o item 30 exige.
 *
 * As funções são PURAS e determinísticas: recebem a versão já seleccionada do
 * banco e devolvem texto. Sem `Date.now()`, sem aleatoriedade, sem I/O. É o que
 * permite fixar a consistência entre administrador e cliente num teste.
 *
 * Um elemento SEM `binding` continua a ser conteúdo do autor (uma tabela de
 * acabamentos, uma lista de materiais) — isso não é erro. O que é erro é um
 * elemento LIGADO que transporta linhas escritas à mão: `assertBindingIsHonest`
 * recusa esse caso, porque aí o mesmo número tem duas fontes.
 */

import { formatCurrencyBRL } from "./contract-template";
import { computeTotals, readProposalItems, type ProposalItem } from "./proposal-item";
import { readPaymentPlanSnapshot, type PaymentPlanSnapshot } from "./payment-plan";
import { formatQuantity, round2 } from "./pricing";

/* -------------------------------------------------------------------------- */
/* FONTE COMERCIAL                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Que dado comercial um elemento ligado apresenta.
 *
 * É um conjunto FECHADO e é o registo único: o painel de elementos, as
 * sugestões da IA e a validação leem esta lista. Acrescentar uma fonte nova é
 * acrescentar uma entrada aqui — não uma condição nova espalhada por três
 * componentes, que é como estas regras divergem na primeira alteração.
 */
export type CommercialBinding =
  | "SERVICOS"
  | "INVESTIMENTO"
  | "ESCOPO"
  | "PAGAMENTO"
  | "CRONOGRAMA"
  | "OPCORES";

export type BindingDefinition = {
  binding: CommercialBinding;
  label: string;
  /** Para que serve. É o texto de ajuda do ADMIN. */
  purpose: string;
  /**
   * `true` quando a fonte envolve dinheiro.
   *
   * Existe para a guarda e para a interface: as colunas financeiras são
   * preenchidas pelo servidor e apresentadas como leitura, nunca como campos
   * editáveis. Um campo que parece editável e não grava é pior do que texto.
   */
  financial: boolean;
};

const BINDING_DEFS: Readonly<Record<CommercialBinding, BindingDefinition>> = {
  SERVICOS: {
    binding: "SERVICOS",
    label: "Serviços contratados",
    purpose: "Serviço, quantidade, unidade e valor de cada linha da proposta.",
    financial: true,
  },
  INVESTIMENTO: {
    binding: "INVESTIMENTO",
    label: "Investimento",
    purpose: "Composição do valor: subtotal, ajuste, total e opcionais.",
    financial: true,
  },
  ESCOPO: {
    binding: "ESCOPO",
    label: "Escopo",
    purpose: "O que entra em cada serviço e o que fica de fora.",
    financial: false,
  },
  PAGAMENTO: {
    binding: "PAGAMENTO",
    label: "Condições de pagamento",
    purpose: "Parcelas, percentuais e valores do plano congelado.",
    financial: true,
  },
  CRONOGRAMA: {
    binding: "CRONOGRAMA",
    label: "Cronograma",
    purpose: "Etapas do serviço com duração e sequência.",
    financial: false,
  },
  OPCORES: {
    binding: "OPCORES",
    label: "Opções",
    purpose: "Comparação entre o que é obrigatório e o que é opcional.",
    financial: true,
  },
};

export const COMMERCIAL_BINDINGS: readonly BindingDefinition[] = Object.values(BINDING_DEFS);

export function isCommercialBinding(value: unknown): value is CommercialBinding {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BINDING_DEFS, value);
}

export function getBinding(binding: CommercialBinding): BindingDefinition {
  return BINDING_DEFS[binding];
}

/* -------------------------------------------------------------------------- */
/* ENTRADA ESTREITA                                                            */
/* -------------------------------------------------------------------------- */

/**
 * O que este módulo precisa da `ProposalVersion`.
 *
 * Deliberadamente estreita, e com os decimais já convertidos: o módulo não
 * recebe a linha do Prisma, recebe o que pode ler. Assim não há caminho para
 * ele inventar um total a partir de outro campo, nem para aceder a dados que a
 * apresentação não pode mostrar.
 */
export type CommercialSource = {
  /** `ProposalVersion.services` (Json). */
  services: unknown;
  /** `ProposalVersion.subtotal`, já convertido para número. */
  subtotal: number;
  /** `ProposalVersion.adjustment`, já convertido para número. */
  adjustment: number;
  /** `ProposalVersion.total`, já convertido para número. */
  total: number;
  /** `ProposalVersion.paymentPlan` (Json): o plano CONGELADO. */
  paymentPlan: unknown;
};

/**
 * Coluna de uma tabela ligada.
 *
 * `numeric` marca as que são dinheiro. Não é decoração: a interface usa-o para
 * alinhar à direita e para não oferecer edição. Sem isto, o alinhamento seria
 * uma convenção visual que o utilizador teria de adivinhar.
 */
export type BoundColumn = { title: string; numeric: boolean };

/** Uma linha. As chaves são as dos `columns`, mais as de fecho. */
export type BoundRow = Record<string, string>;

export type BoundTable = {
  columns: BoundColumn[];
  rows: BoundRow[];
  /**
   * Linhas de fecho (TOTAL, OPCIONAIS…).
   *
   * Separadas das linhas de dados porque o peso visual é diferente e porque um
   * total não se edita: é recalculado.
   */
  totals: Array<{ label: string; value: string; emphasis?: boolean }>;
  /** `true` quando a fonte não tem nada a mostrar. Nunca chumba o render. */
  empty: boolean;
};

/** Etapa de cronograma já com duração e sequência. */
export type BoundStep = {
  label: string;
  title: string;
  body: string;
  /** Duração em dias, quando o serviço a declara. */
  days: number | null;
  /** Posição na sequência, a partir de 1. */
  sequence: number;
  /** Observação da etapa: quando começa e quanto dura. */
  note: string;
};

/* -------------------------------------------------------------------------- */
/* LEITURA NORMALIZADA                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Lê os valores comerciais da versão UMA VEZ.
 *
 * Existe para que a proposta, a apresentação e o PDF partilhem a mesma
 * interpretação. `readProposalItems` recalcula o subtotal de cada linha a partir
 * de quantidade × preço, e `readPaymentPlanSnapshot` valida a forma do plano
 * antes de confiar nele — ou seja, nenhum número atravessa esta fronteira sem
 * ter sido verificado.
 */
export type CommercialData = {
  items: ProposalItem[];
  /** Totais recalculados das linhas, para conferência interna. */
  totals: ReturnType<typeof computeTotals>;
  /** Total persistido na versão — a fonte que o cliente aprova. */
  total: number;
  adjustment: number;
  /** Plano congelado, ou `null` quando a versão não tem plano válido. */
  plan: PaymentPlanSnapshot | null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function readCommercialData(source: CommercialSource): CommercialData {
  const items = readProposalItems(source.services);
  const adjustment = toNumber(source.adjustment);
  return {
    items,
    totals: computeTotals(items, adjustment),
    total: toNumber(source.total),
    adjustment,
    plan: readPaymentPlanSnapshot(source.paymentPlan),
  };
}

/* -------------------------------------------------------------------------- */
/* TABELAS LIGADAS                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ordem comercial das linhas.
 *
 * A ordem é o campo `order`, não a posição no array: o servidor pode ter
 * guardado as linhas por ordem de inserção, e a proposta tem de mostrar sempre a
 * mesma sequência que o contrato.
 */
function byOrder(a: ProposalItem, b: ProposalItem): number {
  return a.order - b.order;
}

/** Uma linha de serviço em texto, partilhada por `SERVICOS` e `INVESTIMENTO`. */
function serviceRow(item: ProposalItem): BoundRow {
  return {
    name: item.name,
    discipline: item.discipline ?? "",
    quantity: formatQuantity(item.quantity),
    unit: item.unit ?? "",
    unitPrice: formatCurrencyBRL(item.unitPrice),
    subtotal: formatCurrencyBRL(item.subtotal),
  };
}

const SERVICE_COLUMNS: readonly BoundColumn[] = [
  { title: "Serviço", numeric: false },
  { title: "Quantidade", numeric: true },
  { title: "Unidade", numeric: false },
  { title: "Preço unitário", numeric: true },
  { title: "Subtotal", numeric: true },
];

/**
 * Tabela de SERVIÇOS (item 26): uma linha por serviço da proposta.
 *
 * Inclui opcionais, marcados, porque o cliente tem de ver o que existe para
 * poder escolher — mas o total aqui é o CONTRATADO. Somar opcionais seria o erro
 * que o item 71 proíbe.
 */
export function boundServices(data: CommercialData): BoundTable {
  const ordered = [...data.items].sort(byOrder);
  return {
    columns: [...SERVICE_COLUMNS],
    rows: ordered.map(serviceRow),
    totals: [
      { label: "Subtotal contratado", value: formatCurrencyBRL(data.totals.contractedSubtotal) },
      ...(data.totals.optionalSubtotal > 0
        ? [{ label: "Opcionais (não contratados)", value: formatCurrencyBRL(data.totals.optionalSubtotal) }]
        : []),
      { label: "Total", value: formatCurrencyBRL(data.total), emphasis: true },
    ],
    empty: ordered.length === 0,
  };
}

/**
 * Tabela de INVESTIMENTO (item 29).
 *
 * A diferença para `boundServices` é que aqui a composição é o assunto: só
 * entram as linhas CONTRATADAS, o ajuste é o desconto comercial real e o total
 * é o que a `ProposalVersion` gravou. Opcionais ficam na secção de fecho, sem
 * entrar no total.
 */
export function boundInvestment(data: CommercialData): BoundTable {
  const contracted = data.items.filter((item) => !item.optional).sort(byOrder);
  return {
    columns: [...SERVICE_COLUMNS],
    rows: contracted.map(serviceRow),
    totals: [
      { label: "Subtotal", value: formatCurrencyBRL(data.totals.contractedSubtotal) },
      ...(data.adjustment !== 0
        ? [
            {
              label: data.adjustment < 0 ? "Desconto" : "Acréscimo",
              value: formatCurrencyBRL(data.adjustment),
            },
          ]
        : []),
      ...(data.totals.optionalSubtotal > 0
        ? [{ label: "Opcionais (a acrescer)", value: formatCurrencyBRL(data.totals.optionalSubtotal) }]
        : []),
      { label: "Total", value: formatCurrencyBRL(data.total), emphasis: true },
    ],
    empty: contracted.length === 0,
  };
}

/**
 * Tabela de ESCOPO: o que cada serviço inclui e exclui.
 *
 * É a única fonte ligada que não é money — e por isso a que serve para mostrar
 * escopo sem o risco de um valor inventado. Linhas sem scope e sem exclusões
 * são omitidas em vez de aparecerem vazias: uma linha vazia ocupa espaço na
 * proposta e não informa o cliente de nada.
 */
export function boundScope(data: CommercialData): BoundTable {
  const ordered = [...data.items].sort(byOrder).filter((item) => item.scope || item.exclusions);
  return {
    columns: [
      { title: "Serviço", numeric: false },
      { title: "Inclui", numeric: false },
      { title: "Não inclui", numeric: false },
      { title: "Prazo", numeric: false },
    ],
    rows: ordered.map((item) => ({
      name: item.name,
      scope: item.scope ?? "",
      exclusions: item.exclusions ?? "",
      days: item.estimatedDays ? `${item.estimatedDays} dias` : "",
    })),
    totals: [],
    empty: ordered.length === 0,
  };
}

/**
 * Tabela de PAGAMENTO (item 30).
 *
 * Sai do plano CONGELADO, nunca do texto livre `formaPagamento`: o texto é o que
 * o ADMIN escreve, e o plano congelado é o que o cliente aprova. É também o que
 * `resolvePaymentPlanForVersion` garante ao escolher a fonte.
 *
 * A coluna de valor vem de `installment.amount`, que já absorveu a diferença de
 * arredondamento na última parcela. É isso que garante que a soma das parcelas
 * mostradas é exactamente o total mostrado ao lado.
 */
export function boundPayment(data: CommercialData): BoundTable {
  const installments = [...(data.plan?.installments ?? [])].sort((a, b) => a.order - b.order);
  return {
    columns: [
      { title: "#", numeric: false },
      { title: "Marco", numeric: false },
      { title: "Percentual", numeric: true },
      { title: "Valor", numeric: true },
    ],
    rows: installments.map((installment) => ({
      order: String(installment.order),
      label: installment.label,
      percent: `${formatQuantity(installment.percent)}%`,
      amount: formatCurrencyBRL(installment.amount),
    })),
    totals: [{ label: "Total", value: formatCurrencyBRL(data.total), emphasis: true }],
    empty: installments.length === 0,
  };
}

/* -------------------------------------------------------------------------- */
/* CRONOGRAMA LIGADO (item 28)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Prazo assumido quando o serviço não declara um.
 *
 * A alternativa — omitir a etapa — partia a sequência e deixava o cliente sem
 * prever o fim da obra, o que é pior do que um prazo estimado, desde que seja
 * declarado como tal. O valor é visível na nota da etapa.
 */
export const DEFAULT_SERVICE_DAYS = 15;

/**
 * Cronograma derivado das ETAPAS dos serviços.
 *
 * A duração vem de `estimatedDays`, herdado do catálogo e congelado na versão. A
 * sequência é ACUMULADA: cada etapa começa quando a anterior termina. É o que faz
 * a apresentação actualizar sozinha quando o cronograma comercial muda — mudar
 * um prazo no catálogo muda a apresentação, porque nada foi escrito à mão.
 */
export function boundSchedule(data: CommercialData): BoundStep[] {
  let day = 0;
  return [...data.items].sort(byOrder).map((item, index) => {
    const days = item.estimatedDays && item.estimatedDays > 0 ? item.estimatedDays : DEFAULT_SERVICE_DAYS;
    const start = day;
    day += days;
    return {
      label: String(index + 1).padStart(2, "0"),
      title: item.name,
      body: item.description ?? item.scope ?? "",
      days,
      sequence: index + 1,
      note: start === 0 ? `Início (dia 1) · ${days} dias` : `Dia ${start + 1} · ${days} dias`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* COMPARATIVO DE OPÇÕES (item 27)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Lado de um comparativo de opções.
 *
 * Os VALORES são derivados das linhas da proposta; só os benefícios, as
 * condições e a recomendação são texto do autor. É a separação que o item 27
 * exige: a opção continua ligada à estrutura comercial enquanto o ADMIN escreve
 * o argumento que a acompanha.
 */
export type BoundOption = {
  title: string;
  /** SOMA das linhas desta opção. Vem da proposta. */
  value: string;
  /** Serviços que compõem a opção — também da proposta. */
  services: string[];
  /** `true` na opção que o ADMIN recomenda. */
  highlight: boolean;
  /** Texto da recomendação, quando esta opção é a recomendada. */
  recommendation: string | null;
};

export function boundOptions(data: CommercialData): BoundOption[] {
  const required = data.items.filter((item) => !item.optional).sort(byOrder);
  const optional = data.items.filter((item) => item.optional).sort(byOrder);

  /**
   * Soma das linhas que COMPÕM a opção.
   *
   * Não usa `computeTotals`: essa função, por desenho (item 71), deixa os
   * opcionais FORA do total. Aqui o que interessa é o preço de um conjunto
   * concreto de serviços — e a opção alargada inclui precisamente os opcionais
   * que a essencial deixa de fora. Passá-los por `computeTotals` devolveria o
   * mesmo valor nas duas opções, e um comparativo que não difere é inútil.
   */
  const soma = (items: ProposalItem[]): number => round2(items.reduce((total, item) => total + item.subtotal, 0));

  const sides: BoundOption[] = [
    {
      title: "OPÇÃO 01",
      value: formatCurrencyBRL(soma(required)),
      services: required.map((item) => item.name),
      highlight: true,
      recommendation: "Recomendada: é o mínimo que entrega o projeto completo.",
    },
  ];

  if (optional.length > 0) {
    sides.push({
      title: "OPÇÃO 02",
      value: formatCurrencyBRL(soma([...required, ...optional])),
      services: optional.map((item) => item.name),
      highlight: false,
      recommendation: null,
    });
  }

  return sides;
}

/* -------------------------------------------------------------------------- */
/* RESOLVEDOR                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * RESOLVEDOR de cada fonte ligada.
 *
 * Uma entrada por fonte, e `resolveBinding` é o único ponto de entrada. É o que
 * garante que nenhuma interface construa linhas ela própria — que era
 * exactamente o defeito que esta camada vem resolver.
 *
 * `CRONOGRAMA` e `OPCORES` não são tabelas: quem os pedir usa `boundSchedule` ou
 * `boundOptions`. aqui caem de propósito numa tabela de escopo em vez de
 * lançarem — um `binding` gravado com uma fonte que ainda não tenha resolvedor
 * não pode partir a página do cliente de uma proposta já enviada.
 */
const RESOLVERS: Readonly<Record<CommercialBinding, (data: CommercialData) => BoundTable>> = {
  SERVICOS: boundServices,
  INVESTIMENTO: boundInvestment,
  ESCOPO: boundScope,
  PAGAMENTO: boundPayment,
  CRONOGRAMA: boundScope,
  OPCORES: boundInvestment,
};

export function resolveBinding(binding: CommercialBinding, data: CommercialData): BoundTable {
  return (RESOLVERS[binding] ?? boundScope)(data);
}

/** Verdadeiro quando a fonte apresenta-se como etapas e não como tabela. */
export function isTimelineBinding(binding: CommercialBinding): boolean {
  return binding === "CRONOGRAMA";
}

/** Verdadeiro quando a fonte apresenta-se como comparativo de opções. */
export function isOptionsBinding(binding: CommercialBinding): boolean {
  return binding === "OPCORES";
}

/* -------------------------------------------------------------------------- */
/* GUARDA DE HONESTIDADE                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Erro de conteúdo comercial do Studio.
 *
 * Tem nome próprio para o editor distinguir "a IA tentou escrever um preço à
 * mão" (mostrar junto ao comando, com o campo a corrigir) de "o servidor
 * falhou". Uma `instanceof` resolve os dois sem parsing de mensagem.
 */
export class CommercialBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommercialBindingError";
  }
}

/**
 * Recusa um elemento ligado que transporta valores escritos à mão.
 *
 * É a garantia de que a ligação é real. Um elemento com `binding` tem as suas
 * linhas resolvidas pelo servidor; se também guarda `columns`/`rows` próprias,
 * há duas fontes para o mesmo número e a apresentação pode mostrar a errada.
 *
 * O critério é `financial`, não "tem texto": um `ESCOPO` ligado pode trazer uma
 * legenda escrita pelo autor sem que isso seja inventar um valor. O que é
 * proibido é dinheiro escrito à mão num elemento que o servidor já alimenta.
 */
export function assertBindingIsHonest(element: {
  binding?: CommercialBinding | null;
  columns?: readonly string[] | null;
  rows?: readonly (readonly string[])[] | null;
}): void {
  const binding = element.binding;
  if (!isCommercialBinding(binding)) return;

  const definition = getBinding(binding);
  const handwritten = (element.columns?.length ?? 0) > 0 && (element.rows?.length ?? 0) > 0;
  if (definition.financial && handwritten) {
    throw new CommercialBindingError(
      `“${definition.label}” está ligado aos dados da proposta, mas também tem linhas escritas à mão. ` +
        "Os valores comerciais vêm da ProposalVersion — apague as linhas manuais para ver os valores oficiais.",
    );
  }
}