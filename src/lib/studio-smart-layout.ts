/**
 * FASE 4C — "MELHORAR LAYOUT" (item 11).
 *
 * A IA "analisa a página e sugere um layout mais adequado". Este módulo é a
 * parte que decide O QUE está mal — e é uma FUNÇÃO PURA, determinística e
 * auditável, não um prompt.
 *
 * A distinção importa. Se "melhorar layout" fosse apenas "perguntar a um
 * modelo", a regra comercial do item 11 ("preservar o conteúdo comercial")
 * ficaria a cargo de o modelo obedecer. Aqui a análise mede coisas concretas:
 * excesso de palavras, desequilíbrio entre imagem e texto, número de itens que
 * não cabe num grid. O resultado é um conjunto de queixas EXPLÍCITAS que o
 * editor mostra ao ADMIN antes de aplicar, e que um teste fixa.
 *
 * O item 11 lista oito queixas possíveis; todas mapeiam para uma medição aqui.
 */

import { excessWords, splitSentences, wordCount } from "./studio-text";
import { layoutsAccepting, type LayoutKey } from "./studio-layout";
import type { StudioDeck, StudioElement, StudioSlide } from "./studio-deck";

/** As queixas que o "Melhorar layout" sabe encontrar. */
export type LayoutIssueCode =
  | "TEXTO_EXCESSO"
  | "SEM_IMAGEM"
  | "IMAGEM_SEM_TEXTO"
  | "DESEQUILIBRIO"
  | "CARDS_DEMAIS"
  | "HIERARQUIA_FRACA"
  | "VALOR_SEM_DESTAQUE"
  | "DENSIDADE"
  | "ESPACO_NEGATIVO";

export type LayoutIssue = {
  code: LayoutIssueCode;
  /** Texto mostrado ao ADMIN. Explica o problema, não a solução técnica. */
  message: string;
  /** `high` muda o layout; `medium` só sugere. */
  severity: "high" | "medium";
};

export type LayoutSuggestion = {
  issue: LayoutIssue;
  /** Layout proposto. As sugestões sem layout são descartadas. */
  layout: LayoutKey;
  /** Confiança da proposta, 0 a 1. Serve para ordenar. */
  confidence: number;
};

export type SmartLayoutReport = {
  slideId: string;
  issues: LayoutIssue[];
  suggestions: LayoutSuggestion[];
  /** `true` quando não há nada a melhorar — informação útil, não um erro. */
  alreadyGood: boolean;
};

/**
 * Limiares do diagnóstico.
 *
 * Constantes nomeadas, não números soltos: são decisões de conteúdo, e o
 * primeiro pedido de revisão vai ser "porque é que 6 cards já é demais?".
 */
const CARDS_IN_GRID = 6;
const DENSE_WORDS_PER_ELEMENT = 160;
/** Abaixo deste total, uma página sem imagem é um vazio com título. */
const MIN_WORDS_FOR_MEANING = 12;
/** A partir deste total, texto e imagem lado a lado não convivem. */
const WORDS_TO_NEED_A_SPLIT = 45;

const slotsOf = (elements: readonly StudioElement[]) =>
  Array.from(new Set(elements.map((element) => element.kind)));

const has = (elements: readonly StudioElement[], kind: StudioElement["kind"]) =>
  elements.some((element) => element.kind === kind);

