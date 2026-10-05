/**
 * FASE 4E — PERFORMANCE DO STUDIO (item 50).
 *
 * O item 50 pede três coisas que vivem em sítios diferentes, e é por isso que
 * estão juntas aqui: a POLÍTICA é testável, e os componentes só a aplicam.
 *
 *  1. **Não reconstruir tudo por causa de uma alteração.** O modelo já partilha
 *     estrutura — `updateElement` copia só a página tocada — mas partilhar
 *     objectos só evita trabalho se o React souber. `slideSignature` e
 *     `sameSlide` dão a isso uma forma testável, e `changedSlides` diz ao
 *     editor quais passaram a ser diferentes das que já estavam no ecrã.
 *
 *  2. **Não carregar todas as imagens em resolução máxima.** `imageProps` é a
 *     única forma de escrever `<img>` no Studio: decide `loading`, `decoding`,
 *     o `srcSet` e o `alt`. Uma imagem sem `alt` é um problema de acessibilidade
 *     (item 52) e uma imagem sem `loading="lazy"` é um problema de performance —
 *     por isso vivem no mesmo sítio.
 *
 *  3. **Virtualizar quando é preciso.** `visibleWindow` devolve a fatia que
 *     precisa mesmo de ser desenhada. Com trinta páginas, o editor não cria
 *     trinta miniaturas: cria as que estão no ecrã.
 *
 * O módulo é PURO: nenhuma função toca no DOM nem em rede, o que faz com que as
 * decisões de performance possam ser testadas em vez de observadas.
 */

import type { StudioDeck, StudioSlide } from "./studio-deck";

/* -------------------------------------------------------------------------- */
/* 1. PARTILHA DE ESTRUTURA                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A identidade de uma página, para comparação.
 *
 * Inclui o conteúdo e a visibilidade. Uma assinatura que ignorasse os
 * elementos diria que trocar a imagem de uma página foi "nenhuma alteração" —
 * e o editor voltaria a desenhar páginas que não mudaram.
 *
 * Esta é a ÚNICA implementação da regra (item 60). `studio-ai` usa-a para
 * verificar o âmbito de uma alteração e o editor usa-a para decidir o que
 * redesenhar; duas cópias divergiriam e o editor acabaria por salt ar o desenho
 * de uma página que mudou.
 */
export function signatureOfSlide(slide: StudioSlide): string {
  return JSON.stringify([slide.layout, slide.eyebrow, slide.title, slide.body, slide.elements, slide.notes, slide.hidden]);
}

/** Alias do nome antigo, para as chamadas que já o usavam. */
export const slideSignature = signatureOfSlide;

/** `true` quando duas páginas são a mesma página para efeitos de desenho. */
export function sameSlide(before: StudioSlide | undefined, after: StudioSlide | undefined): boolean {
  if (!before || !after) return before === after;
  // A referência é a comparação mais barata, e é válida porque o modelo
  // partilha estrutura: páginas não tocadas mantêm o MESMO objecto.
  return before === after || slideSignature(before) === slideSignature(after);
}

/** Os índices das páginas que diferem entre dois decks. */
export function changedSlides(before: StudioDeck, after: StudioDeck): number[] {
  const previous = new Map(before.slides.map((slide, index) => [slide.id, slide]));
  const changed: number[] = [];

  after.slides.forEach((slide, index) => {
    if (!sameSlide(previous.get(slide.id), slide)) changed.push(index);
  });

  return changed;
}

/** `true` quando a alteração não mexe em nenhuma página. */
export function presentationUnchanged(before: StudioDeck, after: StudioDeck): boolean {
  return before === after || changedSlides(before, after).length === 0;
}

/**
 * As páginas que continuam visíveis e que não mudaram.
 *
 * É isto que o editor usa para não redesenhar o resto da apresentação quando o
 * ADMIN escreve num parágrafo: o resto mantém os mesmos objectos, e o React não
 * volta a percorrer os seus elementos.
/* -------------------------------------------------------------------------- */
/* 2. IMAGENS                                                                  */
/* -------------------------------------------------------------------------- */

/** Larguras a pedir ao servidor. Cobrem miniatura, ecrã e impressão. */
export const IMAGE_WIDTHS = [160, 480, 960, 1440] as const;

/**
 * `srcSet` para uma imagem.
 *
 * Devolve `undefined` quando o URL não aceita parâmetros — um ficheiro local ou
 * um servidor de storage que não entende `w`. Inventar um `srcSet` para um URL
 * que o ignora faria o browser descarregar a imagem várias vezes sem necessidade.
 */
