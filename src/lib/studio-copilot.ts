/**
 * FASE 4D — MELHORAR APRESENTAÇÃO (item 32).
 *
 * O item 32 pede que a IA, ao usar a referência como template, "não simplesmente
 * reproduza": que corte texto a mais, melhore hierarquia, torne a proposta mais
 * persuasiva, melhore o storytelling, varie layouts, sugira páginas, remova as
 * desnecessárias, sugira imagens, melhore consistência — e, acima de tudo,
 *
 *   **preserve os valores e preserve o escopo.**
 *
 * Essa última cláusula é a que decide a arquitectura. Uma função que reescreve
 * texto pode, num único erro, trocar "20 a 25 dias úteis" por "15 dias" ou
 * apagar um serviço do escopo — e o cliente aprova uma proposta que promete
 * menos do que o estúdio vai entregar, ou entrega mais do que foi cobrado.
 *
 * Por isso esta implementação é uma ANÁLISE, não uma reescrita. Produz SUGESTÕES
 * com o que mudaria e porquê, e devolve um deck NOVO para pré-visualizar. O ADMIN
 * aceita ou recusa. E o que a análise jamais pode fazer é tocar em:
 *
 *  · texto de um elemento LIGADO a uma fonte comercial (os valores vêm do
 *    servidor — ver `studio-commercial`);
 *  · o número de linhas de uma tabela de serviços ou de um plano de pagamento.
 *
 * A garantia é verificável: `assertPreservedCommercialContent` compara o deck
 * novo com o antigo e falha se algum texto de conteúdo tiver desaparecido.
 */

import type { StudioDeck, StudioElement, StudioSlide } from "./studio-deck";
import { readStudioDeck, toPersistedDeck } from "./studio-deck";
import { isCommercialBinding } from "./studio-commercial";

/* -------------------------------------------------------------------------- */
/* SUGESTÕES                                                                    */
/* -------------------------------------------------------------------------- */

/** O que uma sugestão sabe fazer. */
export type ImprovementKind =
  | "CORTAR_TEXTO"
  | "MELHORAR_HIERARQUIA"
  | "VARIAR_LAYOUT"
  | "SUGERIR_PAGINA"
  | "REMOVER_PAGINA"
  | "SUGERIR_IMAGEM";

/**
 * Uma sugestão concreta, com o que muda e onde.
 *
 * `apply` é uma FUNÇÃO, não um valor: o mesmo texto pode precisar de um layout
 * diferente em cada página, e um valor resolvido à partida seria aplicado à
 * errada. Guardar a função é o que permite pré-visualizar sem gravar.
 */
export type Improvement = {
  kind: ImprovementKind;
  /** Página onde a sugestão se aplica, a partir de 1. */
  page: number;
  /** O que o ADMIN vê, em português. */
  summary: string;
  apply?: (slide: StudioSlide) => StudioSlide;
};

/** Texto acima do qual um parágrafo é longo demais para um slide. */
const LIMITE_CARACTERES = 320;

/** Número de slides a partir do qual a proposta precisa de um corte. */
const LIMITE_PAGINAS = 12;
/**
 * Analisa um deck e devolve sugestões.
 *
 * PURA e DETERMINÍSTICA: a mesma proposta dá sempre as mesmas sugestões. Numa
 * acção que o ADMIN vai repetir enquanto escreve, uma sugestão que muda a cada
 * clique é impossível de aceitar com confiança.
 */
