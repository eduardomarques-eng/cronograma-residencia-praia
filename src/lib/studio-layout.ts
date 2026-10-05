/**
 * FASE 4C — REGISTO DE LAYOUTS (itens 10 e 11).
 *
 * Um layout é DADO, não um `switch` dentro de cada página. Cada entrada declara
 * os slots que aceita e que tipos de elemento lhe servem; o renderizador, o
 * "Melhorar layout" e a IA leem a MESMA tabela. Se o layout estivesse
 * codificado na página, trocar um layout significaria reescrever o componente —
 * e o item 10 proíbe exactamente isso.
 *
 * `slots` é a restrição que dá sentido ao layout: `cover` não aceita uma
 * tabela, `table` não aceita uma galeria. Sem isto, "escolher layout" seria
 * "escolher um invólucro que deforma o conteúdo".
 */

export type LayoutKey =
  | "cover"
  | "title-text"
  | "text-image"
  | "image-text"
  | "image-full"
  | "image-background"
  | "two-columns"
  | "three-columns"
  | "four-cards"
  | "cards-asymmetric"
  | "list"
  | "metric-highlight"
  | "table-highlight"
  | "comparison"
  | "timeline"
  | "process"
  | "gallery"
  | "before-after"
  | "services"
  | "scope"
  | "investment"
  | "payment-conditions"
  | "cta"
  | "closing";

/** Tipos de elemento que um layout consegue apresentar sem deformar. */
export type LayoutSlot = "text" | "image" | "gallery" | "cards" | "table" | "timeline" | "comparison" | "metric" | "cta";

export type LayoutDefinition = {
  key: LayoutKey;
  label: string;
  /** Para que serve, em português simples. É o texto de ajuda do ADMIN. */
  purpose: string;
  slots: readonly LayoutSlot[];
  /** Quantos elementos deste tipo a composição apresenta bem. */
  comfortable: Partial<Record<LayoutSlot, number>>;
  /** Palavras que, no texto, sugerem este layout. Usadas pelo "Melhorar layout". */
  hints: readonly string[];
};

const def = (
  key: LayoutKey,
  label: string,
  purpose: string,
  slots: readonly LayoutSlot[],
  comfortable: Partial<Record<LayoutSlot, number>>,
  hints: readonly string[] = [],
): LayoutDefinition => ({ key, label, purpose, slots, comfortable, hints });

export type LayoutCategory = "ABERTURA" | "CONTEUDO" | "ESTRUTURA" | "COMERCIAL" | "FECHAMENTO";

/** Categoria usada só para organizar o painel de layouts na interface. */
export const LAYOUT_CATEGORY: Readonly<Record<LayoutKey, LayoutCategory>> = {
  cover: "ABERTURA",
  "title-text": "CONTEUDO",
  "text-image": "CONTEUDO",
  "image-text": "CONTEUDO",
  "image-full": "CONTEUDO",
  "image-background": "CONTEUDO",
  "two-columns": "ESTRUTURA",
  "three-columns": "ESTRUTURA",
  "four-cards": "ESTRUTURA",
  "cards-asymmetric": "ESTRUTURA",
  list: "ESTRUTURA",
  "metric-highlight": "ESTRUTURA",
  "table-highlight": "ESTRUTURA",
  comparison: "ESTRUTURA",
  timeline: "ESTRUTURA",
  process: "ESTRUTURA",
  gallery: "CONTEUDO",
  "before-after": "CONTEUDO",
  services: "COMERCIAL",
  scope: "COMERCIAL",
  investment: "COMERCIAL",
  "payment-conditions": "COMERCIAL",
  cta: "FECHAMENTO",
  closing: "FECHAMENTO",
};
/**
 * CATÁLOGO DE LAYOUTS.
 *
 * O item 10 pede 23 layouts e o item 13 proíbe criar dezenas de temas sem
 * necessidade; o mesmo princípio vale para layouts: existem os 23 pedidos, e
 * não um a mais. Acrescentar um layout novo é uma entrada nova aqui — nenhum
 * componente precisa de mudar.
 */
