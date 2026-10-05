/**
 * FASE 4D — IDENTIDADE DO DOCUMENTO (item 38).
 *
 * Logo, nome profissional, rodapé, aviso de confidencialidade e contacto são
 * configuração GLOBAL — escrevem-se uma vez e valem para todas as páginas. Mas o
 * item 38 pede também poder escondê-los na capa, no encerramento e em páginas
 * escolhidas, e é aí que mora o risco: um aviso de confidencialidade que
 * desaparece por engano é um problema legal; um rodapé que aparece na capa
 * estraga a capa.
 *
 * A decisão é modelar a visibilidade como uma FUNÇÃO PURA
 * (`isBrandVisibleOnSlide`), e não como um campo por página. A razão é que a
 * regra é sempre a mesma — "não nesta página" — e guardá-la no gravador criaria
 * uma terceira fonte que divergiria do renderizador.
 *
 * A lista de excepções é de páginas por POSIÇÃO (capa e encerramento), não por
 * identificador: o identificador de uma página muda quando o deck é duplicado ou
 * reordenado, e um aviso associado a um id desapareceria ao duplicar. A posição
 * é o que o leitor reconhece como "a capa".
 */

import type { StudioDeck } from "./studio-deck";

/* -------------------------------------------------------------------------- */
/* IDENTIDADE                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Identidade do escritório, aplicada ao documento inteiro.
 *
 * Tudo é opcional de propósito: um template (item 37) não tem de trazer marca, e
 * uma proposta interna pode não ter logo. O que é obrigatório é o que o leitor
 * precisa para confiar no documento — e isso é decidido pelo renderizador, que
 * esconde o que estiver vazio em vez de imprimir um separador sozinho.
 */
export type BrandIdentity = {
  /** Caminho ou URL do logótipo. */
  logoUrl: string | null;
  /** Nome do profissional responsável. */
  professionalName: string | null;
  /** Nome da empresa ou do estúdio. */
  companyName: string | null;
  /** Texto do rodapé, por baixo de tudo. */
  footer: string | null;
  /**
   * Aviso de confidencialidade.
   *
   * Fica separado do rodapé porque têm prioridades diferentes: o rodapé é
   * identidade, o aviso é proteção legal, e o ADMIN tem de poder mostrar um e
   * esconder o outro.
   */
  confidentialityNotice: string | null;
  /** Contacto mostrado no rodapé ou no encerramento. */
  contact: string | null;
  /** Mostrar o número de página? Por omissão, sim. */
  showPageNumber: boolean;
};

/**
 * Identidade VAZIA.
 *
 * É o que uma proposta nova recebe. Não é `null`: um objecto com campos a `null`
 * deixa o renderizador tratá-los como "não definido" sem verificação em cada
 * ponto, e evita um erro de null a null num template novo.
 */
export const NO_BRAND: BrandIdentity = {
  logoUrl: null,
  professionalName: null,
  companyName: null,
  footer: null,
  confidentialityNotice: null,
  contact: null,
  showPageNumber: true,
};
/* -------------------------------------------------------------------------- */
/* VISIBILIDADE                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Onde a identidade NÃO aparece, por omissão.
 *
 * Capa e encerramento ficam de fora por uma razão EDITORIAL, não técnica: a capa
 * é uma imagem de impacto e o rodapé rouba-lhe a última linha; o encerramento é a
 * saída, e repetir a marca duas vezes seguidas lê-se como hesitação. O aviso de
 * confidencialidade, esse, aparece nos dois — é protecção, não decoração.
 */
export type BrandPiece = "capa" | "encerramento" | "identidade" | "rodape" | "aviso" | "numero";

/** Páginas onde o ADMIN escolheu esconder cada peça. */
export type BrandVisibility = Partial<Record<BrandPiece, readonly string[]>>;

/**
 * A peça aparece nesta página?
 *
 * A lista é sempre a EXCEÇÃO — e é assim que o modelo se paga: quem usa o
 * sistema não precisa de marcar as trinta páginas onde o rodapé aparece, só as
 * duas onde ele não deve.
 */
export function isBrandVisibleOnSlide(
  deck: Pick<StudioDeck, "slides">,
  position: number,
  piece: BrandPiece,
  visibility: BrandVisibility = {},
): boolean {
  const slide = deck.slides[position];
  if (!slide) return false;

  // Excepção explícita do ADMIN: ganha a tudo, em qualquer peça.
  if (visibility[piece]?.includes(slide.id)) return false;

  switch (piece) {
    case "capa":
      return position !== 0;
    case "encerramento":
      return position !== deck.slides.length - 1;
    case "identidade":
    case "rodape":
      // Fora da capa e do encerramento, por omissão.
      return position !== 0 && position !== deck.slides.length - 1;
    case "aviso":
      // O aviso é TODAS as páginas, capa e encerramento incluídos: é a
      // protecção que não pode ter uma página onde falha.
      return true;
    case "numero":
      return true;
  }
}

/**
 * As peças que uma página mostra, resolvidas.
 *
 * É o que o renderizador consome: uma chamada, um resultado. Sem ele, cada
 * página repetiria a mesma sequência de condições — que é como as regras divergem
 * entre o editor e a publicação pública.
 */
export type SlideBrand = {
  identity: boolean;
  rodape: boolean;
  aviso: boolean;
  numero: boolean;
};

export function brandForSlide(
  deck: Pick<StudioDeck, "slides">,
  position: number,
  visibility: BrandVisibility = {},
): SlideBrand {
  return {
    identity: isBrandVisibleOnSlide(deck, position, "identidade", visibility),
    rodape: isBrandVisibleOnSlide(deck, position, "rodape", visibility),
    aviso: isBrandVisibleOnSlide(deck, position, "aviso", visibility),
    numero: isBrandVisibleOnSlide(deck, position, "numero", visibility),
  };
}

/**
 * As páginas que o editor deve mostrar como "fora da identidade".
 *
 * Serve ao painel de revisão (item 38): o ADMIN vê, de relance, quais as páginas
 * que não vão ter rodapé. Sem isto, esconder páginas seria um ajuste cego.
 */
export function pagesWithoutFooter(deck: Pick<StudioDeck, "slides">, visibility: BrandVisibility = {}): number[] {
  return deck.slides
    .map((_, position) => position)
    .filter((position) => !brandForSlide(deck, position, visibility).rodape);
}

/**
 * Lê a identidade gravada num Json, sem lançar.
 *
 * Uma apresentação antiga não tem `brand`, e um Json corrompido não pode fazer o
 * editor dar 500 numa proposta já enviada. Campos desconhecidos são ignorados: uma
 * versão futura do Studio não deve partir o editor de hoje.
 */
export function readBrandIdentity(raw: unknown): BrandIdentity {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...NO_BRAND };
  const value = raw as Record<string, unknown>;
  const text = (key: string): string | null => {
    const field = value[key];
    return typeof field === "string" && field.trim() ? field.trim() : null;
  };
  return {
    logoUrl: text("logoUrl"),
    professionalName: text("professionalName"),
    companyName: text("companyName"),
    footer: text("footer"),
    confidentialityNotice: text("confidentialityNotice"),
    contact: text("contact"),
    showPageNumber: value.showPageNumber !== false,
  };
}