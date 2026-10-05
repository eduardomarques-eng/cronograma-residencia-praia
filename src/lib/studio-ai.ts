/**
 * FASE 4C — ÂMBITO DA ALTERAÇÃO PELA IA (item 15) e REMIX (item 12).
 *
 * Este módulo define QUEM pode ser alterado por um comando de IA. É a parte
 * que impede o defeito mais comum e mais caro de um editor assistido: pedir
 * "reescreve só este parágrafo" e ver o texto das outras catorze páginas
 * mudar.
 *
 * O erro de desenho seria tratar "apresentação", "página" e "elemento" como
 * três prompts diferentes. Aqui é UM TIPO, e cada operação diz exactamente que
 * páginas toca. `assertScopeMatchesSelection` recusa a operação quando o
 * comando não bate com o que está seleccionado — o editor mostra então o
 * aviso antes de executar.
 *
 * O item 16 (contexto persistente) vive aqui também: `AiContext` é o que a IA
 * "sabe" numa sessão, e é reconstruído a cada comando a partir do servidor —
 * nunca acumulado no browser, onde um refresh o perderia.
 */

import {
  readStudioDeck,
  stableId,
  StudioContentError,
  toPersistedDeck,
  type DeckOrigin,
  type StudioDeck,
  type StudioElement,
  type StudioSlide,
} from "./studio-deck";
import { DEFAULT_THEME, isThemeKey } from "./studio-theme";
import { signatureOfSlide } from "./studio-perf";

/* -------------------------------------------------------------------------- */
/* ÂMBITO                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A. APRESENTAÇÃO — tudo muda.
 * B. SLIDE — só a página seleccionada.
 * C. ELEMENTO — só o elemento seleccionado.
 *
 * "Quanto menor a seleção, menor deve ser a área alterada" (item 15). A ordem
 * é deliberada: `ELEMENTO` é o mais restrito e é o que o editor assume por
 * omissão, porque é o caso em que o dano é maior se o scope for mal lido.
 */
export type AiScope = "ELEMENTO" | "SLIDE" | "PRESENTACAO";

export const AI_SCOPES: ReadonlyArray<{ key: AiScope; label: string; help: string }> = [
  { key: "ELEMENTO", label: "Elemento", help: "Altera apenas o que está seleccionado." },
  { key: "SLIDE", label: "Página", help: "Altera apenas a página actual." },
  { key: "PRESENTACAO", label: "Apresentação", help: "Altera todas as páginas." },
];

/** O que o ADMIN tem seleccionado quando emite o comando. */
export type AiSelection =
  | { kind: "ELEMENTO"; slideId: string; elementId: string }
  | { kind: "SLIDE"; slideId: string }
  | { kind: "PRESENTACAO" };

export type AiCommand = {
  scope: AiScope;
  selection: AiSelection;
  /** Instrução em linguagem natural. Nunca é executada como código. */
  instruction: string;
};

/**
 * Confirma que o comando e a selecção são coerentes.
 *
 * Recusa três combinações que produziriam a mesma falha — uma alteração maior
 * do que o ADMIN pediu:
 *
 *  · `ELEMENTO` sem elemento seleccionado;
 *  · `SLIDE` com um `elementId` (o editor mandou o scope errado);
 *  · `PRESENTACAO` com uma página específica (o oposto).
 *
 * Um `StudioContentError` aqui é accionável: a interface diz "selecione um
 * elemento" em vez de falhar a meio da operação.
 */
export function assertScopeMatchesSelection(command: AiCommand): void {
  const { scope, selection } = command;

  if (scope === "ELEMENTO" && selection.kind !== "ELEMENTO") {
    throw new StudioContentError(
      "O comando foi enviado para um elemento, mas nenhum elemento está seleccionado. Seleccione o texto ou a imagem a alterar.",
    );
  }
  if (scope === "SLIDE" && selection.kind !== "SLIDE") {
    throw new StudioContentError(
      "O comando foi enviado para uma página, mas a selecção é outra. Escolha o âmbito certo.",
    );
  }
  if (scope === "PRESENTACAO" && selection.kind !== "PRESENTACAO") {
    throw new StudioContentError(
      "O comando foi enviado para a apresentação inteira, mas há uma página seleccionada. Escolha o âmbito certo.",
    );
  }
}

