/**
 * FASE 4D — VISUALIZAR (item 39).
 *
 * O item 39 pede cinco modos — desktop, tablet, celular, apresentação e tela
 * cheia — e, no mesmo parágrafo, a regra que decide a arquitectura:
 *
 *   > Não criar um renderer visual diferente para cada modo sem necessidade.
 *
 * Isso exclui a implementação tentadora: um componente por modo, cada um com o
 * seu aspecto, a corrigir as suas diferenças até o desktop deixar de bater certo
 * com o celular. Divergem sempre, e divergem sem ninguém dar por isso.
 *
 * Aqui o modo decide APENAS a moldura — a largura, a altura e a escala. O que
 * está dentro da moldura é sempre o MESMO componente, com o MESMO deck e os
 * MESMOS valores. Um preview que difere do publicado não é preview: é uma
 * segunda opinião sobre o que o cliente vai ver, e é a origem de queixas como
 * "no ecrã do estúdio parecia outra coisa".
 *
 * Um teste fixa essa equivalência comparando a impressão digital do preview com
 * a do DTO público.
 */

import type { StudioDeck } from "./studio-deck";

/* -------------------------------------------------------------------------- */
/* MODOS                                                                        */
/* -------------------------------------------------------------------------- */

export type PreviewMode = "DESKTOP" | "TABLET" | "CELULAR" | "APRESENTACAO" | "TELA_CHEIA";

/**
 * Um modo de visualização.
 *
 * `width` é o tamanho de REFERÊNCIA do dispositivo, e `frameHeight` a altura da
 * moldura. `null` = ocupa o que sobrar (tela cheia, sem moldura de dispositivo).
 */
export type PreviewDevice = {
  mode: PreviewMode;
  label: string;
  width: number;
  height: number;
  frameHeight: number | null;
};

export const PREVIEW_MODES: readonly PreviewDevice[] = [
  { mode: "DESKTOP", label: "Desktop", width: 1440, height: 900, frameHeight: 720 },
  { mode: "TABLET", label: "Tablet", width: 834, height: 1112, frameHeight: 640 },
  { mode: "CELULAR", label: "Celular", width: 390, height: 844, frameHeight: 640 },
  // Apresentação não é um dispositivo: é o ecrã grande, sem moldura de telemóvel.
  { mode: "APRESENTACAO", label: "Apresentação", width: 1920, height: 1080, frameHeight: null },
  { mode: "TELA_CHEIA", label: "Tela cheia", width: 1920, height: 1080, frameHeight: null },
];

export function getPreviewDevice(mode: PreviewMode): PreviewDevice {
  return PREVIEW_MODES.find((device) => device.mode === mode) ?? PREVIEW_MODES[0];
}

/**
 * A MESMA largura em todos os modos, e não a de cada dispositivo.
 *
 * A primeira versão desta função escalava cada modo pela sua largura de
 * referência — e produzia o absurdo de encolher o celular numa janela de 500 px e
 * deixar o tablet à escala 1. O conteúdo é UM só, desenhado para uma largura
 * máxima; o modo escolhe a ALTURA da moldura e o quanto se mostra. É por isso que
 * a largura não varia entre modos, e que o teste de equivalência do item 39
 * continua a valer para qualquer um deles.
 */
export const PREVIEW_CONTENT_WIDTH = 1280;

/**
 * A escala com que o conteúdo entra na moldura.
 *
 * Não depende do MODO — e é essa a demonstração de que o item 39 está cumprido.
 * O conteúdo é um só, desenhado para `PREVIEW_CONTENT_WIDTH` e reduzido para caber
 * na largura disponível. Trocar de desktop para celular muda a altura da moldura e
 * nada mais: o mesmo componente, com os mesmos valores, à mesma proporção.
 *
 * Se a escala variasse com o modo, teríamos um renderer efectivamente diferente
 * por modo — exactamente o que o item proíbe.
 */
export function previewScale(mode: PreviewMode, availableWidth: number): number {
  void mode; // O modo não muda a escala; ver a nota acima.
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  // A divisão pela largura de conteúdo é o que faz o preview ENCOLHER para caber.
  // O inverso — dividir a largura de conteúdo pela moldura — dava 2 numa moldura de
  // 640 px, e o preview era ampliado para caber, que é o contrário de pré-visualizar.
  return Math.min(1, availableWidth / PREVIEW_CONTENT_WIDTH);
}

