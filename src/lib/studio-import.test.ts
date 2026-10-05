import { describe, expect, it } from "vitest";
import {
  applyImportMode,
  assertImportTouchedNothing,
  buildImportedDeck,
  detectBlocks,
  extractValues,
  getImportMode,
  guessLayoutForPage,
  IMPORT_MODES,
  ImportSafetyError,
  importReviewSummary,
  parsePortugueseNumber,
  type ImportMode,
} from "./studio-import";

/**
 * FASE 4D — IMPORTAÇÃO DE PDF (itens 33, 34 e 35).
 *
 * Estes testes não carregam um PDF, e essa é a decisão: o que faz o item 33 ser
 * verdade é a RECONSTRUÇÃO, e a reconstrução é uma função pura sobre texto. Testar
 * a parte difícil sem depender de um binário é o que torna esta funcionalidade
 * verificável em vez de demonstrável.
 */

/** Uma página de proposta externa, com valores que NÃO são do sistema. */
const PAGINA = `Condições e Formas de Pagamento

- Entrada: 30%
- Segunda parcela: 35%
- Terceira parcela: 35%

Pagamento: PIX ou Cartão de Crédito.`;

const PAGINA_TABELA = `Opções de Investimento

Pacote          Valor
Completo        R$ 2.240,00
Essencial       R$ 1.960,00`;

describe("números em português", () => {
  it("lê o ponto como separador de milhar", () => {
    // Confundir "." com decimal daria 2.24 em vez de 2240 — o pior defeito
    // possível numa importação comercial.
    expect(parsePortugueseNumber("2.240")).toBe(2_240);
  });

  it("lê a vírgula como decimal", () => {
    expect(parsePortugueseNumber("2240,50")).toBe(2_240.5);
  });

  it("lê os dois juntos", () => {
    expect(parsePortugueseNumber("2.240,00")).toBe(2_240);
  });

  it("devolve null para o que não é número", () => {
    for (const entrada of ["", "   ", "abc", "R$"]) {
      expect(parsePortugueseNumber(entrada), entrada).toBeNull();
    }
  });
});

describe("extracção de valores (item 35)", () => {
  it("encontra dinheiro, percentuais e a linha onde estão", () => {
    // O contexto não é decoração: "R$ 2.240,00" sem a linha onde estava não é
    // auditável por ninguém.
    const dinheiro = extractValues(PAGINA_TABELA, 6).filter((valor) => valor.kind === "MONEY");
    expect(dinheiro.map((valor) => valor.value)).toEqual([2_240, 1_960]);
    expect(dinheiro[0].page).toBe(6);
    expect(dinheiro[0].context).toContain("Completo");
  });

  it("encontra percentuais", () => {
    expect(extractValues(PAGINA, 7).filter((valor) => valor.kind === "PERCENT").map((v) => v.value)).toEqual([
      30, 35, 35,
    ]);
  });

  it("devolve uma lista de observações, nunca um total", () => {
    /*
     * Somar preços encontrados num documento seria inventar aritmética: eles
     * pertencem a linhas diferentes. É por isso que a função não tem forma de
     * devolver uma soma, e o teste fixa essa ausência.
     */
    expect(extractValues(PAGINA_TABELA, 6)).not.toHaveProperty("total");
  });

  it("não encontra nada numa página sem números", () => {
    expect(extractValues("Uma descrição sem valores.", 1)).toHaveLength(0);
  });
});

describe("identificação de blocos (item 33)", () => {
  it("separa título de parágrafo", () => {
    const blocos = detectBlocks(PAGINA);
    expect(blocos[0]).toMatchObject({ type: "titulo", text: "Condições e Formas de Pagamento" });
    expect(blocos.some((bloco) => bloco.type === "paragrafo")).toBe(true);
  });

  it("reconhece uma lista com os seus itens", () => {
    expect(detectBlocks(PAGINA).find((bloco) => bloco.type === "lista")?.items).toEqual([
      "Entrada: 30%",
      "Segunda parcela: 35%",
      "Terceira parcela: 35%",
    ]);
  });

  it("reconhece uma tabela com colunas e linhas", () => {
    const tabela = detectBlocks(PAGINA_TABELA).find((bloco) => bloco.type === "tabela");
    expect(tabela?.table?.columns).toEqual(["Pacote", "Valor"]);
    expect(tabela?.table?.rows[0]).toEqual(["Completo", "R$ 2.240,00"]);
  });

  it("não transforma um parágrafo em tabela", () => {
    /*
     * A heurística de tabela é conservadora de propósito. Uma frase com dois
     * pontos é um parágrafo, e convertê-la em tabela daria ao editor uma grelha a
     * mais — ruído, não estrutura.
     */
    const frase = "Uma frase normal, com vírgulas e mais texto à volta dela.";
    expect(detectBlocks(frase).every((bloco) => bloco.type !== "tabela")).toBe(true);
  });

  it("devolve vazio para página sem texto", () => {
    expect(detectBlocks("   \n  \n")).toEqual([]);
  });
});