/** Todo o texto visível da página, para detecções por palavra-chave. */
const textOf = (slide: StudioSlide) =>
  [
    slide.eyebrow,
    slide.title,
    slide.body,
    ...slide.elements.filter((e) => e.kind === "text").map((e) => e.text),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

/** Contagem de palavras de TODOS os elementos, não só do corpo. */
const slideWordCount = (slide: StudioSlide) =>
  wordCount(slide.body) +
  slide.elements.reduce((sum, element) => {
    if (element.kind === "text") return sum + wordCount(element.text);
    if (element.kind === "cards")
      return sum + element.items.reduce((n, i) => n + wordCount(`${i.title} ${i.body}`), 0);
    if (element.kind === "timeline") return sum + element.steps.length * 12;
    if (element.kind === "table") return sum + element.rows.length * 8;
    return sum;
  }, 0);

/**
 * Analisa UMA página e diz o que está a funcionar mal.
 *
 * Não escreve nada e não decide sozinha: devolve as queixas com uma proposta
 * para cada. Quem aplica é o editor, depois de mostrar a comparação ao ADMIN
 * (item 17).
 */
export function analyzeSlide(slide: StudioSlide): SmartLayoutReport {
  const issues: LayoutIssue[] = [];
  const elements = slide.elements;
  const words = slideWordCount(slide);
  const slots = slotsOf(elements);

  /* --- 1. Excesso de texto ------------------------------------------------ */
  // Medido contra o orçamento do PAPEL que o texto ocupa, não do tamanho
  // absoluto: 130 palavras numa capa de duas linhas é excesso; as mesmas numa
  // página de serviços podem estar bem distribuídas.
  const bodyExcess = excessWords(slide.body, "body");
  const titleExcess = excessWords(slide.title, "title");
  if (bodyExcess > 0 || titleExcess > 0) {
    issues.push({
      code: "TEXTO_EXCESSO",
      message:
        titleExcess > 0
          ? `O título tem ${titleExcess} palavras a mais do que a página comporta.`
          : `O texto tem ${bodyExcess} palavras a mais do que a página comporta.`,
      severity: "high",
    });
  }

  /* --- 2. Página sem imagem, com texto que a merecia ---------------------- */
  if (words > WORDS_TO_NEED_A_SPLIT && !has(elements, "image") && !has(elements, "gallery")) {
    issues.push({
      code: "SEM_IMAGEM",
      message: "Há texto suficiente para uma página com imagem, e a página não tem nenhuma.",
      severity: "medium",
    });
  }

  /* --- 3. Imagem sem contexto --------------------------------------------- */
  // Uma imagem sozinha não vende uma proposta: o cliente precisa de ler o que
  // está a ver. Excepto a capa e a galeria, que são feitas para falar sozinhas.
  const isShowcase = slide.layout === "cover" || slide.layout === "image-full" || slide.layout === "gallery";
  if (has(elements, "image") && !isShowcase && !slide.title.trim() && words < MIN_WORDS_FOR_MEANING) {
    issues.push({
      code: "IMAGEM_SEM_TEXTO",
      message: "A imagem não tem nenhum texto que a explique.",
      severity: "high",
    });
  }

  /* --- 4. Desequilíbrio imagem/texto -------------------------------------- */
  if (has(elements, "image") && words > DENSE_WORDS_PER_ELEMENT) {
    issues.push({
      code: "DESEQUILIBRIO",
      message: `Há ${words} palavras e uma imagem: o texto não cabe ao lado da imagem.`,
      severity: "medium",
    });
  }

  /* --- 5. Cards a mais para a grelha -------------------------------------- */
  const totalCards = elements.reduce(
    (n, element) => n + (element.kind === "cards" ? element.items.length : 0),
    0,
  );
  if (totalCards > CARDS_IN_GRID) {
    issues.push({
      code: "CARDS_DEMAIS",
      message: `${totalCards} cards numa só página ficam pequenos demais para ler.`,
      severity: "high",
    });
  }

  /* --- 6. Hierarquia fraca ------------------------------------------------ */
  if (!slide.title.trim() && slide.layout !== "cover" && words > 20) {
    issues.push({
      code: "HIERARQUIA_FRACA",
      message: "A página não tem título: nada diz ao cliente do que se trata.",
      severity: "high",
    });
  }

  /* --- 7. Valor sem destaque ---------------------------------------------- */
  // Item 11: "aumentar destaque do valor". Detecta-se pela MENÇÃO de valor
  // comercial no texto sem nenhum elemento `metric` a destacá-lo.
  const mentionsMoney = /(?:investimento|total|orçamento|valor|pagamento|preço|preco)/i.test(textOf(slide));
  if (mentionsMoney && !has(elements, "metric") && slide.layout !== "investment") {
    issues.push({
      code: "VALOR_SEM_DESTAQUE",
      message: "A página fala de valores mas não tem nenhum destaque numérico.",
      severity: "medium",
    });
  }

  /* --- 8. Densidade -------------------------------------------------------- */
  if (words > DENSE_WORDS_PER_ELEMENT * 2) {
    issues.push({
      code: "DENSIDADE",
      message: `São ${words} palavras numa só página: é melhor dividir em duas.`,
      severity: "high",
    });
  }

  /* --- 9. Espaço negativo -------------------------------------------------- */
  // Pouco texto, sem imagem e quase sem elementos: um vazio com título.
  if (
    words > 0 &&
    words < MIN_WORDS_FOR_MEANING &&
    !has(elements, "image") &&
    !has(elements, "gallery") &&
    elements.length <= 1
  ) {
    issues.push({
      code: "ESPACO_NEGATIVO",
      message: "A página está quase vazia: sobra espaço sem conteúdo que o justifique.",
      severity: "medium",
    });
  }

  const suggestions: LayoutSuggestion[] = [];
  issues.forEach((issue) => {
    const layout = proposeLayout(slide, issue.code, slots);
    if (layout) suggestions.push({ issue, layout, confidence: confidenceFor(issue.code) });
  });

  // Ordenadas por confiança: quem vai aplicar tem de começar pela que pesa
  // mais. Sem esta ordenação, "Melhorar layout" numa página sem título e sem
  // imagem corrigia a imagem e deixava o título a falta — porque a imagem
  // estava declarada primeiro.
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return { slideId: slide.id, issues, suggestions, alreadyGood: issues.length === 0 };
}

/**
 * Layout alternativo para uma queixa concreta.
 *
 * A proposta NUNCA viola os `slots` do layout: trocar a tabela por uma galeria
 * seria uma melhoria aparente que perde informação. Por isso o candidato é
 * filtrado por `layoutsAccepting`, e quando não existe nenhum a sugestão é
 * descartada em vez de inventada.
 */
function proposeLayout(
  slide: StudioSlide,
  code: LayoutIssueCode,
  slots: Array<StudioElement["kind"]>,
): LayoutKey | undefined {
  const accepting = layoutsAccepting(slots);
  if (accepting.length === 0) return undefined;

  const preferred: Partial<Record<LayoutIssueCode, LayoutKey>> = {
    TEXTO_EXCESSO: "title-text",
    HIERARQUIA_FRACA: "title-text",
    CARDS_DEMAIS: "process",
    DENSIDADE: "list",
    IMAGEM_SEM_TEXTO: "text-image",
    DESEQUILIBRIO: "text-image",
    VALOR_SEM_DESTAQUE: "metric-highlight",
    SEM_IMAGEM: "text-image",
    ESPACO_NEGATIVO: "cards-asymmetric",
  };

  const wanted = preferred[code];
  // Só é aceite se a página NÃO for já esse layout: sugerir o que está aplicado
  // faz o botão não mudar nada e desensibiliza o ADMIN.
  if (wanted && wanted !== slide.layout && accepting.includes(wanted)) return wanted;

  return accepting.find((key) => key !== slide.layout);
}

/** Confiança da proposta. Problemas estruturais pesam mais que estéticos. */
function confidenceFor(code: LayoutIssueCode): number {
  const weights: Record<LayoutIssueCode, number> = {
    TEXTO_EXCESSO: 0.9,
    HIERARQUIA_FRACA: 0.85,
    CARDS_DEMAIS: 0.8,
    DENSIDADE: 0.75,
    IMAGEM_SEM_TEXTO: 0.7,
    DESEQUILIBRIO: 0.6,
    VALOR_SEM_DESTAQUE: 0.55,
    SEM_IMAGEM: 0.5,
    ESPACO_NEGATIVO: 0.4,
  };
  return weights[code];
}

/**
 * Reduz o texto para o orçamento SEM apagar nada.
 *
 * Devolve `null` quando não é possível sem perder conteúdo — o que é
 * preferível a uma amputação silenciosa do que o ADMIN escreveu.
 */
function shortenPreservingWords(body: string, maxWords: number): string | null {
  if (wordCount(body) <= maxWords) return body;
  const kept: string[] = [];
  let used = 0;
  for (const sentence of splitSentences(body)) {
    const size = wordCount(sentence);
    if (used + size > maxWords) break;
    kept.push(sentence);
    used += size;
  }
  return kept.length > 0 ? kept.join(" ") : null;
}

/**
 * Melhora UMA página, preservando o conteúdo comercial.
 *
 * O que esta função NUNCA faz:
 *  · apagar texto que o ADMIN escreveu;
 *  · inventar texto;
 *  · criar um `metric` (um destaque numérico depende do servidor — ver
 *    `assertNoCommercialInvented`; inventar um aqui seria o pior defeito
 *    possível numa proposta comercial);
 *  · trocar imagens.
 *
 * Só reorganiza o que já lá está: deriva um título das primeiras frases do
 * corpo quando falta um, encurta o corpo até ao orçamento mantendo frases
 * inteiras, e troca o layout por um compatível com os mesmos elementos.
 */
export function improveSlide(slide: StudioSlide): StudioSlide {
  const report = analyzeSlide(slide);
  if (report.alreadyGood) return slide;

  const top = report.suggestions[0];
  if (!top) return slide;

  let title = slide.title;
  let body = slide.body;

  switch (top.issue.code) {
    case "HIERARQUIA_FRACA": {
      // Deriva o título da primeira frase do corpo. É conteúdo do próprio
      // ADMIN, não texto novo — por isso é aceitável.
      //
      // O corte é por PALAVRA: `slice` a meio devolveria "palavra1 palavra2 pal"
      // num título, e um título truncado ao meio lê-se como erro de escrita.
      const derived = splitSentences(slide.body)[0];
      if (derived) {
        const words = derived.split(/\s+/);
        const short = words.length > 14 ? `${words.slice(0, 14).join(" ")}…` : derived;
        title = short;
      }
      break;
    }
    case "TEXTO_EXCESSO":
    case "DENSIDADE": {
      const trimmed = shortenPreservingWords(body, 90);
      if (trimmed) body = trimmed;
      break;
    }
    default:
      break;
  }

  const next = { ...slide, title, body, layout: top.layout };
  // Devolve a MESMA referência quando nada mudou de facto. Sem isto, `improveDeck`
  // contaria como alteradas páginas que só tinham um aviso — e o item 11 diz
  // para não mexer no que já está bom.
  const unchanged =
    next.title === slide.title && next.body === slide.body && next.layout === slide.layout;
  return unchanged ? slide : next;
}

/**
 * Aplica "Melhorar layout" a todas as páginas de um deck.
 *
 * Devolve um NOVO deck e o relatório do que mudou. O original nunca é mutado:
 * é isso que permite ao editor oferecer "Restaurar" (item 17) sem precisar de
 * infraestrutura de histórico.
 *
 * As páginas são melhoradas por INDEPENDÊNCIA: uma capa não é alterada por
 * causa do que acontece no meio da apresentação.
 */
export function improveDeck(deck: StudioDeck): {
  deck: StudioDeck;
  reports: SmartLayoutReport[];
  changed: number;
} {
  const reports = deck.slides.map(analyzeSlide);
  const slides = deck.slides.map((slide) => improveSlide(slide));
  return {
    deck: { ...deck, slides },
    reports,
    changed: slides.filter((slide, index) => slide !== deck.slides[index]).length,
  };
}
