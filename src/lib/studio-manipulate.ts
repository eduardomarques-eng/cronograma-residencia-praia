/**
 * FASE 4C — MANIPULAÇÃO DE PÁGINAS (itens 8 e 10).
 *
 * Todas as operações do painel de páginas vivem aqui, em funções puras. A
 * vantagem é concreta: o histórico de desfazer/refazer (que é onde um editor
 * visual costuma partir) passa a ser uma lista de estados imutáveis, e cada
 * operação é testável sem React, sem base de dados e sem DOM.
 *
 * Duas regras que atravessam o módulo inteiro:
 *
 *  1. **Nada é mutado.** Todas as operações devolvem um deck novo. É o que faz
 *     o "restaurar" do item 17 funcionar sem infraestrutura de histórico: basta
 *     guardar o deck anterior.
 *  2. **A identidade é derivada do conteúdo.** Uma página duplicada recebe id
 *     novo, calculado a partir da posição. Sem isso, o duplicado e o original
 *     partilhariam identidade, e apagar um apagaria o outro.
 */

import { stableId, type StudioDeck, type StudioElement, type StudioSlide } from "./studio-deck";
import { getLayout, layoutsAccepting, type LayoutKey, type LayoutSlot } from "./studio-layout";

/** Slots que uma página usa hoje. */
export function slideSlots(slide: StudioSlide): LayoutSlot[] {
  return Array.from(new Set(slide.elements.map((element) => element.kind)));
}

/** Cópia de uma página com id novo, derivado da posição. */
function cloneSlide(slide: StudioSlide, position: number, salt: string): StudioSlide {
  return {
    ...slide,
    id: stableId("slide", salt, position, slide.title, slide.body),
    elements: slide.elements.map((element) => ({
      ...element,
      id: stableId("el", salt, position, element.id),
    })),
  };
}

function replaceAt(slides: StudioSlide[], index: number, next: StudioSlide[]): StudioSlide[] {
  return [...slides.slice(0, index), ...next, ...slides.slice(index + 1)];
}

function requireIndex(slides: ReadonlyArray<StudioSlide>, index: number): void {
  if (index < 0 || index >= slides.length) {
    throw new RangeError(`Posição ${index} está fora da apresentação.`);
  }
}

/**
 * Página vazia com um layout — a base do botão "+".
 *
 * O `position` entra no id de propósito. Sem ele, duas páginas em branco com o
 * mesmo layout recebiam o MESMO id, e o React (e o histórico de desfazer)
 * passavam a ver uma página onde existem duas — apagar uma apagava as duas.
 */
export function blankSlide(layout: LayoutKey = "title-text", position = 0): StudioSlide {
  return {
    id: stableId("slide", "blank", layout, position),
    layout,
    eyebrow: "",
    title: "",
    body: "",
    elements: [],
    hidden: false,
    notes: "",
  };
}

/**
 * Acrescenta uma página em branco numa posição.
 *
 * `deck.slides.length` faz parte do id: duas adições seguidas no mesmo ponto
 * recebem ids diferentes, e continuam a ser derivados (nunca sorteados).
 */
export function addBlankSlide(deck: StudioDeck, position: number, layout: LayoutKey = "title-text"): StudioDeck {
  const at = Math.max(0, Math.min(position, deck.slides.length));
  const slide: StudioSlide = {
    ...blankSlide(layout, at),
    id: stableId("slide", "blank", layout, at, deck.slides.length),
  };
  return insertSlides(deck, at, [slide]);
}

/** Insere páginas em `position`, sem tocar no resto. */
export function insertSlides(deck: StudioDeck, position: number, slides: StudioSlide[]): StudioDeck {
  const at = Math.max(0, Math.min(position, deck.slides.length));
  return { ...deck, slides: [...deck.slides.slice(0, at), ...slides, ...deck.slides.slice(at)] };
}

/**
 * Duplica a página em `index`.
 *
 * O duplicado entra logo a seguir, que é o que o ADMIN espera ao carregar no
 * botão: "a mesma página outra vez, aqui mesmo".
 */
export function duplicateSlide(deck: StudioDeck, index: number): StudioDeck {
  requireIndex(deck.slides, index);
  const copy = cloneSlide(deck.slides[index], index, "dup");
  return insertSlides(deck, index + 1, [copy]);
}

/**
 * Remove a página em `index`.
 *
 * A última página NÃO é removível: uma apresentação sem páginas não é uma
 * apresentação, e o ADMIN ficaria sem forma de a recuperar excepto pelo
 * histórico.
 */
