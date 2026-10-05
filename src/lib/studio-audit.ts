import type { StudioDeck, StudioSlide } from "./studio-deck";

/**
 * FASE 4E — AUDITORIA DO STUDIO (item 56).
 *
 * O `AuditLog` já existe e já é gravado. O que faltava era a GRANULARIDADE: o
 * editor gravava uma única entrada — "apresentação guardada" — para tudo. Isso
 * não responde "o que mudou em detalhe", que é precisamente a pergunta que a
 * auditoria de uma proposta tem de responder.
 *
 * Este módulo é a parte PURA: recebe os dois decks e diz o que aconteceu. É
 * testável sem banco e sem React, que é o que permite fixar as regras.
 *
 * A decisão estrutural mais importante: **a origem da alteração (IA, manual,
 * importação, template) chega ao servidor como DECLARAÇÃO, não como prova.**
 * O servidor continua a recalcular tudo o que é segurança — quem pode gravar,
 * que valores comerciais são legítimos, se a proposta está congelada. Confiar
 * numa etiqueta que diz "isto foi a IA" não abriria porta nenhuma; recusar a
 * edição por não confiar na etiqueta tornaria o editor inútil.
 */

/** Quem provocou a alteração. Não é autorização — é contexto. */
export type StudioEditOrigin =
  | "MANUAL"
  | "IA"
  | "IMPORTACAO"
  | "TEMPLATE"
  | "REMIX"
  | "APRESENTACAO_BASE";

/** Um evento de auditoria derivado de uma comparação de decks. */
export type StudioAuditEvent = {
  action: string;
  /** Descrição legível do que aconteceu. */
  summary: string;
  /** `true` quando o evento envolve trabalho de um modelo. */
  ai: boolean;
  /** Referências que ajudam a localizar: páginas, elementos, imagens. */
  refs: { slideIds?: string[]; imageIds?: string[] };
};

/**
 * Compara o deck anterior com o novo e devolve os eventos.
 *
 * A comparação é por IDENTIDADE de página, e não por posição. Uma inserção no
 * meio não pode ser reportada como "a página 2 mudou e a página 3 mudou" — é
 * ruído que torna o registo ilegível e esconde a operação real.
 */
