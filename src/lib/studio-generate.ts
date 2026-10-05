/**
 * FASE 4E — CRIAÇÃO COM IA (itens 4C-5).
 *
 * Este módulo é o que falta entre "existem muitas funções boas" e "o ADMIN tem um
 * botão". As capacidades já existiam e eram testadas uma a uma — estrutura por
 * IA (`studio-outline`), texto (`studio-text`), importação (`studio-import`),
 * sugestões (`studio-copilot`), remix (`studio-ai`) — mas **ninguém as ligava**.
 * Esta é a camada que as compõe numa só, com uma garantia comum.
 *
 * O que este módulo garante, e que é o ponto do item 4C-5:
 *
 *  1. **Nenhum número é inventado.** As páginas comerciais são criadas como
 *     elementos LIGADOS (`binding`), nunca com texto escrito à mão. O valor vem
 *     da `ProposalVersion` no momento da leitura. Uma apresentação gerada com
 *     "R$ 45.000" escrito num parágrafo é uma proposta que o cliente pode
 *     aprovar contra um valor que ninguém emitiu — e a falha é invisível porque
 *     o número parece certo.
 *
 *  2. **A estrutura respeita o que existe.** `suggestOutline` decide as páginas
 *     a partir do que o projecto tem; `generateDeck` não inventa um cronograma
 *     que não foi calculado nem uma secção de investimento sem linhas.
 *
 *  3. **A alteração é auditável.** A operação devolve as páginas que tocou,
 *     para que a mesma decisão que produz a apresentação decida o que entra no
 *     registo de auditoria (item 56).
 *
 * É PURO e determinístico: as mesmas entradas dão sempre o mesmo deck. Não há
 * relógio nem aleatoriedade, o que faz com que um teste possa fixar o
 * resultado — e é isso que permite provar que a IA não mexe no dinheiro.
 */

import {
  addBlankSlide,
  blankSlide,
  insertElement,
  updateSlide,
} from "./studio-manipulate";
import { outlineToSections, suggestOutline, type OutlineSectionKey } from "./studio-outline";
import type { CommercialBinding } from "./studio-commercial";
import { assertNoCommercialInvented, stableId, type CommercialSlots } from "./studio-deck";
import type { StudioDeck, StudioElement, StudioSlide } from "./studio-deck";

/* -------------------------------------------------------------------------- */
/* 1. ESTRUTURA POR IA                                                         */
/* -------------------------------------------------------------------------- */

/** O que o projecto sabe. Cada `true` autoriza uma secção. */
export type ProjectFacts = {
  projeto: boolean;
  briefing: boolean;
  servicos: boolean;
  cronograma: boolean;
  pagamento: boolean;
  validade: boolean;
  proximoPasso: boolean;
};

/** A estrutura proposta, antes de virar páginas. */
export type GeneratedStructure = {
  sections: ReturnType<typeof outlineToSections>;
  /** `true` quando a estrutura foi cortada por `MAX_RECOMMENDED_SLIDES`. */
  truncated: boolean;
  /** Razão de cada secção incluída. Sai no registo. */
  reasons: Record<string, string>;
  /** Secções que entram sem os dados de que precisam. Vêm marcadas. */
  emptyRequired: OutlineSectionKey[];
};

/**
 * Estrutura por IA: que páginas esta proposta deve ter.
 *
 * Chama `suggestOutline` e passa por `outlineToSections`, que é quem decide a
 * ordem e aplica o limite de `MAX_RECOMMENDED_SLIDES`. O limite existe porque
 * uma proposta de trinta páginas não se lê, e o corte é VISÍVEL (`truncated`)
 * em vez de silencioso.
 */
export function generateStructure(facts: ProjectFacts): GeneratedStructure {
  const suggested = suggestOutline(facts);
  const sections = outlineToSections(suggested);
  return {
    sections,
    truncated: suggested.length > sections.length,
    reasons: Object.fromEntries(sections.map((section) => [section.key, section.reason ?? ""])),
    /**
     * Secções comerciais que entram visíveis SEM os dados que precisam.
     *
     * `outlineToSections` exclui a opcional que não tem dado, mas mantém a
     * ESSENCIAL — e isso é deliberado: esconder a secção de investimento
     * resolveria o sintoma e criaria uma proposta inválida que ninguém percebeu.
     *
     * O que esta lista garante é que elas entram MARCADAS, nunca apresentadas
     * como se tivessem números. É a diferença entre uma proposta que avisa e uma
     * que mente por omissão.
     */
    emptyRequired: sections.filter((section) => !section.dataAvailable).map((section) => section.key),
  };
}
/* -------------------------------------------------------------------------- */
/* 2. PROJECTO → PROPOSTA                                                      */
/* -------------------------------------------------------------------------- */

/** A fonte comercial que cada secção comercial recebe. */
const SECTION_BINDINGS: Partial<Record<OutlineSectionKey, string>> = {
  SERVICOS: "SERVICOS",
  ESCOPO: "ESCOPO",
  INVESTIMENTO: "INVESTIMENTO",
  CRONOGRAMA: "CRONOGRAMA",
  CONDICOES: "PAGAMENTO",
};

/**
 * Converte a estrutura num deck completo.
 *
 * A regra que atravessa toda a função: uma secção comercial recebe um elemento
 * LIGADO, que guarda a FONTE e não o valor. É a regra de `studio-commercial`
 * aplicada aqui na criação, e é o que garante que uma apresentação gerada não
 * possa divergir da proposta que a origina.
 */