export function removeSlide(deck: StudioDeck, index: number): StudioDeck {
  requireIndex(deck.slides, index);
  if (deck.slides.length === 1) {
    throw new RangeError("A apresentação tem de ter pelo menos uma página.");
  }
  return { ...deck, slides: deck.slides.filter((_, position) => position !== index) };
}

/** Move a página `from` para a posição `to`. */
export function moveSlide(deck: StudioDeck, from: number, to: number): StudioDeck {
  requireIndex(deck.slides, from);
  if (to < 0 || to >= deck.slides.length) {
    throw new RangeError(`Posição ${to} está fora da apresentação.`);
  }
  if (from === to) return deck;
  const slides = [...deck.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  return { ...deck, slides };
}

/** Sobe ou desce a página. Devolve o MESMO deck quando não há espaço. */
export function nudgeSlide(deck: StudioDeck, index: number, direction: -1 | 1): StudioDeck {
  const target = index + direction;
  if (target < 0 || target >= deck.slides.length) return deck;
  return moveSlide(deck, index, target);
}

/**
 * Reordena por arrasto.
 *
 * Recebe os ids pela ordem final — que é o que um painel de arrastar já tem —
 * em vez de índices. Com índices, um arrasto que passa por cima da própria
 * posição final errava a ordem; com ids, é determinístico.
 */
export function reorderSlides(deck: StudioDeck, orderedIds: readonly string[]): StudioDeck {
  const byId = new Map(deck.slides.map((slide) => [slide.id, slide]));
  const ordered: StudioSlide[] = [];
  for (const id of orderedIds) {
    const slide = byId.get(id);
    if (slide) {
      ordered.push(slide);
      byId.delete(id);
    }
  }
  // Uma página que não apareça na lista mantém-se no fim, em vez de
  // desaparecer: perder uma página num arrasto seria perda de dados.
  byId.forEach((slide) => ordered.push(slide));
  return { ...deck, slides: ordered };
}
/**
 * Esconde ou mostra uma página.
 *
 * Esconder NÃO apaga. A página continua no deck e no editor, marcada; só sai
 * da apresentação pública. É o que o item 8 quer com "ocultar quando
 * tecnicamente útil" e "restaurar".
 */
export function setSlideHidden(deck: StudioDeck, index: number, hidden: boolean): StudioDeck {
  requireIndex(deck.slides, index);
  return { ...deck, slides: replaceAt(deck.slides, index, [{ ...deck.slides[index], hidden }]) };
}

/** Actualiza campos simples de uma página. */
export function updateSlide(
  deck: StudioDeck,
  index: number,
  patch: Partial<Pick<StudioSlide, "title" | "body" | "eyebrow" | "notes" | "layout">>,
): StudioDeck {
  requireIndex(deck.slides, index);
  return { ...deck, slides: replaceAt(deck.slides, index, [{ ...deck.slides[index], ...patch }]) };
}

/** Substitui um elemento, mantendo a posição na página. */
export function updateElement(
  deck: StudioDeck,
  index: number,
  elementId: string,
  patch: Partial<StudioElement>,
): StudioDeck {
  requireIndex(deck.slides, index);
  const slide = deck.slides[index];
  if (!slide.elements.some((element) => element.id === elementId)) {
    throw new RangeError(`O elemento ${elementId} não existe nesta página.`);
  }
  const elements = slide.elements.map((element) =>
    element.id === elementId ? ({ ...element, ...patch } as StudioElement) : element,
  );
  return { ...deck, slides: replaceAt(deck.slides, index, [{ ...slide, elements }]) };
}

/**
 * Insere um elemento numa página, no fim por omissão.
 *
 * A inserção é a operação que o item 9 pede na "inserção de elementos". Note
 * que ela NÃO valida o layout: quem oferece os botões já filtrou por
 * `elementsForLayout`. Validar aqui também duplicaria a regra num segundo
 * sítio, e as duas versões divergiriam.
 */
export function insertElement(
  deck: StudioDeck,
  index: number,
  element: StudioElement,
  position?: number,
): StudioDeck {
  requireIndex(deck.slides, index);
  const slide = deck.slides[index];
  // Um id repetido tornaria dois elementos indistinguíveis para o React e para
  // o desfazer. A mesma página a inserir a mesma imagem duas vezes é legítima,
  // por isso o sufixo é desambiguado, não rejeitado.
  const id = slide.elements.some((current) => current.id === element.id)
    ? stableId(element.id, slide.elements.length)
    : element.id;
  const at = position === undefined ? slide.elements.length : Math.max(0, Math.min(position, slide.elements.length));
  const elements = [...slide.elements.slice(0, at), { ...element, id }, ...slide.elements.slice(at)];
  return { ...deck, slides: replaceAt(deck.slides, index, [{ ...slide, elements }]) };
}

/** Remove um elemento da página. */
export function removeElement(deck: StudioDeck, index: number, elementId: string): StudioDeck {
  requireIndex(deck.slides, index);
  const slide = deck.slides[index];
  return {
    ...deck,
    slides: replaceAt(deck.slides, index, [
      { ...slide, elements: slide.elements.filter((element) => element.id !== elementId) },
    ]),
  };
}

/* -------------------------------------------------------------------------- */
/* ITEM 10 — TROCAR LAYOUT SEM PERDER CONTEÚDO                                  */
/* -------------------------------------------------------------------------- */

export type LayoutChange = {
  /** `true` quando a troca é segura e pode ser aplicada sem preview. */
  safe: boolean;
  /** Slots que o layout novo NÃO aceita e que existem hoje na página. */
  incompatible: LayoutSlot[];
  /** Explicação para o ADMIN decidir. Vazio quando a troca é segura. */
  warning: string;
};

/**
 * Avalia se trocar o layout perde conteúdo.
 *
 * A regra é verificada ANTES de aplicar, e é a do item 10: "não perder conteúdo
 * existente quando isso puder ser evitado". Uma troca para um layout que não
 * aceita `table` mostraria a tabela deformada ou escondida — o que seria pior
 * do que dizer que não cabe.
 */
export function evaluateLayoutChange(slide: StudioSlide, next: LayoutKey): LayoutChange {
  if (next === slide.layout) return { safe: true, incompatible: [], warning: "" };

  const used = slideSlots(slide);
  const target = getLayout(next);
  const incompatible = used.filter((slot) => !target.slots.includes(slot));

  if (incompatible.length === 0) return { safe: true, incompatible: [], warning: "" };

  return {
    safe: false,
    incompatible,
    warning: `O layout "${target.label}" não apresenta ${incompatible.join(", ")}. O conteúdo ficaria escondido.`,
  };
}

/** Layouts que servem o conteúdo actual desta página. */
export function compatibleLayouts(slide: StudioSlide): LayoutKey[] {
  return layoutsAccepting(slideSlots(slide));
}

/**
 * Troca o layout preservando o conteúdo.
 *
 * Lança `LayoutIncompatibleError` quando a troca esconderia algo. A excepção é
 * o que impede que um `onClick` invente uma perda de dados: a interface tem de
 * mostrar o preview antes, e esta função recusa o caminho directo.
 */
export function replaceLayout(deck: StudioDeck, index: number, next: LayoutKey): StudioDeck {
  requireIndex(deck.slides, index);
  const change = evaluateLayoutChange(deck.slides[index], next);
  if (!change.safe) {
    throw new LayoutIncompatibleError(change.warning, change.incompatible);
  }
  return updateSlide(deck, index, { layout: next });
}

/** Erro de troca de layout que esconderia conteúdo. */
export class LayoutIncompatibleError extends Error {
  constructor(
    message: string,
    readonly incompatible: readonly LayoutSlot[],
  ) {
    super(message);
    this.name = "LayoutIncompatibleError";
  }
}
/* -------------------------------------------------------------------------- */
/* HISTÓRICO — DESFAZER E REFAZER (item 8)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Teto do histórico.
 *
 * Cada estado é um deck inteiro, portanto a memória cresce depressa. 50 passos
 * é o que cobre o intervalo em que alguém repara no erro; passado isso, o mais
 * antigo é descartado. Um histórico ilimitado seria uma fuga de memória
 * silenciosa numa página aberta há horas.
 */
export const HISTORY_LIMIT = 50;

export type History = {
  past: StudioDeck[];
  present: StudioDeck;
  future: StudioDeck[];
};

export function createHistory(deck: StudioDeck): History {
  return { past: [], present: deck, future: [] };
}

/**
 * Regista um novo estado.
 *
 * Devolve o MESMO histórico quando `next` é a mesma referência: é o que
 * permite a interface guardar `present` sem triggering um render e sem
 * encher a pilha com alterações que não mudaram nada.
 */
export function commit(history: History, next: StudioDeck): History {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    // Qualquer edição descarta o "refazer": o futuro deixou de descrever o
    // estado actual, e mantê-lo faria o refazer saltar para um ramo que o
    // ADMIN já não viu.
    future: [],
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function undo(history: History): History {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}