describe("escolha de layout pelo conteúdo", () => {
  it("a primeira página é sempre capa", () => {
    // A capa de um PDF importado pode não se parecer com a capa do Studio; a
    // decisão é editorial e não estrutural, e por isso não se negocia.
    expect(guessLayoutForPage(detectBlocks(PAGINA), 0)).toBe("cover");
  });

  it("uma página com tabela pede uma tabela", () => {
    expect(guessLayoutForPage(detectBlocks(PAGINA_TABELA), 1)).toBe("table-highlight");
  });

  it("uma página com lista pede escopo", () => {
    expect(guessLayoutForPage(detectBlocks(PAGINA), 1)).toBe("scope");
  });
});

describe("reconstrução editável (item 33)", () => {
  const PAGINAS = [
    { page: 1, text: "Capa do documento\n\nUma introdução." },
    { page: 6, text: PAGINA_TABELA },
    { page: 7, text: PAGINA },
  ];
  const resultado = buildImportedDeck(PAGINAS);

  it("cria uma página por página do PDF", () => {
    expect(resultado.deck.slides).toHaveLength(3);
  });

  it("preserva o CONTEÚDO, não uma imagem da página", () => {
    /*
     * O critério do item 33. Uma página rasterizada é fiel e inútil: o ADMIN não
     * a pode corrigir. O texto tem de chegar ao deck.
     */
    const texto = JSON.stringify(resultado.deck);
    expect(texto).toContain("Entrada: 30%");
    expect(texto).toContain("Cartão de Crédito");
    expect(texto).toContain("R$ 2.240,00");
  });

  it("o texto é EDITÁVEL: são elementos, não uma imagem", () => {
    expect(resultado.pages[2].slide.elements.some((elemento) => elemento.kind === "cards")).toBe(true);
  });

  it("o título da página é o TÍTULO da página, não um elemento solto", () => {
    // É o que o DTO público e o PDF leem; um título dentro de um elemento de
    // texto não apareceria em nenhum dos dois.
    expect(resultado.deck.slides[2].title).toBe("Condições e Formas de Pagamento");
  });

  it("avisa quando uma página não tem texto, em vez de a perder em silêncio", () => {
    const comVazia = buildImportedDeck([
      { page: 1, text: "Capa" },
      { page: 2, text: "   " },
    ]);
    expect(comVazia.warnings.some((aviso) => aviso.includes("página 2"))).toBe(true);
  });

  it("avisa quando nada é extraível", () => {
    const semNada = buildImportedDeck([{ page: 1, text: "" }]);
    expect(semNada.deck.slides).toHaveLength(0);
    expect(semNada.warnings.length).toBeGreaterThan(0);
  });

  it("é determinística: o mesmo texto dá o mesmo deck", () => {
    expect(JSON.stringify(buildImportedDeck(PAGINAS).deck)).toBe(JSON.stringify(resultado.deck));
  });

  it("guarda a página de origem nas notas", () => {
    // Sem isto o ADMIN não sabe de onde veio um texto que não reconhece.
    expect(resultado.pages[2].slide.notes).toContain("7");
  });
});