/**
 * Páginas que um comando pode tocar.
 *
 * É a lista EFFECTIVA, resolvida a partir do comando — e é ela que as operações
 * vão iterar. Uma operação que escreva fora desta lista não é uma opção: é um
 * bug que o ADMIN só descobre depois de a apresentação estar alterada.
 */
export function affectedSlides(deck: StudioDeck, command: AiCommand): StudioSlide[] {
  assertScopeMatchesSelection(command);
  // A selecção é copiada para uma variável local para o TypeScript estreitar o
  // tipo: a chamada a `assertScopeMatchesSelection` não é reconhecida como
  // refinamento. `PRESENTACAO` é o único caso sem `slideId`.
  const selection: AiSelection = command.selection;
  if (selection.kind === "PRESENTACAO") return deck.slides;

  const target = deck.slides.find((slide) => slide.id === selection.slideId);
  if (!target) {
    throw new StudioContentError("A página seleccionada já não existe nesta apresentação.");
  }
  return [target];
}
/* -------------------------------------------------------------------------- */
/* CONTEXTO PERSISTENTE (item 16)                                              */
/* -------------------------------------------------------------------------- */

/**
 * O que a IA sabe sobre esta proposta.
 *
 * Todos os campos são resolvidos NO SERVIDOR a partir da `ProposalVersion`. O
 * item 16 pede que "mude isso" faça sentido; isso exige contexto, e contexto
 * que mora no browser desaparece com um refresh — além de poder divergir do
 * que a proposta diz de facto.
 */
export type AiContext = {
  proposalId: string;
  proposalCode: string | null;
  version: number;
  objective: string;
  projectName: string;
  clientName: string;
  theme: string;
  language: string;
  style: string;
  restrictions: string[];
  /** Títulos das páginas, para a IA saber o que já existe. */
  outline: string[];
};

/**
 * Constrói o contexto a partir do deck e dos dados RESOLVIDOS pelo servidor.
 *
 * `objective` vem do `formalText.object` quando existe e fica VAZIO quando
 * não. Inferir um objetivo é inventar — e um contexto com um objetivo inventado
 * orienta a IA na direcção errada sem que ninguém perceba porquê.
 */
export function buildAiContext(input: {
  proposalId: string;
  proposalCode: string | null;
  version: number;
  clientName: string;
  projectName: string;
  deck: StudioDeck;
  formalText: Record<string, unknown>;
  restrictions?: string[];
}): AiContext {
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

  const declared = input.formalText.premisses;
  const fromPremisses = Array.isArray(declared)
    ? declared.map(text).filter(Boolean)
    : text(declared)
      ? [text(declared)]
      : [];

  return {
    proposalId: input.proposalId,
    proposalCode: input.proposalCode,
    version: input.version,
    objective: text(input.formalText.object),
    projectName: input.projectName,
    clientName: input.clientName,
    theme: isThemeKey(input.deck.theme) ? input.deck.theme : DEFAULT_THEME,
    language: "pt-BR",
    // O estilo vem do TEMA escolhido. Não é uma adjectivação que um modelo
    // inventa: é o tema que o ADMIN escolheu, dito de outra forma.
    style: input.deck.theme,
    restrictions: input.restrictions ?? fromPremisses,
    outline: input.deck.slides.map((slide) => slide.title || slide.eyebrow || "(sem título)"),
  };
}
/* -------------------------------------------------------------------------- */
/* REMIX (item 12)                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cria uma NOVA apresentação a partir de outra.
 *
 * Três garantias, e as três são exigidas pelo item 12:
 *
 *  1. **A origem fica intacta.** Não muta nada: devolve um deck novo, com
 *     objectos de página novos.
 *  2. **O rasto fica registado.** `origin` aponta para a apresentação de
 *     origem, com a versão. Sem isso, daqui a três meses ninguém sabe porque é
 *     que existem duas propostas quase iguais.
 *  3. **Os ids mudam.** Copiar os ids faria a nova e a original partilharem a
 *     identidade de página — e o "restaurar" da original desfaria a remix.
 *     É o oposto de "nunca sobrescrever silenciosamente a original".
 *
 * `mutate` é o que permite "outro perfil de cliente" ou "estilo mais
 * sofisticado": quem chama decide o que muda, dentro do deck novo.
 */
