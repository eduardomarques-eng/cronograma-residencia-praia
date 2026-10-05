/**
 * FASE 4D — IMPORTAÇÃO DE PDF (itens 33, 34 e 35).
 *
 * O item 33 pede uma importação que seja uma FUNÇÃO DE PRIMEIRA CLASSE, e o
 * critério que ele dá é explícito:
 *
 *   > A prioridade é CONTEÚDO + ESTRUTURA + EDITABILIDADE.
 *   > Não simplesmente converter cada página em uma imagem.
 *
 * Essa frase decide a arquitectura. Uma página rasterizada é fiel e inútil: o
 * ADMIN não pode corrigir uma palavra, e o item 33 diz que quando a reprodução
 * exacta é impossível há de "preservar conteúdo e criar a melhor aproximação
 * editável". Perder a edição é perder o documento.
 *
 * Por isso a importação vive numa FUNÇÃO PURA que recebe TEXTO EXTRAÍDO e
 * devolve um DECK. Não recebe um PDF e não conhece uma biblioteca de PDF — o
 * que extrai texto é um detalhe de infra-estrutura (`pdf-extract-service.ts`),
 * substituível, e a estrutura, que é o produto, é testável sem um único byte de
 * PDF. Separar as duas coisas é o que torna a parte difícil testável.
 *
 * O item 35 é a razão de existirem as guardas deste módulo: uma proposta externa
 * tem preços, serviços e parcelas, e NENHUM deles pode tocar no catálogo, no
 * pricing ou no plano de pagamento. Importar cria DADOS DA PROPOSTA; levá-los ao
 * catálogo é uma decisão separada, do ADMIN, e explícita.
 */

import {
  readStudioDeck,
  stableId,
  toPersistedDeck,
  type StudioDeck,
  type StudioElement,
  type StudioSlide,
} from "./studio-deck";
import { isLayoutKey, type LayoutKey } from "./studio-layout";

/* -------------------------------------------------------------------------- */
/* VALORES ENCONTRADOS                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Um valor comercial encontrado no documento importado.
 *
 * Aparece como um DADO OBSERVADO, com a página e o contexto onde foi lido. Não
 * vira preço do sistema em lado nenhum — é informação para o ADMIN decidir, e é
 * exactamente por isso que guarda `context`: "R$ 2.240,00" sem a linha onde
 * estava não é auditável por ninguém.
 */
export type ImportedValue = {
  kind: "MONEY" | "PERCENT" | "AREA" | "DAYS";
  /** O texto tal como apareceu, para o ADMIN confirmar o que leu. */
  raw: string;
  /** Número normalizado, quando o texto era um número. */
  value: number | null;
  /** Página onde foi encontrado, a partir de 1. */
  page: number;
  /** A linha de texto onde apareceu. */
  context: string;
};