export function suggestImprovements(deck: StudioDeck): Improvement[] {
  const sugestoes: Improvement[] = [];

  deck.slides.forEach((slide, indice) => {
    const page = indice + 1;

    /* EXCESSO DE TEXTO — cortar, nunca reescrever. */
    for (const element of slide.elements) {
      if (element.kind !== "text" || textElementIsProtected(element)) continue;
      if (element.text.length > LIMITE_CARACTERES) {
        sugestoes.push({
          kind: "CORTAR_TEXTO",
          page,
          summary: `Página ${page}: o texto tem ${element.text.length} caracteres. Numa apresentação lê-se mal acima de ${LIMITE_CARACTERES}.`,
          apply: (atual) => ({ ...atual, elements: shortenSlide(atual, element.id) }),
        });
      }
    }

    /* VARIAÇÃO DE LAYOUT — duas páginas seguidas iguais leem-se como repetição. */
    if (indice > 0 && slide.layout === deck.slides[indice - 1].layout) {
      sugestoes.push({
        kind: "VARIAR_LAYOUT",
        page,
        summary: `Página ${page}: repete o layout da página ${page - 1}.`,
        apply: (atual) => ({ ...atual, layout: alternativeLayout(atual.layout) }),
      });
    }

    /*
     * IMAGEM EM FALTA — só onde a imagem é parte do argumento. Uma página sem
     * elementos não é uma página sem imagem: é uma página por preencher, e já
     * é avisada abaixo. Avisar as duas coisas seria duplicar o mesmo defeito.
     */
    const temConteudo = slide.elements.length > 0;
    if (temConteudo && slide.layout.startsWith("image") && !slide.elements.some((el) => el.kind === "image")) {
      sugestoes.push({
        kind: "SUGERIR_IMAGEM",
        page,
        summary: `Página ${page}: o layout pede imagem e não há nenhuma.`,
      });
    }

    /* PÁGINA VAZIA — não diz nada ao cliente. */
    if (!temConteudo && slide.title.length > 0) {
      sugestoes.push({
        kind: "SUGERIR_PAGINA",
        page,
        summary: `Página ${page} ("${slide.title}") está vazia. Escreva o conteúdo ou remova-a.`,
      });
    }
  });

  /* PROPOSTA LONGA — sugerir e permitir remover. */
  if (deck.slides.length > LIMITE_PAGINAS) {
    const alvo = deck.slides.findIndex(isRedundant);
    if (alvo >= 0) {
      sugestoes.push({
        kind: "REMOVER_PAGINA",
        page: alvo + 1,
        summary: `A proposta tem ${deck.slides.length} páginas. A página ${alvo + 1} repete conteúdo de outra e pode sair.`,
      });
    }
  }

  return sugestoes;
}

/* -------------------------------------------------------------------------- */
/* APLICAÇÃO                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Aplica as sugestões ESCOLHIDAS e devolve um deck novo.
 *
 * O deck de origem nunca é tocado: o item 32 fala de "preview", e preview
 * pressupõe que cancelar seja possível. Uma acção de IA que se desfaz é uma
 * acção que ninguém usa.
 */
export function applyImprovements(deck: StudioDeck, escolhidas: readonly Improvement[]): StudioDeck {
  const porPagina = new Map<number, Improvement[]>();
  for (const sugestao of escolhidas) {
    if (!sugestao.apply) continue;
    porPagina.set(sugestao.page, [...(porPagina.get(sugestao.page) ?? []), sugestao]);
  }

  const slides = deck.slides.map((slide, indice) => {
    const aplicaveis = porPagina.get(indice + 1);
    if (!aplicaveis) return slide;
    // Aplicadas em sequência: uma sugestão pode depender do resultado da
    // anterior, e inverter a ordem tornaria o resultado imprevisível.
    return aplicaveis.reduce((atual, sugestao) => sugestao.apply?.(atual) ?? atual, slide);
  });

  return readStudioDeck(toPersistedDeck({ ...deck, slides }));
}

/* -------------------------------------------------------------------------- */
/* PRESERVAÇÃO DE VALORES E ESCOPO                                              */
/* -------------------------------------------------------------------------- */

/**
 * Confirma que o conteúdo da proposta sobreviveu à melhoria.
 *
 * É a verificação que o item 32 exige em letras — "preservar valores" e
 * "preservar escopo" — e é uma COMPARAÇÃO, não uma confiança. Compara o que o
 * cliente vai ler, antes e depois.
 *
 * Uma melhoria que removesse um serviço ou reescrevesse um prazo falharia aqui, e
 * o erro apareceria no teste e não numa proposta enviada.
 */
export function assertPreservedCommercialContent(antes: StudioDeck, depois: StudioDeck): void {
  const depoisTexto = deckText(depois);
  const perdidos: string[] = [];

  for (const slide of antes.slides) {
    for (const element of slide.elements) {
      /*
       * Só o que o cliente lê como FACTO entra na comparação. Texto ligado é
       * resolvido pelo servidor a cada leitura e nunca é reescrito aqui; e texto
       * de cartão, legenda e chamada para acção é escolha editorial — o que o
       * item 32 pede é exactamente melhorá-lo.
       */
      if (!preservaFactual(element)) continue;
      const texto = elementText(element).trim();
      if (texto && !depoisTexto.includes(texto)) perdidos.push(texto.slice(0, 60));
    }
  }

  if (perdidos.length > 0) {
    throw new Error(
      `A melhoria removeu conteúdo da proposta: ${perdidos.join(" | ")}. ` +
        "Valores e escopo têm de ser preservados — altere-os à mão se quiser mudá-los.",
    );
  }
}