export function remixDeck(input: {
  source: StudioDeck;
  origin: DeckOrigin;
  /**
   * Distingue esta variação das restantes.
   *
   * Os ids são derivados do conteúdo, e duas remixes da MESMA origem têm o
   * mesmo conteúdo — sem uma chave de variação, as duas presentationes seriam
   * indistinguíveis e o "restaurar" de uma desfaria a outra. O servidor passa
   * aqui o número da nova versão ou um token da sessão; o teste passa um
   * literal. Determinístico, nunca aleatório.
   */
  variantKey: string;
  mutate?: (deck: StudioDeck) => StudioDeck;
}): StudioDeck {
  const { variantKey } = input;
  const renamed = input.source.slides.map((slide, index) => ({
    ...slide,
    // O id deriva da variação, da posição e do conteúdo: a página "s1" da
    // origem nunca volta a ser a página "s1" da remix, e duas remixes nunca
    // partilham identidade.
    id: stableId("slide", variantKey, index, slide.title, slide.body),
    elements: slide.elements.map((element) => ({
      ...element,
      id: stableId("el", variantKey, element.id, index),
    })),
  }));

  const draft: StudioDeck = {
    theme: input.source.theme,
    slides: renamed,
    origin: input.origin,
  };

  return input.mutate ? input.mutate(draft) : draft;
}

/**
 * Prepara uma remix para ser gravada como versão própria.
 *
 * É gravada pelo ADMIN pelo mesmo caminho de `saveProposalVersion` que qualquer
 * outra edição — não existe um atalho que escreva a proposta por baixo dos
 * panos.
 */
export function toRemixPayload(deck: StudioDeck): Record<string, unknown> {
  return toPersistedDeck(deck);
}

/**
 * Todas as imagens usadas no deck, com a origem declarada.
 *
 * Serve ao item 19 ("imagens usadas anteriormente na apresentação") e evita que
 * o editor vá buscar a uma fonte externa uma imagem que já estava noutra
 * página desta mesma proposta.
 */
export function deckImages(
  deck: StudioDeck,
): Array<{ url: string; alt: string; source: string; slideId: string }> {
  const found: Array<{ url: string; alt: string; source: string; slideId: string }> = [];
  deck.slides.forEach((slide) => {
    slide.elements.forEach((element: StudioElement) => {
      if (element.kind === "image") {
        found.push({ url: element.url, alt: element.alt, source: element.source, slideId: slide.id });
      }
      if (element.kind === "gallery") {
        element.images.forEach((image) => {
          found.push({ url: image.url, alt: image.alt, source: image.source, slideId: slide.id });
        });
      }
      if (element.kind === "cards") {
        element.items.forEach((item) => {
          if (item.image) {
            found.push({
              url: item.image.url,
              alt: item.image.alt ?? "",
              source: item.image.source,
              slideId: slide.id,
            });
          }
        });
      }
    });
  });
  return found;
}

/** Lê um deck a partir de uma apresentação gravada. Reexportado por conveniência. */
export { readStudioDeck, StudioContentError };

/* -------------------------------------------------------------------------- */
/* O QUE A IA VÊ (item 15)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O objecto exacto que um comando vai alterar.
 *
 * `affectedSlides` diz QUAIS páginas; isto diz QUAL objecto dentro delas. A
 * diferença é o que permite ao item 15 dizer "re-escreva apenas este
 * parágrafo": sem um alvo resolvido, a única opção seria mandar a página
 * inteira ao modelo e esperar que ele não tocasse no resto.
 */
export type AiTarget =
  | { kind: "PRESENTACAO"; slides: StudioSlide[] }
  | { kind: "SLIDE"; slide: StudioSlide }
  | { kind: "ELEMENTO"; slide: StudioSlide; element: StudioElement };