export const LAYOUTS: Readonly<Record<LayoutKey, LayoutDefinition>> = {
  cover: def(
    "cover",
    "Capa",
    "Abre a apresentação com título, cliente e imagem.",
    ["text", "image", "metric"],
    { text: 2, image: 1, metric: 1 },
    ["capa", "proposta", "apresentação"],
  ),
  "title-text": def(
    "title-text",
    "Título + texto",
    "Uma ideia por página, sem imagem.",
    ["text", "metric"],
    { text: 3, metric: 1 },
    ["contexto", "diagnóstico", "objetivo", "entendimento"],
  ),
  "text-image": def(
    "text-image",
    "Texto + imagem",
    "Explica à esquerda, mostra à direita.",
    ["text", "image", "metric"],
    { text: 2, image: 1, metric: 1 },
    ["escopo", "conceito", "referência"],
  ),
  "image-text": def(
    "image-text",
    "Imagem + texto",
    "Mostra primeiro, explica depois.",
    ["image", "text", "metric"],
    { image: 1, text: 2, metric: 1 },
    ["ambiente", "resultado", "depois"],
  ),
  "image-full": def(
    "image-full",
    "Imagem em ecrã inteiro",
    "Deixa a imagem falar.",
    ["image"],
    { image: 1 },
    ["portfólio", "render", "final"],
  ),
  "image-background": def(
    "image-background",
    "Imagem de fundo",
    "Texto sobre imagem, com sobreposição.",
    ["image", "text"],
    { image: 1, text: 2 },
    ["destaque", "fachada", "hero"],
  ),
  "two-columns": def(
    "two-columns",
    "Duas colunas",
    "Compara ou separa dois assuntos.",
    ["text", "cards", "metric"],
    { cards: 2, text: 2, metric: 2 },
    ["duas opções", "antes e depois", "separado"],
  ),
  "three-columns": def(
    "three-columns",
    "Três colunas",
    "Três ideias de peso igual.",
    ["cards", "text"],
    { cards: 3, text: 3 },
    ["processo", "etapas", "pilares"],
  ),
  "four-cards": def(
    "four-cards",
    "Quatro cards",
    "Quatro itens em grade.",
    ["cards"],
    { cards: 4 },
    ["serviços", "escopo", "inclui"],
  ),
  "cards-asymmetric": def(
    "cards-asymmetric",
    "Cards assimétricos",
    "Destaque um item e apoie os restantes.",
    ["cards", "image"],
    { cards: 3, image: 1 },
    ["destaque", "principal"],
  ),
  list: def(
    "list",
    "Lista",
    "Enumeração curta e legível.",
    ["text"],
    { text: 3 },
    ["incluído", "não incluído", "requisitos", "premissas"],
  ),
  "metric-highlight": def(
    "metric-highlight",
    "Destaque numérico",
    "Isola um número que o cliente deve reter.",
    ["metric", "text"],
    { metric: 1, text: 1 },
    ["investimento", "total", "prazo", "área", "destaque"],
  ),
  "table-highlight": def(
    "table-highlight",
    "Tabela",
    "Comparação de valores linha a linha.",
    ["table", "text"],
    { table: 1, text: 1 },
    ["tabela", "comparação de preços", "discriminação"],
  ),
comparison: def(
    "comparison",
    "Comparativo",
    "Duas opções lado a lado.",
    ["comparison"],
    { comparison: 1 },
    ["comparativo", "opções", "alternativas"],
  ),
  timeline: def(
    "timeline",
    "Timeline",
    "Processo por fases no tempo.",
    ["timeline", "text"],
    { timeline: 1, text: 1 },
    ["cronograma", "prazos", "etapas", "tempo"],
  ),
  process: def(
    "process",
    "Processo",
    "Como o trabalho avança.",
    ["cards", "timeline"],
    { cards: 3, timeline: 1 },
    ["processo", "método", "como trabalhamos"],
  ),
  gallery: def(
    "gallery",
    "Galeria",
    "Várias imagens de uma vez.",
    ["gallery", "image"],
    { gallery: 1, image: 4 },
    ["galeria", "imagens", "referências"],
  ),
  "before-after": def(
    "before-after",
    "Antes / depois",
    "Mostra a transformação.",
    ["gallery", "image", "text"],
    { image: 2, text: 1, gallery: 1 },
    ["antes", "depois", "transformação"],
  ),
  services: def(
    "services",
    "Serviços",
    "Serviços contratados com escopo.",
    ["cards", "table", "text"],
    { cards: 3, table: 1, text: 1 },
    ["serviços", "contratado", "escopo"],
  ),
  scope: def(
    "scope",
    "Escopo",
    "O que entra e o que não entra.",
    ["cards", "text"],
    { cards: 2, text: 3 },
    ["escopo", "incluído", "excluído", "premissas"],
  ),
  investment: def(
    "investment",
    "Investimento",
    "O valor e o que o compõe.",
    ["table", "metric", "text"],
    { metric: 1, table: 1, text: 1 },
    ["investimento", "valores", "orçamento", "preço"],
  ),
  "payment-conditions": def(
    "payment-conditions",
    "Condições de pagamento",
    "Parcelas e condições.",
    ["table", "text", "metric"],
    { table: 1, text: 1, metric: 1 },
    ["pagamento", "parcelas", "condições"],
  ),
  cta: def(
    "cta",
    "CTA",
    "Pede uma decisão clara.",
    ["cta", "text"],
    { cta: 1, text: 1 },
    ["próximos passos", "aceite", "decisão", "avançar"],
  ),
  closing: def(
    "closing",
    "Encerramento",
    "Fecha com identidade e contacto.",
    ["text", "image", "cta"],
    { text: 2, image: 1, cta: 1 },
    ["encerramento", "obrigado", "fim"],
  ),
};

/** Ordem de apresentação do catálogo na interface. */
export const LAYOUT_ORDER: readonly LayoutKey[] = Object.keys(LAYOUTS) as LayoutKey[];

export function isLayoutKey(value: unknown): value is LayoutKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LAYOUTS, value);
}

export function getLayout(key: LayoutKey): LayoutDefinition {
  return LAYOUTS[key];
}

/**
 * Layouts que conseguem apresentar um conjunto de elementos sem os deformar.
 *
 * É o que permite ao editor desligar botões em vez de gerar uma página onde a
 * tabela fica esmagada num slot de imagem.
 */
export function layoutsAccepting(kinds: readonly LayoutSlot[]): LayoutKey[] {
  const unique = Array.from(new Set(kinds));
  return LAYOUT_ORDER.filter((key) => unique.every((kind) => LAYOUTS[key].slots.includes(kind)));
}

/** O layout mais próximo quando a chave guardada já não existe no catálogo. */
export function resolveLayout(key: unknown): LayoutKey {
  return isLayoutKey(key) ? key : "title-text";
}