const MONEY = /(?:r\$\s*|eur\s*|€\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi;
const PERCENT = /(\d{1,3})\s*%/g;
const AREA = /(\d{1,4})\s*(?:m2|m²|metros\s*quadrados)/gi;
const DAYS = /(\d{1,3})\s*(?:-|–|a)?\s*(?:a\s*)?(\d{1,3})?\s*dias?\b/gi;

/**
 * Converte o número escrito em português num `number`.
 *
 * O ponto é separador de MILHAR e a vírgula é decimal. Confundir os dois daria
 * "R$ 2.240,00" como 2.24 — e um total errado é o pior defeito possível numa
 * importação comercial.
 */
export function parsePortugueseNumber(raw: string): number | null {
  const limpo = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!limpo || !/\d/.test(limpo)) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");

  /*
   * A regra é POSIÇÃO, não presença: o separador decimal é o ÚLTIMO separador
   * que aparece. Em "2.240" o ponto é milhar e não há vírgula; em "2.240,00" a
   * vírgula vem depois e é decimal.
   *
   * Isto importa porque um total importado errado é o pior defeito possível numa
   * importação comercial: o ADMIN leria R$ 2,24 onde o documento diz R$ 2.240.
   */
  let normalizado: string;
  if (ultimaVirgula > ultimoPonto) {
    // Vírgula é o decimal: remove os pontos de milhar e troca a vírgula.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula) {
    /*
     * Só há ponto. Em português é separador de MILHAR — "2.240" são 2240.
     * A excepção é o padrão `d.dd` com um dígito depois do ponto (valores de
     * um item só, como "1.5"), onde o ponto é mesmo decimal.
     */
    const digitosDepois = limpo.split(".").at(-1)?.length ?? 0;
    normalizado = digitosDepois === 3 ? limpo.replace(/\./g, "") : limpo.replace(/,/g, "");
  } else {
    normalizado = limpo;
  }

  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Todos os valores comerciais de uma página.
 *
 * Devolve uma LISTA DE OBSERVAÇÕES, não um total. Somar preços encontrados num
 * documento seria inventar uma arithmetic: eles pertencem a linhas diferentes, e
 * um "total importado" não teria nenhuma base legal nem comercial.
 */
export function extractValues(text: string, page: number): ImportedValue[] {
  const encontrado: ImportedValue[] = [];
  const linhaDe = (index: number): string => text.slice(0, index).split("\n").pop()?.trim() ?? "";

  for (const [padrao, kind] of [
    [MONEY, "MONEY"],
    [PERCENT, "PERCENT"],
    [AREA, "AREA"],
    [DAYS, "DAYS"],
  ] as const) {
    for (const match of text.matchAll(padrao)) {
      encontrado.push({
        kind,
        raw: match[0].trim(),
        value: match[1] ? parsePortugueseNumber(match[1]) : null,
        page,
        context: linhaDe(match.index ?? 0),
      });
    }
  }

  return encontrado;
}
/* -------------------------------------------------------------------------- */
/* BLOCOS E ESTRUTURA                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Um bloco detectado no texto de uma página.
 *
 * O item 33 pede "identificação de blocos" e "identificação de títulos" como
 * passos separados. São, e a distinção importa: um título é um rótulo, um bloco é
 * conteúdo. Confundi-los fazia o editor mostrar "Investimento" como parágrafo e
 * o valor como título.
 */
export type ImportBlock = {
  type: "titulo" | "paragrafo" | "lista" | "tabela";
  /** O conteúdo do bloco. */
  text: string;
  /** Linhas de uma lista, quando é uma. */
  items?: string[];
  /** Colunas e linhas de uma tabela, quando é uma. */
  table?: { columns: string[]; rows: string[][] };
};

/** Palavras que indicam que uma linha é um cabeçalho. */
const TITLE_WORDS =
  /^(?:slide|página|pg\.?)\s*\d+|^\d+[.)]\s|^(?:proposta|escopo|investimento|pagamento|cronograma|op[çc][õo]es|diagn[óo]stico|conclus[ãa]o|contactos?)\b/i;

/** Linha isolada e curta é um título; a mesma linha dentro de um parágrafo, não. */
function looksLikeTitle(linha: string): boolean {
  const limpa = linha.trim();
  if (limpa.length > 90) return false;
  /*
   * Um título NÃO termina em pontuação de frase. Esta regra é o que separa
   * "Pagamento" (rótulo) de "Pagamento: PIX ou Cartão de Crédito." (frase) — sem
   * ela, o parágrafo final de uma página importada era promovido a título e o
   * editor perdia o texto do corpo.
   */
  if (/[.;,]$/.test(limpa)) return false;
  if (TITLE_WORDS.test(limpa)) return true;
  return /^[^.,;]{3,90}$/.test(limpa) && /^[A-ZÀ-Þ]/.test(limpa);
}

/** Linha que começa por marcador de lista. */
const LIST_ITEM = /^\s*(?:[-•*·‣]|\d+[.)])\s+(.+)$/;

/**
 * Detecta se um bloco de linhas é uma TABELA.
 *
 * A heurística é deliberadamente conservadora: exige três ou mais linhas E
 * alinhamento de duas colunas. Uma frase com dois pontos é um parágrafo, e
 * convertê-la em tabela produziria um editor com uma grelha a mais — que é
 * ruído, não estrutura.
 */