/**
 * Resolve a selecção num alvo concreto.
 *
 * Lança quando o alvo não existe — a página foi apagada ou o elemento foi
 * removido desde que o utilizador o seleccionou. É preferível a resolver para
 * a apresentação inteira: um comando "este parágrafo" que acabasse a reescrever
 * as catorze páginas seria o pior defeito possível do editor.
 */
export function resolveTarget(deck: StudioDeck, selection: AiSelection): AiTarget {
  if (selection.kind === "PRESENTACAO") return { kind: "PRESENTACAO", slides: deck.slides };

  const slide = deck.slides.find((entry) => entry.id === selection.slideId);
  if (!slide) {
    throw new StudioContentError("A página seleccionada já não existe nesta apresentação.");
  }
  if (selection.kind === "SLIDE") return { kind: "SLIDE", slide };

  const element = slide.elements.find((entry) => entry.id === selection.elementId);
  if (!element) {
    throw new StudioContentError("O elemento seleccionado já não existe nesta página.");
  }
  return { kind: "ELEMENTO", slide, element };
}

/**
 * Texto que o alvo tem hoje.
 *
 * Um comando que chegue ao modelo sem o texto original não pode respeitar
 * "preserve o que eu escrevi". Devolve string vazia quando o alvo não tem
 * texto — e o chamador tem de tratar isso como "não é um comando de texto",
 * não como "texto vazio para melhorar".
 */
export function targetText(target: AiTarget): string {
  if (target.kind === "ELEMENTO" && target.element.kind === "text") return target.element.text;
  if (target.kind === "SLIDE") return target.slide.body;
  return "";
}

/**
 * Descrição do alvo, para o utilizador confirmar antes de carregar.
 *
 * O item 15 diz que a IA tem de saber o que está seleccionado — mas o que
 * importa é o utilizador ter certeza. "Vai alterar: o parágrafo da página 3" é
 * verificável a olho; um comando que "melhora a apresentação" não é.
 */
export function describeTarget(target: AiTarget): string {
  switch (target.kind) {
    case "PRESENTACAO":
      return `A apresentação inteira (${target.slides.length} páginas)`;
    case "SLIDE":
      return `A página "${target.slide.title || "(sem título)"}"`;
    case "ELEMENTO": {
      const kind = target.element.kind;
      if (kind === "text") return `O texto "${truncate(target.element.text)}"`;
      if (kind === "image") return `A imagem (${target.element.source})`;
      if (kind === "gallery") return `A galeria (${target.element.images.length} imagens)`;
      if (kind === "cards") return `Os cards (${target.element.items.length} itens)`;
      if (kind === "table") return `A tabela (${target.element.rows.length} linhas)`;
      if (kind === "timeline") return `A timeline (${target.element.steps.length} passos)`;
      if (kind === "comparison") return `O comparativo (${target.element.sides.length} lados)`;
      if (kind === "metric") return `O destaque "${target.element.label}"`;
      return "O bloco de acção";
    }
  }
}

const truncate = (value: string, max = 40): string =>
  value.length <= max ? value : `${value.slice(0, max)}…`;

/**
 * Confirma que o comando é COERENTE com o alvo.
 *
 * Distingue "não posso" de "não faz sentido": um comando de texto sobre uma
 * imagem é um erro do utilizador, não uma limitação, e a mensagem tem de o
 * dizer.
 */
