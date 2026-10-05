/**
 * FASE 4C — REGISTO DE ELEMENTOS (item 25).
 *
 * O item 25 lista vinte elementos e diz, na mesma frase, para não implementar
 * dezenas de pouco usados. Este registo é a resposta: só entram os que uma
 * proposta de arquitectura/interiores/engenharia usa de facto, e cada um
 * declara EM QUE LAYOUTS faz sentido — que é o que impede o editor de oferecer
 * um gráfico numa capa.
 *
 * Duas decisões:
 *
 *  1. **O registo é a ÚNICA lista.** O painel de inserção, o "adicionar
 *     elemento", as sugestões da IA e a validação de layout leem esta tabela.
 *     Uma segunda lista num componente divergiria na primeira alteração.
 *
 *  2. **Elemento ausente é `null`, não exceção.** O item 21 é executado
 *     separadamente, e o transform é metadata: não há um "elemento de recorte"
 *     porque recorte não é um elemento da página, é um ajuste de uma imagem.
 */

/** Elementos que uma página pode conter. */
export type ElementKind =
  | "text"
  | "image"
  | "gallery"
  | "cards"
  | "table"
  | "timeline"
  | "comparison"
  | "metric"
  | "cta";

export type ElementDefinition = {
  kind: ElementKind;
  label: string;
  /** Para que serve, em uma frase. É o texto de ajuda. */
  purpose: string;
  /** Categorias da interface, para não mostrar vinte botões alinhados. */
  group: "CONTEUDO" | "ESTRUTURA" | "COMERCIAL" | "MEDIA";
  /** Número máximo razoável numa página. `null` = sem limite prático. */
  perSlide: number | null;
};

const el = (
  kind: ElementKind,
  label: string,
  purpose: string,
  group: ElementDefinition["group"],
  perSlide: number | null,
): ElementDefinition => ({ kind, label, purpose, group, perSlide });
/**
 * CATÁLOGO DE ELEMENTOS.
 *
 * `text` cobre texto, título, subtítulo, legenda, badge e citação: são o mesmo
 * elemento com papéis diferentes (`TextRole`), e tratá-los como sete
 * elementos daria sete botões que fariam a mesma coisa.
 */
export const ELEMENTS: Readonly<Record<ElementKind, ElementDefinition>> = {
  text: el("text", "Texto", "Título, parágrafo, legenda ou citação.", "CONTEUDO", 6),
  image: el("image", "Imagem", "Uma imagem, lateral, de fundo ou em ecrã inteiro.", "MEDIA", 3),
  gallery: el("gallery", "Galeria", "Várias imagens em conjunto.", "MEDIA", 2),
  cards: el("cards", "Cards", "Itens curtos com título e descrição.", "ESTRUTURA", 6),
  table: el("table", "Tabela", "Comparação de valores linha a linha.", "ESTRUTURA", 1),
  timeline: el("timeline", "Timeline", "Processo por fases no tempo.", "ESTRUTURA", 1),
  comparison: el("comparison", "Comparativo", "Duas opções lado a lado.", "ESTRUTURA", 1),
  metric: el("metric", "Destaque", "Isola um número que o cliente deve reter.", "COMERCIAL", 3),
  cta: el("cta", "Botão de acção", "Pede uma decisão clara.", "COMERCIAL", 1),
};

export const ELEMENT_ORDER: readonly ElementKind[] = [
  "text",
  "image",
  "gallery",
  "cards",
  "table",
  "timeline",
  "comparison",
  "metric",
  "cta",
];

/**
 * Elementos que FAZEM SENTIDO num layout.
 *
 * É o que impede o botão "gráfico" de aparecer na capa. Um layout sem slot
 * para `table` não deve receber uma tabela — e `replaceLayout` já recusa essa
 * troca; aqui é o mesmo filtro, visto do lado da inserção.
 */
export function elementsForLayout(layoutSlots: readonly string[]): ElementDefinition[] {
  return ELEMENT_ORDER.map((kind) => ELEMENTS[kind]).filter((definition) =>
    layoutSlots.includes(definition.kind),
  );
}

/** Categorias presentes, para o editor mostrar apenas o que tem conteúdo. */
export function elementGroups(elements: readonly ElementDefinition[]): Array<{
  group: ElementDefinition["group"];
  items: ElementDefinition[];
}> {
  const groups: ElementDefinition["group"][] = ["CONTEUDO", "MEDIA", "ESTRUTURA", "COMERCIAL"];
  return groups
    .map((group) => ({ group, items: elements.filter((item) => item.group === group) }))
    // Um grupo vazio não ocupa espaço no painel: é a regra do item 9 sobre
    // "evitar ferramentas excessivas na tela ao mesmo tempo".
    .filter((entry) => entry.items.length > 0);
}

/**
 * Diz se ainda cabe outro elemento deste tipo.
 *
 * `false` acima do limite do registo, para o botão de inserção se desligar em
 * vez de o utilizador encher a página até o texto deixar de caber.
 */
export function canAddElement(kind: ElementKind, current: readonly { kind: string }[]): boolean {
  const limit = ELEMENTS[kind].perSlide;
  if (limit === null) return true;
  return current.filter((element) => element.kind === kind).length < limit;
}