export function diffStudioDecks(
  before: StudioDeck | null,
  after: StudioDeck,
  origin: StudioEditOrigin,
): StudioAuditEvent[] {
  const events: StudioAuditEvent[] = [];
  const ai = origin === "IA";

  if (!before) {
    events.push({
      action: "STUDIO_DECK_CREATED",
      summary: `Apresentação criada com ${after.slides.length} página(s).`,
      ai: false,
      refs: { slideIds: after.slides.map((slide) => slide.id) },
    });
    if (origin === "IMPORTACAO") {
      events.push({
        action: "STUDIO_DECK_IMPORTED",
        summary: "Apresentação importada de um documento existente.",
        ai: false,
        refs: {},
      });
    }
    return events;
  }

  const previousSlides = new Map(before.slides.map((slide) => [slide.id, slide]));
  const nextSlides = new Map(after.slides.map((slide) => [slide.id, slide]));

  /* --- TEMA (item 56: "mudança de tema") ---------------------------------- */
  if (before.theme !== after.theme) {
    events.push({
      action: "STUDIO_THEME_CHANGED",
      summary: `Tema alterado de ${before.theme} para ${after.theme}.`,
      ai,
      refs: {},
    });
  }

  /* --- EXCLUSÃO ------------------------------------------------------------ */
  const removed = before.slides.filter((slide) => !nextSlides.has(slide.id));
  if (removed.length) {
    events.push({
      action: "STUDIO_SLIDE_REMOVED",
      summary: `${removed.length} página(s) removida(s): ${titles(removed)}.`,
      ai,
      refs: { slideIds: removed.map((slide) => slide.id) },
    });
  }

  /* --- INCLUSÃO E DUPLICAÇÃO ------------------------------------------------ */
  const added = after.slides.filter((slide) => !previousSlides.has(slide.id));
  if (added.length) {
    // Duplicação é distinguir de "página nova": a diferença é que a página
    // duplicada já existia com outro id. Sem esta distinção o registo diria
    // "criada" numa duplicação, e a revisão perdia o rasto da origem.
    const twins = added.filter((slide) => hasTwin(slide, after));
    const created = added.filter((slide) => !twins.includes(slide));

    if (created.length) {
      events.push({
        action: "STUDIO_SLIDE_ADDED",
        summary: `${created.length} página(s) criada(s): ${titles(created)}.`,
        ai,
        refs: { slideIds: created.map((slide) => slide.id) },
      });
    }
    if (twins.length) {
      events.push({
        action: "STUDIO_SLIDE_DUPLICATED",
        summary: `${twins.length} página(s) duplicada(s).`,
        ai,
        refs: { slideIds: twins.map((slide) => slide.id) },
      });
    }
  }

  /* --- EDIÇÃO, LAYOUT, IMAGENS ---------------------------------------------- */
  const edited: string[] = [];
  const layoutChanged: string[] = [];
  const imagesAdded: string[] = [];
  const imagesReplaced: string[] = [];

  for (const slide of after.slides) {
    const previous = previousSlides.get(slide.id);
    if (!previous) continue; // já contabilizada como criação.

    if (slide.layout !== previous.layout) layoutChanged.push(slide.id);
    if (isEdited(previous, slide)) edited.push(slide.id);

    const beforeImages = imagesOf(previous);
    for (const [imageId, image] of imagesOf(slide)) {
      if (beforeImages.has(imageId)) continue;
      // Mesma url com id novo é SUBSTITUIÇÃO; url nova é inserção. O teste é a
      // url, porque é isso que mudou aos olhos de quem vai ler a proposta.
      const replaced = [...beforeImages.values()].some((entry) => entry.url === image.url);
      (replaced ? imagesReplaced : imagesAdded).push(imageId);
    }
  }

  if (edited.length) {
    // A origem distingue edição manual de edição por IA (item 56).
    events.push({
      action: ai ? "STUDIO_AI_EDIT_APPLIED" : "STUDIO_SLIDE_EDITED",
      summary: `${edited.length} página(s) alterada(s) ${ai ? "por comando de IA" : "manualmente"}.`,
      ai,
      refs: { slideIds: edited },
    });
  }

  if (layoutChanged.length) {
    events.push({
      action: "STUDIO_LAYOUT_CHANGED",
      summary: `Disposição alterada em ${layoutChanged.length} página(s).`,
      ai,
      refs: { slideIds: layoutChanged },
    });
  }

  if (imagesAdded.length) {
    events.push({
      action: ai ? "STUDIO_IMAGE_GENERATED" : "STUDIO_IMAGE_INSERTED",
      summary: `${imagesAdded.length} imagem(ns) inserida(s).`,
      ai,
      refs: { imageIds: imagesAdded },
    });
  }

  if (imagesReplaced.length) {
    events.push({
      action: "STUDIO_IMAGE_REPLACED",
      summary: `${imagesReplaced.length} imagem(ns) substituída(s).`,
      ai,
      refs: { imageIds: imagesReplaced },
    });
  }

  // Reordenação: o conjunto de ids é o mesmo, a ordem não.
  if (!added.length && !removed.length && orderChanged(before, after)) {
    events.push({
      action: "STUDIO_SLIDE_REORDERED",
      summary: "Páginas reordenadas.",
      ai,
      refs: { slideIds: after.slides.map((slide) => slide.id) },
    });
  }

  return events;
}

/** Rótulos legíveis, com tamanho limitado para o registo não inchar. */
function titles(slides: readonly { title: string }[]): string {
  const names = slides.map((slide) => slide.title || "(sem título)");
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} (+${names.length - 3})` : shown;
}

/** `true` quando o conteúdo da página mudou (título, corpo, notas, visibilidade). */
function isEdited(before: StudioSlide, after: StudioSlide): boolean {
  return (
    before.title !== after.title ||
    before.body !== after.body ||
    before.eyebrow !== after.eyebrow ||
    before.notes !== after.notes ||
    before.hidden !== after.hidden ||
    JSON.stringify(before.elements) !== JSON.stringify(after.elements)
  );
}

/** Uma cópia tem gémeo: a mesma página repetida com outro id. */
function hasTwin(slide: StudioSlide, deck: StudioDeck): boolean {
  const signature = JSON.stringify([slide.layout, slide.title, slide.body, slide.elements]);
  return deck.slides
    .filter((entry) => entry.id !== slide.id)
    .some((entry) => JSON.stringify([entry.layout, entry.title, entry.body, entry.elements]) === signature);
}

function orderChanged(before: StudioDeck, after: StudioDeck): boolean {
  if (before.slides.length !== after.slides.length) return false;
  return before.slides.some((slide, index) => after.slides[index]?.id !== slide.id);
}

/** Imagens de uma página, por id. Percorre galerias e blocos de cartões. */
function imagesOf(slide: StudioSlide): Map<string, { url: string }> {
  const found = new Map<string, { url: string }>();
  const visit = (items: readonly unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      if (entry.kind === "image" && typeof entry.id === "string" && typeof entry.url === "string") {
        found.set(entry.id, { url: entry.url });
      }
      if (Array.isArray(entry.images)) visit(entry.images);
      if (Array.isArray(entry.items)) visit(entry.items);
    }
  };
  visit(slide.elements);
  return found;
}