export function assertTargetMatchesInstruction(target: AiTarget, instruction: string): void {
  const querTexto = /\b(reescrev|reescreve|resum|expand|corrig|texto|parágrafo|párrafo|resumo)\w*/i.test(instruction);
  const querImagem = /\b(imagem|foto|retrato|render)\w*/i.test(instruction);

  if (querTexto && target.kind === "ELEMENTO" && target.element.kind === "image") {
    throw new StudioContentError(
      "O comando pede para reescrever texto, mas está seleccionada uma imagem. Seleccione o texto, ou peça para a imagem.",
    );
  }
  if (querImagem && target.kind === "ELEMENTO" && target.element.kind === "text") {
    throw new StudioContentError(
      "O comando pede para trocar a imagem, mas está seleccionado um texto. Seleccione a imagem.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PREVIEW ORIGINAL vs ALTERADO (item 17)                                      */
/* -------------------------------------------------------------------------- */

/** O que mudou numa página. */
export type SlideChange = {
  slideId: string;
  title: string;
  kind: "INALTERADA" | "TEXTO" | "LAYOUT" | "CONTEUDO" | "NOVA" | "REMOVIDA";
  /** Resumo legível para o painel de comparação. */
  summary: string;
};

export type ChangePreview = {
  changes: SlideChange[];
  added: number;
  removed: number;
  modified: number;
  /**
   * `true` quando NENHUMA página outside do comando foi tocada.
   *
   * É a garantia central do item 17 ("NUNCA aplicar uma alteração destrutiva
   * em toda a apresentação quando o comando é localizado") verificada por
   * código e não por confiança.
   */
  scoped: boolean;
  /** Texto pronto para o botão de confirmar. */
  headline: string;
};

/**
 * Compara dois decks e diz o que mudou.
 *
 * Compara por IDENTIDADE DE PÁGINA, não por índice. Sem isso, inserir uma
 * página no início faria o diff dizer que todas as páginas mudaram — e o
 * utilizador perderia a confiança no painel de comparação.
 */
export function previewChanges(
  original: StudioDeck,
  next: StudioDeck,
  scope?: AiScope,
  selection?: AiSelection,
): ChangePreview {
  const before = new Map(original.slides.map((slide) => [slide.id, slide]));
  const after = new Map(next.slides.map((slide) => [slide.id, slide]));
  const changes: SlideChange[] = [];

  next.slides.forEach((slide) => {
    const beforeSlide = before.get(slide.id);
    if (!beforeSlide) {
      changes.push({ slideId: slide.id, title: slide.title, kind: "NOVA", summary: "Página nova." });
      return;
    }

    const layoutChanged = beforeSlide.layout !== slide.layout;
    const textChanged =
      beforeSlide.title !== slide.title || beforeSlide.body !== slide.body || beforeSlide.eyebrow !== slide.eyebrow;
    const delta = elementDelta(beforeSlide.elements, slide.elements);
    const metaChanged = beforeSlide.notes !== slide.notes || beforeSlide.hidden !== slide.hidden;

    if (!layoutChanged && !textChanged && !delta && !metaChanged) {
      changes.push({ slideId: slide.id, title: slide.title, kind: "INALTERADA", summary: "Sem alterações." });
      return;
    }
    /*
     * A ordem importa: o conteúdo dos elementos é o que o utilizador mais
     * precisa de ver. Comparar o título primeiro diria apenas "texto alterado"
     * para uma troca de imagem ou de célula de uma tabela.
     */
    if (delta) {
      changes.push({ slideId: slide.id, title: slide.title, kind: "CONTEUDO", summary: delta });
      return;
    }
    if (layoutChanged && !textChanged) {
      changes.push({
        slideId: slide.id,
        title: slide.title,
        kind: "LAYOUT",
        summary: `Layout de "${beforeSlide.layout}" para "${slide.layout}".`,
      });
      return;
    }
    if (textChanged && !layoutChanged) {
      changes.push({ slideId: slide.id, title: slide.title, kind: "TEXTO", summary: "Texto alterado." });
      return;
    }
    changes.push({ slideId: slide.id, title: slide.title, kind: "CONTEUDO", summary: "Conteúdo da página alterado." });
  });

  original.slides.forEach((slide) => {
    if (!after.has(slide.id)) {
      changes.push({ slideId: slide.id, title: slide.title, kind: "REMOVIDA", summary: "Página removida." });
    }
  });

  const added = changes.filter((change) => change.kind === "NOVA").length;
  const removed = changes.filter((change) => change.kind === "REMOVIDA").length;
  const modified = changes.length - added - removed - changes.filter((c) => c.kind === "INALTERADA").length;

  /*
   * `scoped` responde a UMA pergunta: alguma página que o comando NÃO podia
   * tocar foi alterada?
   *
   * Para isso é preciso saber QUAL era a página alvo — e é por isso que a
   * selecção entra aqui. Sem ela, todas as páginas contavam como fora do
   * âmbito (incluindo a própria página alvo), e o resultado era `scoped: false`
   * mesmo numa alteração localizada e correcta — o inverso do que o item 17
   * promete. Sem selecção, `scoped` vale para o deck inteiro.
   */
  const scoped = scope
    ? untouchedFor(original, next, scope, selection).every(
        (id) => slideSignature(original, id) === slideSignature(next, id),
      )
    : original.slides.every((slide) => {
        const counterpart = after.get(slide.id);
        return counterpart ? slideSignature(original, slide.id) === slideSignature(next, slide.id) : false;
      });

  const partes = [
    added ? `${added} nova(s)` : "",
    removed ? `${removed} removida(s)` : "",
    modified ? `${modified} alterada(s)` : "",
  ].filter(Boolean);

  return {
    changes,
    added,
    removed,
    modified,
    scoped,
    headline: partes.length ? partes.join(", ") : "Nenhuma alteração.",
  };
}

/**
 * Assinatura de uma página dentro de um deck, para comparar o que o título não mostra.
 *
 * Inclui elementos, notas e visibilidade. Sem os elementos, trocar a imagem de
 * uma página ou mudar uma célula de uma tabela seriam reportados como
 * "inalterada" — uma mentira que faz o ADMIN deixar de confiar no comparativo.
 *
 * É a MESMA regra de `studio-perf`, não uma cópia. As duas decidem coisas
 * diferentes sobre a mesma pergunta — esta diz se o âmbito de uma alteração foi
 * respeitado, aquela diz se vale a pena redesenhar — e divergir entre elas faria
 * o editor saltar o desenho de uma página que mudou. Uma página ausente
 * devolve string vazia, para que "não existe" nunca se confunda com "igual".
 */
function slideSignature(deck: StudioDeck, slideId: string): string {
  const slide = deck.slides.find((entry) => entry.id === slideId);
  return slide ? signatureOfSlide(slide) : "";
}

/**
 * Descreve O QUÊ mudou dentro dos elementos, em português.
 *
 * Devolve string vazia quando não mudou nada — que é diferente de "não sei".
 */
function elementDelta(before: readonly StudioElement[], after: readonly StudioElement[]): string {
  if (before.length === after.length) {
    const changed = after.filter((element, position) => JSON.stringify(element) !== JSON.stringify(before[position]));
    if (changed.length === 0) return "";
    if (changed.length === 1) return `${describeElement(changed[0])} alterado.`;
    return `${changed.length} elementos alterados (${changed.map(describeElement).join(", ")}).`;
  }
  if (after.length > before.length) return `${after.length - before.length} elemento(s) acrescentado(s).`;
  return `${before.length - after.length} elemento(s) removido(s).`;
}

function describeElement(element: StudioElement): string {
  switch (element.kind) {
    case "text":
      return "texto";
    case "image":
      return "imagem";
    case "gallery":
      return "galeria";
    case "cards":
      return "cards";
    case "table":
      return "tabela";
    case "timeline":
      return "timeline";
    case "comparison":
      return "comparativo";
    case "metric":
      return "destaque";
    case "cta":
      return "bloco de acção";
  }
}

/** Páginas que ficam de fora do âmbito do comando. */
function untouchedFor(
  original: StudioDeck,
  next: StudioDeck,
  scope: AiScope,
  selection?: AiSelection,
): string[] {
  if (scope === "PRESENTACAO") return [];
  // A página alvo NUNCA conta como fora do âmbito: alterá-la é precisamente o
  // que o comando pedia.
  const targetId = selection && selection.kind !== "PRESENTACAO" ? selection.slideId : null;
  const ids = new Set(next.slides.map((slide) => slide.id));
  return original.slides.filter((slide) => slide.id !== targetId && ids.has(slide.id)).map((slide) => slide.id);
}