/* -------------------------------------------------------------------------- */
/* NAVEGAÇÃO                                                                    */
/* -------------------------------------------------------------------------- */

/** O que o preview mostra agora. */
export type PreviewState = {
  mode: PreviewMode;
  /** Índice da página visível, a partir de 0. */
  index: number;
  /** Tela cheia ligada? Só faz sentido em APRESENTAÇÃO e TELA_CHEIA. */
  fullscreen: boolean;
};

/**
 * Estado inicial: primeira página, no modo que o ADMIN escolheu.
 *
 * Num deck vazio o índice é 0 e a navegação trata-o como não havendo páginas —
 * devolver -1 faria o contador dizer "página 0 de 0".
 */
export function initialPreviewState(mode: PreviewMode = "DESKTOP"): PreviewState {
  return { mode, index: 0, fullscreen: mode === "TELA_CHEIA" };
}

/**
 * Manda o preview para outra página.
 *
 * SATURA em vez de dar a volta. Dar a volta é o que faz um leitor de PDF saltar do
 * fim para o início sem querer, e num documento comercial lido ao lado do cliente
 * é desconcertante. Torna-se, com isso, impossível ver duas vezes a mesma página
 * por engano.
 */
export function goToSlide(state: PreviewState, index: number, total: number): PreviewState {
  if (total <= 0) return { ...state, index: 0 };
  return { ...state, index: Math.min(Math.max(index, 0), total - 1) };
}

/** Próxima página. Não dá a volta. */
export function nextSlide(state: PreviewState, total: number): PreviewState {
  return goToSlide(state, state.index + 1, total);
}

/** Página anterior. Não dá a volta. */
export function previousSlide(state: PreviewState, total: number): PreviewState {
  return goToSlide(state, state.index - 1, total);
}

/** Troca de modo, mantendo a página onde o ADMIN estava. */
export function setPreviewMode(state: PreviewState, mode: PreviewMode): PreviewState {
  // Tela cheia só existe nos dois modos grandes; activá-la num telemóvel
  // mostraria um ecrã de computador dentro de um ecrã de telemóvel.
  return {
    ...state,
    mode,
    fullscreen: mode === "TELA_CHEIA" || (state.fullscreen && mode === "APRESENTACAO"),
  };
}

/* -------------------------------------------------------------------------- */
/* EQUIVALÊNCIA COM A PUBLICAÇÃO (item 39)                                     */
/* -------------------------------------------------------------------------- */

/**
 * O que o cliente vai ver, para o preview comparar com ele.
 *
 * É a MESMA impressão digital que a publicação calcula: se as duas usassem
 * cálculos diferentes, o preview estaria a dizer ao ADMIN que a proposta está
 * certa enquanto o cliente vê outra coisa. Uma impressão digital é mais forte do
 * que uma lista de campos verificados — apanha tudo, incluindo aquilo em que
 * ninguém pensou.
 */
export function publicationFingerprint(source: {
  title: string;
  total: number;
  services: ReadonlyArray<{ name: string; quantity?: number | null; subtotal: number }>;
  installments: ReadonlyArray<{ label: string; percent: number; amount: number }>;
  slides: ReadonlyArray<{ title: string; body: string }>;
}): string {
  return [
    source.title,
    source.total.toFixed(2),
    ...source.services.map((linha) => `${linha.name}|${linha.quantity ?? 1}|${linha.subtotal.toFixed(2)}`),
    ...source.installments.map((p) => `${p.label}|${p.percent}|${p.amount.toFixed(2)}`),
    ...source.slides.map((slide) => `${slide.title}|${slide.body}`),
  ].join("\n");
}

/**
 * As páginas que o preview mostra, pela ordem.
 *
 * Páginas escondidas não aparecem — é a mesma regra da publicação pública, e duas
 * listas diferentes seriam outra forma de o preview divergir do publicado.
 */
export function visibleSlides(deck: Pick<StudioDeck, "slides">): StudioDeck["slides"] {
  return deck.slides.filter((slide) => !slide.hidden);
}