function detectTable(linhas: string[]): { columns: string[]; rows: string[][] } | null {
  const comColunas = linhas.filter((linha) => linha.split(/\s{2,}|\t|\|/).filter(Boolean).length >= 2);
  if (comColunas.length < 3 || comColunas.length < linhas.length * 0.6) return null;

  const columns = comColunas[0]
    .split(/\s{2,}|\t|\|/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (columns.length < 2) return null;

  const rows = comColunas.slice(1).map((linha) => {
    const partes = linha.split(/\s{2,}|\t|\|/);
    // Completa a linha até ao número de colunas: uma tabela importada com uma
    // célula em falta tem de mostrar a célula vazia, não deslocar os valores.
    return columns.map((_, index) => (partes[index] ?? "").trim());
  });

  return { columns, rows };
}

/**
 * Segmenta o texto de UMA página em blocos.
 *
 * Recebe texto já extraído e devolve estrutura. É a função mais testável do
 * módulo — não conhece PDF, e é por isso que o item 33 é verificável.
 */
export function detectBlocks(pageText: string): ImportBlock[] {
  const linhas = pageText.split(/\r?\n/);
  const blocos: ImportBlock[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return;
    const texto = paragrafo.join(" ").replace(/\s+/g, " ").trim();
    if (texto) blocos.push({ type: "paragrafo", text: texto });
    paragrafo = [];
  };

  for (let index = 0; index < linhas.length; index += 1) {
    const linha = linhas[index].trim();
    if (!linha) {
      fecharParagrafo();
      continue;
    }

    /*
     * LISTA antes de TABELA, e a ordem é deliberada: uma linha de lista não tem
     * duas colunas, e tentar a tabela primeiro consumia-a na leitura antecipada —
     * a lista nunca chegava a ser reconhecida.
     */
    if (LIST_ITEM.test(linha)) {
      fecharParagrafo();
      const items: string[] = [];
      while (index < linhas.length && LIST_ITEM.test(linhas[index].trim())) {
        const match = LIST_ITEM.exec(linhas[index].trim());
        if (match?.[1]) items.push(match[1].trim());
        index += 1;
      }
      index -= 1;
      if (items.length > 0) blocos.push({ type: "lista", text: items.join("\n"), items });
      continue;
    }

    // TABELA: linhas consecutivas com colunas. Vem DEPOIS da lista de propósito.
    const resto = linhas.slice(index).filter((candidata) => candidata.trim());
    const tabela = detectTable(resto);
    if (tabela) {
      fecharParagrafo();
      blocos.push({ type: "tabela", text: resto.join("\n"), table: tabela });
      index += resto.length - 1;
      continue;
    }

    // TÍTULO: linha curta isolada, no início de um bloco.
    if (paragrafo.length === 0 && looksLikeTitle(linha)) {
      fecharParagrafo();
      blocos.push({ type: "titulo", text: linha });
      continue;
    }

    paragrafo.push(linha);
  }

  fecharParagrafo();
  return blocos;
}

/* -------------------------------------------------------------------------- */
/* LAYOUT POR CONTEÚDO                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Escolhe o layout a partir do conteúdo da página.
 *
/* -------------------------------------------------------------------------- */
/* RECONSTRUÇÃO (item 33)                                                       */
/* -------------------------------------------------------------------------- */

/** Uma página já reconstruída, com o que foi lido dela. */
export type ImportedPage = {
  page: number;
  slide: StudioSlide;
  blocks: ImportBlock[];
  values: ImportedValue[];
};

/**
 * O resultado da importação: o deck EDITÁVEL e o relatório da revisão.
 *
 * Os dois andam juntos de propósito. O item 33 pede "uma tela de revisão após
 * importação" — e uma tela de revisão sem saber o que foi lido, de onde e com que
 * incerteza, não é uma revisão: é um "ok" sem conteúdo.
 */
export type ImportResult = {
  deck: StudioDeck;
  pages: ImportedPage[];
  values: ImportedValue[];
  /** O que a importação NÃO conseguiu fazer, dito ao ADMIN. */
  warnings: string[];
};

/** Constrói o elemento de um bloco. */
function elementForBlock(block: ImportBlock, origin: string, position: number): StudioElement | null {
  const id = stableId("el", origin, position, block.type);

  if (block.type === "titulo") {
    // O título da página é o TÍTULO da PÁGINA, não um elemento solto: o DTO
    // público e o PDF leem `slide.title`, e um título dentro de um elemento
    // texto não apareceria em nenhum dos dois.
    return null;
  }

  if (block.type === "lista" && block.items) {
    return {
      kind: "cards",
      id,
      items: block.items.map((body) => ({ title: "", body, image: null })),
      variant: "stacked",
    };
  }

  if (block.type === "tabela" && block.table) {
    return {
      kind: "table",
      id,
      columns: block.table.columns,
      rows: block.table.rows,
      // A tabela importada NUNCA é ligada a uma fonte comercial: os valores
      // foram lidos de um documento externo e não são os da proposta. Ver o
      // item 35 e `assertImportDidNotTouchCatalog`.
      binding: null,
    };
  }

  return { kind: "text", id, role: "body", text: block.text };
}

/**
 * Reconstrói um deck editável a partir do texto extraído.
 *
 * Esta é a função que o item 33 chama "a melhor aproximação editável": preserva
 * o TEXTO e a ESTRUTURA, e onde não consegue, diz que não conseguiu em vez de
 * fingir.
 *
 * Determinística e pura: o mesmo texto dá sempre o mesmo deck, o que permite
 * comparar duas importações e garante que "desfazer" volta ao estado anterior.
 */
export function buildImportedDeck(
  pages: ReadonlyArray<{ page: number; text: string }>,
  options: { origin?: string; theme?: string } = {},
): ImportResult {
  const origin = options.origin ?? "import";
  const avisos: string[] = [];
  const importadas: ImportedPage[] = [];

  pages.forEach((pagina, indice) => {
    const texto = pagina.text.trim();
    if (!texto) {
      avisos.push(`A página ${pagina.page} não tem texto extraível e foi ignorada. Se tinha imagens, insira-as à mão.`);
      return;
    }

    const blocos = detectBlocks(texto);
    const valores = extractValues(pagina.text, pagina.page);
    const layout = guessLayoutForPage(blocos, indice);

    // O primeiro título da página é o título DA PÁGINA. É o que o DTO público lê,
    // e o que o cliente vê na pré-visualização.
    const titulo = blocos.find((bloco) => bloco.type === "titulo")?.text ?? "";

    const elementos = blocos
      .map((bloco, posicao) => elementForBlock(bloco, origin, indice * 100 + posicao))
      .filter((elemento): elemento is StudioElement => elemento !== null);

    importadas.push({
      page: pagina.page,
      values: valores,
      blocks: blocos,
      slide: {
        id: stableId("slide", origin, pagina.page, titulo),
        layout,
        eyebrow: "",
        title: titulo,
        body: "",
        elements: elementos,
        hidden: false,
        notes: `Importado da página ${pagina.page} do PDF.`,
      },
    });
  });

  if (importadas.length === 0) {
    avisos.push("Não foi encontrado texto em nenhuma página. O PDF pode ser um conjunto de imagens digitalizadas.");
  }

  const deck = readStudioDeck(
    toPersistedDeck({
      theme: options.theme ?? "arqvertice-minimal",
      origin: null,
      slides: importadas.map((paginada) => paginada.slide),
    }),
  );

  return {
    deck,
    pages: importadas,
    values: importadas.flatMap((paginada) => paginada.values),
    warnings: avisos,
  };
}

/* -------------------------------------------------------------------------- */
/* MODOS DE IMPORTAÇÃO (item 34)                                                */
/* -------------------------------------------------------------------------- */

/**
 * As cinco operações que o item 34 exige.
 *
 * Todas produzem uma CÓPIA e nenhuma toca no original. A distinção não é
 * cosmética: "transformar em template" tem de mudar o que o próximo cliente vê,
 * e isso é impossível se o original for o mesmo objecto.
 */
export type ImportMode =
  | "COMO_ESTA"
  | "MELHORAR_VISUAL"
  | "REFERENCIA_NOVA"
  | "SOMENTE_CONTEUDO"
  | "TEMPLATE";

export type ImportModeDefinition = {
  mode: ImportMode;
  label: string;
  /** O que faz, numa frase. É o texto que o ADMIN lê para decidir. */
  purpose: string;
  /** O que o modo faz ao conteúdo, em termos de estrutura. */
  keeps: "ESTRUTURA" | "APENAS_TEXTO" | "ESTRUTURA_NOVA";
};

export const IMPORT_MODES: readonly ImportModeDefinition[] = [
  {
    mode: "COMO_ESTA",
    label: "Importar como está",
    purpose: "Mantém a estrutura reconstruída, com títulos, listas e tabelas.",
    keeps: "ESTRUTURA",
  },
  {
    mode: "MELHORAR_VISUAL",
    label: "Preservar conteúdo e melhorar visual",
    purpose: "Mantém o texto e sugere layouts mais adequados ao conteúdo de cada página.",
    keeps: "ESTRUTURA_NOVA",
  },
  {
    mode: "REFERENCIA_NOVA",
    label: "Usar como referência para nova proposta",
    purpose: "Ignora o texto e guarda a sequência de páginas como estrutura de trabalho.",
    keeps: "ESTRUTURA_NOVA",
  },
  {
    mode: "SOMENTE_CONTEUDO",
    label: "Extrair somente conteúdo",
    purpose: "Fica com o texto, sem tabelas nem listas — para redigir do zero.",
    keeps: "APENAS_TEXTO",
  },
  {
    mode: "TEMPLATE",
    label: "Transformar em template",
    purpose: "Guarda a estrutura como template reutilizável, sem o conteúdo desta proposta.",
    keeps: "ESTRUTURA_NOVA",
  },
];

export function getImportMode(mode: ImportMode): ImportModeDefinition {
  const found = IMPORT_MODES.find((entry) => entry.mode === mode);
  // Devolve sempre uma definição: um modo desconhecido não pode deixar a
  // importação sem descrição, e o item 34 pede que as opções sejam oferecidas.
  return found ?? IMPORT_MODES[0];
}

/**
 * Aplica um modo de importação a um resultado.
 *
 * Devolve SEMPRE um resultado novo: `deck` nunca é o mesmo objecto do original.
 * É a garantia do item 34 — "criar cópias/versões sem destruir o arquivo
 * original" — e é verificável num teste com uma única comparação de identidade.
 */
export function applyImportMode(result: ImportResult, mode: ImportMode): ImportResult {
  const definicao = getImportMode(mode);

  if (mode === "SOMENTE_CONTEUDO") {
    // Só texto: as tabelas e listas viram parágrafos, porque uma tabela sem
    // estrutura é pior do que o texto que continha.
    const slides = result.pages.map((pagina) => ({
      ...pagina.slide,
      elements: pagina.slide.elements
        .filter((elemento) => elemento.kind === "text")
        .map((elemento) =>
          elemento.kind === "text" && elemento.role === "kicker"
            ? { ...elemento, role: "body" as const }
            : elemento,
        ),
    }));
    return {
      ...result,
      deck: readStudioDeck(toPersistedDeck({ ...result.deck, slides })),
      pages: result.pages.map((pagina, indice) => ({ ...pagina, slide: slides[indice] })),
    };
  }

  if (mode === "REFERENCIA_NOVA" || mode === "TEMPLATE") {
    /*
     * Referência e template são o MESMO decks sem o conteúdo: o que se guarda é
     * a sequência de layouts, e o texto deste cliente não viaja com ela.
     * Deixar o texto seria o caminho mais curto para o próximo cliente receber a
     * proposta de outro.
     */
    const slides = result.pages.map((pagina) => ({
      ...pagina.slide,
      title: "",
      body: "",
      elements: [],
      notes: "",
    }));
    return {
      ...result,
      deck: readStudioDeck(toPersistedDeck({ ...result.deck, slides })),
      pages: result.pages.map((pagina, indice) => ({ ...pagina, slide: slides[indice] })),
      warnings: [
        ...result.warnings,
        `Modo “${definicao.label}”: o conteúdo do documento não foi copiado, apenas a estrutura.`,
      ],
    };
  }

  if (mode === "MELHORAR_VISUAL") {
    /*
     * Melhora o layout a partir do que a página CONTÉM — que é a informação que a
     * importação tem e que o editor visual também tem. Não inventa conteúdo, e
     * não chama um modelo: é a mesma decisão que `guessLayoutForPage` tomou,
     * refinada agora com o tamanho real do bloco de texto.
     */
    const slides = result.pages.map((pagina, indice) => ({
      ...pagina.slide,
      layout: refineLayout(pagina.slide.layout, pagina.blocks),
    }));
    return {
      ...result,
      deck: readStudioDeck(toPersistedDeck({ ...result.deck, slides })),
      pages: result.pages.map((pagina, indice) => ({ ...pagina, slide: slides[indice] })),
    };
  }

  // COMO_ESTA: devolve o mesmo resultado, mas com um deck NOVO — a cópia é o que
  // garante que a edição posterior não altera a importação já revista.
  return { ...result, deck: readStudioDeck(toPersistedDeck(result.deck)) };
}

/**
 * Refina o layout pela quantidade de texto.
 *
 * Uma página com muito texto num layout de duas colunas fica ilegível, e é esse o
 * erro mais comum de uma importação. A regra é simples e verificável: texto
 * comprido pede uma página de leitura, texto curto pede uma de impacto.
 */
function refineLayout(layout: LayoutKey, blocks: ImportBlock[]): LayoutKey {
  const caracteres = blocks.reduce((soma, bloco) => soma + bloco.text.length, 0);
  if (caracteres > 900) return "title-text";
  if (caracteres < 120 && layout !== "cover") return "image-full";
  return isLayoutKey(layout) ? layout : "title-text";
}

/* -------------------------------------------------------------------------- */
/* PROTEÇÃO (item 35)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * O que a importação pode tocar, e o que nunca toca.
 *
 * O item 35 é uma regra de SEGURANÇA comercial, não uma preferência. Uma proposta
 * de outro escritório não pode alterar o catálogo de preços do sistema: o preço
 * que a ARQVERTICE cobra a um cliente é uma decisão do estúdio, e importada
 * "por-tene" passava a sê-lo por efeito colateral de um ficheiro carregado.
 *
 * Esta constante é executável: `assertImportTouchedNothing` percorre o deck
 * importado e falha se algum elemento ficou LIGADO a uma fonte comercial — que é
 * o mecanismo pelo qual um valor lido de um PDF entraria no cálculo.
 */
export const IMPORT_FORBIDDEN_TARGETS = [
  "ServiceCatalog",
  "PricingLevel",
  "PaymentPlanGlobal",
  "RegraDePrecificacao",
] as const;

/**
 * Recusa um deck importado que tenha valores ligados à proposta.
 *
 * É a verificação de que a importação é só apresentação. Um deck importado com
 * `binding: "INVESTIMENTO"` diria ao servidor "mostra o total desta proposta" —
 * e o total viria da proposta, não do PDF, que é uma confusão silenciosa: o
 * ADMIN veria um número e não saberia de onde saiu.
 */
export function assertImportTouchedNothing(deck: StudioDeck): void {
  for (const slide of deck.slides) {
    for (const elemento of slide.elements) {
      if (!("binding" in elemento)) continue;
      if (elemento.binding !== null) {
        throw new ImportSafetyError(
          `A página “${slide.title || slide.id}” ficou ligada aos dados da proposta. ` +
            "Um documento importado mostra os valores que traz no texto; não volta a calculá-los a partir da proposta.",
        );
      }
    }
  }
}

/**
 * Erro de segurança na importação.
 *
 * Tem nome próprio porque é um erro de POLÍTICA, não de conteúdo: o texto está
 * bem, o que está errado é ter-se ligado a uma fonte que a importação não
 * deve tocar. O editor mostra-o junto ao passo de revisão, e não como falha do
 * sistema.
 */
export class ImportSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportSafetyError";
  }
}