export function imageSrcSet(url: string, widths: readonly number[] = IMAGE_WIDTHS): string | undefined {
  if (!url || url.startsWith("data:")) return undefined;
  const separator = url.includes("?") ? "&" : "?";
  return widths.map((width) => `${url}${separator}w=${width} ${width}w`).join(", ");
}

/** As propriedades de uma `<img>` do Studio. */
export type StudioImageProps = {
  src: string;
  alt: string;
  loading: "lazy" | "eager";
  decoding: "async" | "sync";
  srcSet?: string;
  sizes?: string;
};

/**
 * As propriedades de uma imagem no Studio.
 *
 * `alt` é obrigatório. Quando o autor não escreveu descrição, o texto de recurso
 * é explícito ("Imagem do projecto") em vez de `alt=""` — que diria ao browser
 * que a imagem é decorativa, o oposto do que é numa proposta.
 *
 * `loading="eager"` fica reservado à imagem de capa, a primeira coisa que o
 * cliente vê. Todo o resto é `lazy`: uma apresentação de trinta páginas não deve
 * pedir trinta imagens antes de alguém fazer scroll.
 */
export function imageProps(input: {
  url: string;
  alt?: string | null;
  /** A imagem que aparece primeiro, ou que ocupa o ecrã todo. */
  priority?: boolean;
  /** `true` quando a imagem é puramente decorativa. */
  decorative?: boolean;
  widths?: readonly number[];
}): StudioImageProps {
  const srcSet = imageSrcSet(input.url, input.widths);

  return {
    src: input.url,
    alt: input.decorative ? "" : input.alt?.trim() || "Imagem do projecto",
    loading: input.priority ? "eager" : "lazy",
    // `async` deixa o browser pintar o resto da página enquanto esta imagem
    // decodifica. É a diferença entre a página aparecer e a página aparecer já.
    decoding: "async",
    ...(srcSet ? { srcSet } : {}),
    ...(input.priority ? { sizes: "100vw" } : {}),
  };
}

/**
 * As páginas que continuam visíveis e que não mudaram.
 *
 * É isto que o editor usa para não redesenhar o resto da apresentação quando o
 * ADMIN escreve num parágrafo: o resto mantém os mesmos objectos, e o React não
 * volta a percorrer os seus elementos.
 */
export function untouchedVisibleSlides(before: StudioDeck, after: StudioDeck): string[] {
  const previous = new Map(before.slides.map((slide) => [slide.id, slide]));
  return after.slides
    .filter((slide) => !slide.hidden && sameSlide(previous.get(slide.id), slide))
    .map((slide) => slide.id);
}
/* -------------------------------------------------------------------------- */
/* 3. VIRTUALIZAÇÃO                                                            */
/* -------------------------------------------------------------------------- */

/** A fatia que precisa de ser desenhada. */
export type VisibleWindow = {
  start: number;
  end: number;
  /** `true` quando há mais conteúdo para baixo. */
  hasMore: boolean;
};

/**
 * A janela visível de uma lista.
 *
 * `overscan` é o número de itens desenhados fora do ecrã. Não é desperdício: é
 * o que faz o scroll rápido não mostrar espaço em branco enquanto o browser
 * calcula. Três chega para este caso; listas muito maiores precisariam de
 * medição real, e fingir isso aqui seria pior do que não fazer.
 */
export function visibleWindow(input: {
  total: number;
  /** Primeiro índice visível. */
  start: number;
  /** Quantos itens cabem no ecrã. */
  viewport: number;
  overscan?: number;
}): VisibleWindow {
  const overscan = input.overscan ?? 3;
  const total = Math.max(0, input.total);
  const viewport = Math.max(1, input.viewport);

  // Com poucas páginas, desenhar todas é mais simples do que medir, e o custo
  // é desprezável. A virtualização só entra quando passa a valer.
  if (total <= viewport + overscan * 2) {
    return { start: 0, end: total, hasMore: false };
  }

  const start = Math.max(0, input.start - overscan);
  const end = Math.min(total, input.start + viewport + overscan);

  return { start, end, hasMore: end < total };
}

/** Os itens a desenhar dentro da janela. */
export function windowed<T>(items: readonly T[], window: VisibleWindow): T[] {
  return items.slice(window.start, window.end);
}