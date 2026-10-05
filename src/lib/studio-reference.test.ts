import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildReferenceDeck,
  fixtureValuesAreNotSystemRules,
  REFERENCE_META,
  REFERENCE_VALUES,
  referenceDeck,
} from "./studio-reference";
import { assertNoCommercialInvented, type StudioDeck, type StudioElement } from "./studio-deck";
import { isCommercialBinding } from "./studio-commercial";

/**
 * FASE 4D — PROPOSTA DE REFERÊNCIA (item 31).
 *
 * O item 31 traz uma proposta concreta e diz, na mesma frase, que ela é
 * EXEMPLO. Este ficheiro fixa as duas metades:
 *
 *  1. o fixture é uma apresentação VÁLIDA — nove páginas, cada uma com conteúdo;
 *  2. os valores NÃO são regras do sistema — nenhum módulo de produção importa
 *     este ficheiro.
 *
 * A segunda metade é a importante. Um teste que verificasse apenas a forma não
 * impediria que `R$ 40/m²` acabasse no motor de preços; a verificação de imports
 * é que fecha essa porta.
 */

const deck = referenceDeck();

// Falha cedo e com diagnóstico: sem isto, um deck vazio por causa de um elemento
// descartado apareceria como seis testes vermelhos sem explicação.
if (deck.slides.length !== 9) {
  throw new Error(
    `A referência devolveu ${deck.slides.length} páginas em vez de 9: ` +
      deck.slides.map((slide, index) => `${index + 1}=${slide.title || "(sem título)"}`).join(" | "),
  );
}

/** Texto visível de um elemento, para quando o teste precisar de o procurar. */
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
 * Todo o texto de uma PÁGINA, concatenado.
 *
 * Aceita uma página e não um deck porque é o que os testes precisam: cada
 * afirmação do item 31 verifica o conteúdo de uma página concreta, e passar o
 * deck inteiro tornaria o teste mais fraco — passaria mesmo que o texto
 * estivesse na página errada.
 */
function slideText(slide: StudioDeck["slides"][number]): string {
  return `${slide.title} ${slide.body} ${slide.elements.map(elementText).join(" ")}`;
}

/** Mesmo texto, para o deck inteiro. */
function deckText(source: StudioDeck): string {
  return source.slides.map(slideText).join(" ");
}

/* -------------------------------------------------------------------------- */