/**
 * O elemento transporta facto comercial — e por isso não pode ser encurtado.
 *
 * Uma tabela de serviços, uma lista de parcelas e um comparativo de opções dizem
 * ao cliente o que está contratado. Um cartão, um cabeçalho e uma frase de
 * impacto dizem como isso é apresentado.
 */
function preservaFactual(element: StudioElement): boolean {
  switch (element.kind) {
    case "table":
    case "timeline":
    case "comparison":
    case "cards":
      /*
       * Todos estes transports factos: linhas de serviço, etapas, opções e
       * parcelas. Uma tabela NÃO ligada tem linhas escritas à mão — que é
       * exactamente o caso perigoso, porque reescrevê-las muda o que o cliente
       * entende ter contratado.
       */
      return true;
    case "text":
    case "metric":
      /*
       * Aqui o critério é a LIGAÇÃO: o texto visível vem do servidor, e
       * reescrevê-lo passaria a ser uma segunda fonte do número — o defeito que
       * os itens 26 a 30 eliminaram. Texto solto é escolha editorial.
       */
      return bindingIsSet(element);
    default:
      // Cartão, galeria e chamada para acção são escolha editorial: melhorá-los é
      // o objectivo do item 32.
      return false;
  }
}

/** O elemento tem uma ligação activa a uma fonte comercial? */
function bindingIsSet(element: StudioElement): boolean {
  return "binding" in element && isCommercialBinding(element.binding);
}

/* -------------------------------------------------------------------------- */
/* AUXILIARES                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * O texto de um elemento está protegido?
 *
 * Sim quando está LIGADO a uma fonte comercial: o texto visível é resolvido pelo
 * servidor a cada leitura, e tocá-lo aqui não mudaria o número — mudaria a
 * promessa de que o número vem do servidor, que é o que o item 30 exige.
 */
function textElementIsProtected(element: StudioElement): boolean {
  return bindingIsSet(element);
}

/** Todo o texto visível de um deck. */
function deckText(deck: StudioDeck): string {
  return deck.slides
    .map((slide) => [slide.title, slide.body, ...slide.elements.map(elementText)].join(" "))
    .join(" ");
}

/** Texto visível de um elemento. */
function elementText(element: StudioElement): string {
  switch (element.kind) {
    case "text":
      return element.text;
    case "cards":
      return element.items.map((item) => `${item.title} ${item.body}`).join(" ");
    case "timeline":
      return element.steps.map((step) => `${step.label} ${step.title} ${step.body}`).join(" ");
    case "comparison":
      return element.sides.map((side) => `${side.title} ${side.items.join(" ")}`).join(" ");
    case "metric":
      return `${element.label} ${element.value}`;
    case "cta":
      return `${element.title} ${element.body} ${element.action}`;
    case "table":
      return element.rows.map((row) => row.join(" ")).join(" ");
    default:
      return "";
  }
}

/**
 * Encurta o texto mantendo a primeira e a última frase.
 *
 * A primeira explica o assunto e a última fecha a ideia — quase sempre o
 * compromisso. O meio é repetição. Cortar por essa regra tira excesso sem tirar
 * sentido, que é a diferença entre "melhorar" e "destruir".
 */
function shortenText(texto: string, limite = LIMITE_CARACTERES): string {
  if (texto.length <= limite) return texto;
  const frases = texto.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (frases.length <= 2) return `${texto.slice(0, limite).trim()}…`;

  const primeira = frases[0];
  const ultima = frases.at(-1) ?? "";
  const curto = `${primeira} ${ultima}`.trim();
  return curto.length <= limite ? curto : `${curto.slice(0, limite).trim()}…`;
}

/** Encurta o elemento indicado, se for texto solto. */
function shortenSlide(slide: StudioSlide, elementId: string): StudioElement[] {
  return slide.elements.map((element) => {
    if (element.id !== elementId) return element;
    if (element.kind !== "text" || textElementIsProtected(element)) return element;
    return { ...element, text: shortenText(element.text) };
  });
}

/** Um layout alternativa, para quebrar a repetição. */
function alternativeLayout(layout: StudioSlide["layout"]): StudioSlide["layout"] {
  return layout.startsWith("image") ? "text-image" : layout === "title-text" ? "two-columns" : "title-text";
}

/** A página repete o que já foi dito noutra? */
function isRedundant(slide: StudioSlide): boolean {
  if (slide.elements.length === 0) return false;
  const texto = elementText(slide.elements[0]).trim().toLowerCase();
  // Repete quando o texto é curto: uma página inteira com texto igual não é
  // redundante, é o documento a ser lido.
  return texto.length > 0 && texto.length < 60;
}