describe("protecção contra importação de valores (item 35)", () => {
  const resultado = buildImportedDeck([{ page: 1, text: PAGINA_TABELA }]);

  /** Liga o primeiro elemento do deck a uma fonte comercial. */
  const deckLigado = (binding: "INVESTIMENTO" | "PAGAMENTO") => ({
    ...resultado.deck,
    slides: resultado.deck.slides.map((slide, indice) =>
      indice === 0
        ? { ...slide, elements: [{ kind: "table" as const, id: "t", columns: ["A"], rows: [["B"]], binding }] }
        : slide,
    ),
  });

  it("NENHUM elemento importado fica ligado a uma fonte comercial", () => {
    /*
     * Esta é a garantia central do item 35. Um `binding` faria o servidor mostrar
     * o total DA PROPOSTA num documento que mostra o total DO PDF — uma confusão
     * silenciosa, em que o ADMIN vê um número e não sabe de onde saiu.
     */
    expect(() => assertImportTouchedNothing(resultado.deck)).not.toThrow();
  });

  it("a guarda recusa um deck ligado", () => {
    expect(() => assertImportTouchedNothing(deckLigado("INVESTIMENTO"))).toThrow(ImportSafetyError);
    expect(() => assertImportTouchedNothing(deckLigado("PAGAMENTO"))).toThrow(ImportSafetyError);
  });

  it("o resumo diz explicitamente que nada foi incorporado", () => {
    /*
     * Sem esta frase, o ADMIN lê "12 valores encontrados" e conclui que foram
     * aplicados — que é a leitura errada e a mais perigosa.
     */
    const resumo = importReviewSummary(resultado);
    expect(resumo.note).toContain("Não foram incorporados");
    expect(resumo.note).toContain("catálogo");
  });

  it("o resumo conta o que foi lido, para a revisão ter conteúdo", () => {
    const resumo = importReviewSummary(resultado);
    expect(resumo.pagesRead).toBe(1);
    expect(resumo.tablesFound).toBe(1);
    expect(resumo.valuesFound).toBeGreaterThan(0);
  });
});

describe("modos de importação (item 34)", () => {
  const base = buildImportedDeck([
    { page: 1, text: "Capa\n\nIntrodução." },
    { page: 2, text: PAGINA },
  ]);
  const modo = (m: ImportMode) => applyImportMode(base, m);

  it("oferece as cinco operações que o item 34 pede", () => {
    expect(IMPORT_MODES.map((entrada) => entrada.mode)).toEqual([
      "COMO_ESTA",
      "MELHORAR_VISUAL",
      "REFERENCIA_NOVA",
      "SOMENTE_CONTEUDO",
      "TEMPLATE",
    ]);
  });

  it("cada operação explica o que faz", () => {
    for (const entrada of IMPORT_MODES) expect(entrada.purpose.length).toBeGreaterThan(0);
  });

  it("NENHUM modo altera o deck original", () => {
    /*
     * A exigência do item 34: "criar cópias/versões sem destruir o original".
     * Verificar que o objecto é outro é mais forte do que verificar que o
     * conteúdo é igual — são coisas diferentes.
     */
    const antes = JSON.stringify(base.deck);
    for (const entrada of IMPORT_MODES) applyImportMode(base, entrada.mode);
    expect(JSON.stringify(base.deck)).toBe(antes);
  });

  it("nenhum modo devolve o mesmo objecto de deck", () => {
    for (const entrada of IMPORT_MODES) {
      expect(applyImportMode(base, entrada.mode).deck).not.toBe(base.deck);
    }
  });

  it("«Importar como está» mantém o conteúdo", () => {
    expect(JSON.stringify(modo("COMO_ESTA").deck)).toContain("Entrada: 30%");
  });

  it("«Somente conteúdo» deixa o texto e descarta listas e tabelas", () => {
    const tipos = modo("SOMENTE_CONTEUDO").deck.slides.flatMap((slide) =>
      slide.elements.map((elemento) => elemento.kind),
    );
    expect(tipos).not.toContain("cards");
    expect(tipos).not.toContain("table");
  });

  it("«Referência» e «Template» não levam o texto do cliente", () => {
    /*
     * O risco mais grave da importação: o próximo cliente a usar o template
     * receberia a proposta deste. O teste verifica que não sobra uma palavra.
     */
    for (const entrada of ["REFERENCIA_NOVA", "TEMPLATE"] as ImportMode[]) {
      const deck = modo(entrada).deck;
      expect(JSON.stringify(deck)).not.toContain("Entrada: 30%");
      expect(deck.slides.every((slide) => slide.elements.length === 0)).toBe(true);
      // E avisa que o conteúdo não foi copiado.
      expect(modo(entrada).warnings.some((aviso) => aviso.includes("não foi copiado"))).toBe(true);
    }
  });

  it("«Melhorar visual» mantém o texto", () => {
    expect(JSON.stringify(modo("MELHORAR_VISUAL").deck)).toContain("Entrada: 30%");
  });

  it("desconhece um modo com a primeira definição, em vez de falhar", () => {
    // Um modo de uma versão futura não pode deixar a importação sem descrição.
    expect(getImportMode("MODO_FUTURO" as ImportMode).label.length).toBeGreaterThan(0);
  });
});