describe("a referência é uma proposta completa", () => {
  it("tem as nove páginas do item 31", () => {
    expect(deck.slides.length, `obtidas: ${deck.slides.map((s) => s.title || "(sem título)").join(" | ")}`).toBe(9);
  });

  it("as páginas são as esperadas, pela ordem", () => {
    expect(deck.slides.map((slide) => slide.title)).toEqual([
      "Transformação & Design de Interiores",
      "Diagnóstico e Validação Estrutural",
      "Escopo Completo dos Projetos & Entregáveis",
      "Cronograma e Etapas do Trabalho",
      "Marcenaria Sob Medida & Pranchas Executivas",
      "Tabela Comparativa das Opções de Investimento",
      "Condições e Formas de Pagamento",
      "Amostra Visual, Moodboard & Paisagismo",
      "Próximos Passos & Início do Projeto",
    ]);
  });

  it("cada página tem conteúdo: nenhuma fica vazia", () => {
    // Um fixture com uma página vazia passaria num teste que só conta páginas, e
    // a validação do Studio deixaria de cobrir esse caso.
    for (const slide of deck.slides) {
      expect(slide.elements.length, `página "${slide.title}"`).toBeGreaterThan(0);
    }
  });

  it("a capa tem o cliente e o responsável técnico", () => {
    const texto = slideText(deck.slides[0]);
    expect(texto).toContain(REFERENCE_META.clientName);
    expect(texto).toContain(REFERENCE_META.technicalLead);
  });

  it("o cronograma traz as três etapas e o prazo total", () => {
    const texto = slideText(deck.slides[3]);
    expect(texto).toContain("Etapa 01");
    expect(texto).toContain("Etapa 03");
    expect(texto).toContain(`${REFERENCE_VALUES.prazoMinDias} a ${REFERENCE_VALUES.prazoMaxDias} dias úteis`);
  });

  it("as condições de pagamento trazem os três percentuais", () => {
    const texto = slideText(deck.slides[6]);
    expect(texto).toContain(`${REFERENCE_VALUES.entradaPercent}%`);
    expect(texto).toContain(`${REFERENCE_VALUES.segundaParcelaPercent}%`);
    expect(texto).toContain(`${REFERENCE_VALUES.terceiraParcelaPercent}%`);
  });
describe("o fixture é reprodutível", () => {
  it("duas construções dão o mesmo deck", () => {
    expect(JSON.stringify(buildReferenceDeck())).toBe(JSON.stringify(buildReferenceDeck()));
  });

  it("devolve objectos distintos, para um não contaminar o outro", () => {
    const a = buildReferenceDeck();
    const b = buildReferenceDeck();
    expect(a).not.toBe(b);
    expect(a.slides).not.toBe(b.slides);
  });

  it("aceita cliente e projeto diferentes, mantendo o esqueleto", () => {
    // É o que torna o esqueleto reutilizável como template (item 37).
    const outro = buildReferenceDeck({ clientName: "Cliente Novo", projectName: "Loja Comercial" });
    expect(outro.slides).toHaveLength(9);
    expect(slideText(outro.slides[0])).toContain("Cliente Novo");
  });

  it("passa a guarda anti-invenção, porque nada é ligado a uma fonte comercial", () => {
    // O fixture escreve valores como TEXTO — e é legítimo, porque não há proposta
    // real por trás dele. Mas isso só é verdade enquanto NENHUM elemento estiver
    // ligado: um `binding` aqui faria o servidor tentar resolver linhas que a
    // proposta de validação não tem.
    expect(() => assertNoCommercialInvented(deck)).not.toThrow();
    for (const slide of deck.slides) {
      for (const element of slide.elements) {
        if ("binding" in element) expect(isCommercialBinding(element.binding)).toBe(false);
      }
    }
  });
});

describe("os valores são DADOS, nunca regras do sistema", () => {
  it("expõe os valores para o teste os poder citar", () => {
    expect(fixtureValuesAreNotSystemRules()).toHaveLength(Object.keys(REFERENCE_VALUES).length);
  });

  it("NENHUM módulo de produção importa o fixture", () => {
    /*
     * Esta é a prova de que `R$ 40/m²` não é uma regra.
     *
     * Percorre `src` e falha se qualquer ficheiro — fora do próprio fixture e dos
     * testes — importar `studio-reference`. Um módulo de produção que precisasse
     * destes números estaria a tratar uma proposta como um catálogo, e este teste
     * é o que o impede.
     */
    const raiz = join(process.cwd(), "src");
    const ficheiros = listFiles(raiz).filter(
      (path) => !path.endsWith("studio-reference.ts") && !path.endsWith(".test.ts"),
    );

    const infressores = ficheiros.filter((path) =>
      /from\s+["'][^"']*studio-reference["']/.test(readFileSync(path, "utf8")),
    );

    expect(infressores.map((path) => path.slice(raiz.length))).toEqual([]);
  });

  it("o motor de preços e o de parcelas não derivam nada destes números", () => {
    /*
     * Segunda verificação, mais directa que a dos imports: nenhum código
     * EXECUTÁVEL do motor pode usar um valor do exemplo como total ou
     * percentual.
     *
     * Os comentários são removidos antes da busca, e isso não é um detalhe
     * cosmético — `payment-plan.ts` menciona "Tópico 30" numa nota, e sem o
     * filtro um teste que pretende provar uma coisa provaria outra. Um teste
     * demasiado largo é pior do que nenhum: passa pela razão errada.
     */
    const motores = ["src/lib/pricing.ts", "src/lib/payment-plan.ts"].map((rel) => join(process.cwd(), rel));
    for (const ficheiro of motores) {
      const codigo = readFileSync(ficheiro, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");

      for (const valor of Object.values(REFERENCE_VALUES).map(String)) {
        // Um total ou percentual derivado do exemplo apareceria como uma
        // ATRIBUIÇÃO ou uma constante com esse número — não como `Math.round`.
        expect(codigo, `${ficheiro} atribui ${valor} a um total/percentual`).not.toMatch(
          new RegExp(`(total|subtotal|percent\\w*)\\s*[:=]\\s*[^\\n;]*\\b${valor}\\b`, "i"),
        );
      }
    }
  });

  it("nenhum valor do exemplo é um default do sistema", () => {
    /*
     * A forma mais perigosa de um número de exemplo entrar no sistema é ser um
     * VALOR POR OMISSÃO: o motor passa a usá-lo quando falta um dado, sem que
     * ninguém o tenha escolhido. `DEFAULT_SERVICE_DAYS` é exactamente esse
     * caso, e por isso o teste olha para os nomes das constantes por omissão.
     */
    const comDefaults = readdirSync(join(process.cwd(), "src/lib"))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => readFileSync(join(process.cwd(), "src/lib", name), "utf8"))
      .join("\n");

    const defaults = [...comDefaults.matchAll(/(?:DEFAULT|DEFAULT_)\w*\s*[:=]\s*([0-9][0-9.,]*)/g)].map(
      (match) => match[1],
    );
    const valoresDoExemplo = Object.values(REFERENCE_VALUES).map(String);
    for (const valor of defaults) {
      expect(valoresDoExemplo, `${valor} é um default do sistema`).not.toContain(valor);
    }
  });
});

/** Lista todos os ficheiros de `src`, recursivamente. */
function listFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

  it("a nota que declara os valores como exemplo está na página de opções", () => {
    // A própria proposta avisa. É a forma mais barata de impedir que alguém leia
    // estes números como um catálogo.
    expect(slideText(deck.slides[5])).toContain("não regras do sistema");
  });
});