export function generateDeck(input: {
  facts: ProjectFacts;
  theme?: string;
  /** Título da capa. */
  title?: string;
}): StudioDeck {
  const estrutura = generateStructure(input.facts);

  let deck: StudioDeck = {
    theme: (input.theme ?? "arqvertice-minimal") as StudioDeck["theme"],
    origin: null,
    slides: [],
  };

  estrutura.sections.forEach((section, position) => {
    // A primeira página é a capa, e fica vazia para o ADMIN escrever.
    if (position === 0) {
      deck = addBlankSlide(deck, 0, "cover");
      if (input.title) deck = updateSlide(deck, 0, { title: input.title });
      return;
    }

    deck = addBlankSlide(deck, deck.slides.length, layoutFor(section.key));
    const index = deck.slides.length - 1;
    deck = updateSlide(deck, index, { title: section.title });

    const binding = SECTION_BINDINGS[section.key];
    if (binding) deck = insertElement(deck, index, linkedElement(binding));
  });

  // Uma estrutura sem secções produz um deck sem páginas — e um deck sem páginas
  // não é uma apresentação. A capa entra para o ADMIN ter onde começar.
  return deck.slides.length ? deck : addBlankSlide(deck, 0, "cover");
}

/**
 * O elemento ligado de uma secção comercial.
 *
 * `rows: []` são deliberados: o elemento declara a FONTE e fica à espera.
 * à espera. Preencher um valor aqui seria escrever um número que ninguém
 * calculou, e é exactamente o que `assertNoCommercialInvented` recusa.
 */
function linkedElement(binding: string): StudioElement {
  return {
    kind: "table",
    id: `el-${binding.toLowerCase()}`,
    binding: binding as CommercialBinding,
    columns: [],
    rows: [],
  };
}

/** Disposição que serve cada secção. */
function layoutFor(key: OutlineSectionKey): StudioSlide["layout"] {
  // As chaves são as do `LayoutKey` real. Escolhi as expressly-naídas
  // (`investment`, `services`, `payment-conditions`) em vez de um genérico: são
  // disposições desenhadas para o conteúdo que vai receber, e uma secção de
  // investimento numa página de texto corrido é um layout que o ADMIN vai ter
  // de corrigir à mão.
  switch (key) {
    case "CAPA":
      return "cover";
    case "SERVICOS":
      return "services";
    case "ESCOPO":
      return "scope";
    case "INVESTIMENTO":
      return "investment";
    case "CRONOGRAMA":
      return "timeline";
    case "CONDICOES":
      return "payment-conditions";
    case "PROXIMOS_PASSOS":
      return "cta";
    default:
      return "title-text";
  }
}

/* -------------------------------------------------------------------------- */
/* 3. GERAÇÃO E COMERCIAL                                                      */
/* -------------------------------------------------------------------------- */

/** O resultado de gerar uma apresentação. */
export type GenerationResult = {
  deck: StudioDeck;
  /** Páginas criadas. */
  pages: string[];
  truncated: boolean;
  /** `true` quando o deck gerado não inventa nenhum valor comercial. */
  commercialSafe: boolean;
};

/**
 * Gera a apresentação a partir do projecto, e PROVA que não inventou dinheiro.
 *
 * A prova não é uma promessa: `assertNoCommercialInvented` corre sobre o deck
 * gerado com os valores reais da proposta. Se a geração alguma vez escrevesse um
 * número à mão, esta função rebentava — em vez de o número chegar ao cliente.
 *
 * Por isso `source` não é opcional: sem os valores reais não há como verificar,
 * e uma geração que não se pode verificar não deve poder ser gravada.
 */
export function generateFromProject(input: {
  facts: ProjectFacts;
  title?: string;
  theme?: string;
  /**
   * Os valores REAIS da proposta, para a verificação.
   *
   * É o que `assertNoCommercialInvented` confronta com o que o deck escreve. Sem
   * estes valores não há verificação possível, e uma geração que não se pode
   * verificar não deve poder ser gravada — por isso não são opcionais.
   */
  source: CommercialSlots;
}): GenerationResult {
  const deck = generateDeck({ facts: input.facts, title: input.title, theme: input.theme });

  // Verificação real, com os números reais. É o que distingue "o deck não tem
  // números escritos" de "o deck não tem números ERRADOS".
  assertNoCommercialInvented(deck, input.source);

  return {
    deck,
    pages: deck.slides.map((slide) => slide.id),
    truncated: generateStructure(input.facts).truncated,
    commercialSafe: true,
  };
}

/* -------------------------------------------------------------------------- */
/* 4. REMIX                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cria uma variante a partir de um deck, com sal de diferenciação.
 *
 * O `salt` é o que impede que duas remixes da mesma origem sejam
 * indistinguíveis: os ids derivam dele, e restaurar a original não desfaria a
 * variante. Determinístico — o mesmo `salt` dá a mesma variante.
 */
export function remixVariant(deck: StudioDeck, salt: string): StudioDeck {
  return {
    ...deck,
    origin: { proposalId: `remix-${salt}`, version: deck.slides.length, label: "Variação" },
    slides: deck.slides.map((slide, index) => ({
      ...slide,
      id: stableId(`${salt}-${index}-${slide.title}`),
      elements: slide.elements.map((element, position) => ({
        ...element,
        id: stableId(`${salt}-${index}-${position}-${element.id}`),
      })),
    })),
  };
}

/** Deck vazio com a estrutura mínima — o ponto de partida de "gerar". */
export function emptyDeck(theme = "arqvertice-minimal"): StudioDeck {
  return { theme: theme as StudioDeck["theme"], origin: null, slides: [blankSlide("cover", 0)] };
}