/**
 * Resumo do que foi encontrado, para o painel de revisão (itens 33 e 35).
 *
 * Diz explicitamente que os valores NÃO foram incorporados. Sem esta frase, o
 * ADMIN vê "12 valores encontrados" e concludes que foram aplicados — que é a
 * leitura errada e a mais perigosa.
 */
export function importReviewSummary(result: ImportResult): {
  pagesRead: number;
  blocksFound: number;
  tablesFound: number;
  valuesFound: number;
  note: string;
} {
  return {
    pagesRead: result.pages.length,
    blocksFound: result.pages.reduce((soma, pagina) => soma + pagina.blocks.length, 0),
    tablesFound: result.pages.reduce(
      (soma, pagina) => soma + pagina.blocks.filter((bloco) => bloco.type === "tabela").length,
      0,
    ),
    valuesFound: result.values.length,
    note:
      "Os valores encontrados são DADOS DESTA PROPOSTA. Não foram incorporados ao catálogo, " +
      "ao pricing nem ao plano de pagamento. Só entram se você os criar na proposta, à mão.",
  };
}
/**
 * Escolhe o layout a partir do conteúdo da página.
 *
 * É a mesma família de decisão de `studio-smart-layout`, mas feita na IMPORTAÇÃO
 * e com informação diferente: aqui conhece-se o TEXTO, não a composição. O
 * critério é o que a página parece CONTER.
 */
export function guessLayoutForPage(blocks: ImportBlock[], position: number): LayoutKey {
  if (position === 0) return "cover";
  if (blocks.some((block) => block.type === "tabela")) return "table-highlight";
  if (blocks.some((block) => block.type === "lista")) return "scope";
  if (blocks.length <= 2) return "image-full";
  return "title-text";
}