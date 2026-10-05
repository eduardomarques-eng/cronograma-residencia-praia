/**
 * FASE 4D — ELEMENTOS COMERCIAIS (item 46).
 *
 * O item 46 pede componentes que "entendem que estão dentro de uma proposta", em
 * vez de transformarem tudo em texto puro. A tentação seria resolver isto com mais
 * `cards` e mais `text`, e o resultado seria uma proposta que parece uma
 * apresentação de Yehová sobre reatores — o número existe, mas nada indica que é
 * um investimento, uma parcela ou um escopo.
 *
 * A decisão é que estes componentes são uma APARÊNCIA sobre os dados que
 * `studio-commercial` já resolve. Nenhum deles calcula, arredonda ou decide: todos
 * consomem `CommercialData` e desenham. É o que garante que o valor mostrado aqui
 * e o valor do contrato são o mesmo — não duas implementações da mesma conta.
 *
 * Por isso este módulo não tem lógica comercial. Se alguma vez precisar de ter,
 * é sinal de que a fonte de verdade se perdeu pelo caminho.
 */

import type { CommercialBinding, CommercialData } from "./studio-commercial";
import {
  boundOptions,
  boundSchedule,
  resolveBinding,
  type BoundTable,
  type BoundOption,
  type BoundStep,
} from "./studio-commercial";

/**
 * Os dados que um componente comercial consome.
 *
 * É `CommercialData | null` e não `CommercialData`: o Studio funciona sem
 * proposta associada (item 36 — começar em branco), e um componente que.launcha
 * por falta de dados transformaria "ainda não há proposta" num ecrã de erro.
 */
export type CommercialProps = {
  data: CommercialData | null;
  /** Elemento que originou o componente, para o editor ligar a peça ao original. */
  elementId?: string;
};

/**
 * Uma peça comercial identificada.
 *
 * O `binding` é o que permite ao editor saber que esta peça mostra números da
 * proposta. É também o que impede o autor de a tratar como texto: uma peça
 * ligada não tem conteúdo próprio, e é isso que o `studio-commercial` garante.
 */
export type CommercialPiece = {
  binding: CommercialBinding;
  elementId?: string;
};

export type SmartElementKind =
  | "INVESTMENT"
  | "SERVICE_LIST"
  | "COMPARISON"
  | "PAYMENT_PLAN"
  | "TIMELINE"
  | "SCOPE"
  | "CTA";

/**
 * Que componente comercial corresponde a cada elemento do Studio.
 *
 * É a TABELA ÚNICA. Sem ela, cada tela teria o seu próprio `switch` de "isto é
 * um investimento?" — e a lista divergiria na primeira alteração, que é
 * exactamente o modo de falha que a `studio-elements` já documenta.
 */
export const SMART_ELEMENTS: Readonly<Record<SmartElementKind, { label: string; binding: CommercialBinding | null; purpose: string }>> = {
  INVESTMENT: {
    label: "Investimento",
    binding: "INVESTIMENTO",
    purpose: "Composição do valor, com subtotal, desconto, opcionais e total.",
  },
  SERVICE_LIST: {
    label: "Lista de serviços",
    binding: "SERVICOS",
    purpose: "Serviço, quantidade, unidade, preço e subtotal.",
  },
  COMPARISON: {
    label: "Comparativo de opções",
    binding: "OPCORES",
    purpose: "Lado a lado, com o valor de cada opção vindo da proposta.",
  },
  PAYMENT_PLAN: {
    label: "Plano de pagamento",
    binding: "PAGAMENTO",
    purpose: "Parcelas com percentual e valor do plano congelado.",
  },
  TIMELINE: {
    label: "Cronograma",
    binding: "CRONOGRAMA",
    purpose: "Etapas com duração acumulada a partir dos prazos dos serviços.",
  },
  SCOPE: {
    label: "Escopo",
    binding: "ESCOPO",
    purpose: "O que cada serviço inclui e exclui.",
  },
  CTA: {
    label: "Chamada à acção",
    // `null`: um pedido de decisão não é um valor, e ligar-lo à proposta não faria
    // sentido. Continua a ser conteúdo do autor.
    binding: null,
    purpose: "O que o cliente tem de decidir a seguir.",
  },
};

/**
 * Os dados de uma peça comercial, já resolvidos.
 *
 * Devolve `null` quando não há proposta — e é esse `null` que os componentes
 * usam para dizer "ligue a uma proposta" em vez de mostrarem uma tabela vazia que
 * parece um erro.
 */
export function commercialDataFor(
  piece: CommercialPiece | null,
  data: CommercialData | null,
): { binding: CommercialBinding; data: CommercialData } | null {
  if (!piece || !data) return null;
  return { binding: piece.binding, data };
}

/**
 * A tabela de uma peça, resolvida a partir da proposta.
 *
 * Delega em `resolveBinding` e NÃO repete o `switch`. Esta é uma correção a um
 * erro real: a primeira versão tinha a lista de fontes escrita aqui E em
 * `studio-commercial`, e a segunda cópia divergiu — um `tableFor` que devolveva a
 * tabela de escopo vazia para uma peça de investimento, sem erro nenhum. Era
 * exactamente a classe de bug que a ligação comercial existe para impedir.
 *
 * Delegar garante que não há segunda lista: se amanhã aparecer uma fonte nova,
 * entra uma vez e propaga-se para os dois lados.
 */
export function tableFor(piece: CommercialPiece | null, data: CommercialData | null): BoundTable | null {
  if (!piece || !data) return null;
  return resolveBinding(piece.binding, data);
}

/** As etapas de uma peça de cronograma. */
export function stepsFor(piece: CommercialPiece | null, data: CommercialData | null): BoundStep[] {
  if (!piece || !data) return [];
  return piece.binding === "CRONOGRAMA" ? boundSchedule(data) : [];
}

/** As opções de uma peça de comparativo. */
export function optionsFor(piece: CommercialPiece | null, data: CommercialData | null): BoundOption[] {
  if (!piece || !data) return [];
  return piece.binding === "OPCORES" ? boundOptions(data) : [];
}