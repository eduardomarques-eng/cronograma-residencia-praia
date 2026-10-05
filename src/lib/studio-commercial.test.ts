import { describe, expect, it } from "vitest";
import {
  assertBindingIsHonest,
  boundInvestment,
  boundOptions,
  boundPayment,
  boundSchedule,
  boundScope,
  boundServices,
  COMMERCIAL_BINDINGS,
  CommercialBindingError,
  DEFAULT_SERVICE_DAYS,
  getBinding,
  isCommercialBinding,
  isOptionsBinding,
  isTimelineBinding,
  readCommercialData,
  resolveBinding,
  type CommercialData,
  type CommercialSource,
} from "./studio-commercial";
import { freezePaymentPlan } from "./payment-plan";
import { readStudioDeck, assertNoCommercialInvented, StudioContentError, type StudioDeck, type StudioElement } from "./studio-deck";

/**
 * FASE 4C — LIGAÇÃO À FONTE COMERCIAL (itens 26 a 30).
 *
 * A propriedade que estes testes protegem é uma só, e é a razão de o módulo
 * existir: **o número que a apresentação mostra é o número que a proposta tem**.
 * Tudo o resto — ordem das colunas, rótulos, quebras de linha — é cosmetics ao
 * lado de um teste que prova que um valor comercial não pode ser escrito à mão.
 */

const servicos = [
  { name: "Projeto de arquitectura", quantity: 120, unitPrice: 45, unit: "m²", order: 1, estimatedDays: 30 },
  { name: "Design de interiores", quantity: 1, unitPrice: 8_000, unit: "serviço fixo", order: 2, estimatedDays: 20 },
  { name: "Mobiliário (opcional)", quantity: 1, unitPrice: 5_000, unit: "serviço fixo", order: 3, optional: true, estimatedDays: 10 },
];

const plano = freezePaymentPlan({
  formalText: { formaPagamento: "40% assinatura, 30% anteprojeto, 30% entrega final" },
  total: 9_200,
});

/** Total = 120×45 + 8000 = 5400 + 8000 = 13.400; opcional fica de fora. */
const fonte: CommercialSource = {
  services: servicos,
  subtotal: 13_400,
  adjustment: 0,
  total: 13_400,
  paymentPlan: plano,
};

const dados = (source: Partial<CommercialSource> = {}): CommercialData =>
  readCommercialData({ ...fonte, ...source });

/* -------------------------------------------------------------------------- */

describe("leitura da proposta", () => {
  it("recalcula o subtotal a partir de quantidade e preço", () => {
    // É a protecção que já existia em `proposal-item`: um subtotal gravado à mão
    // pela IA é ignorado e recalculado.
    const data = dados({ services: [{ ...servicos[0], subtotal: 1 }] });
    expect(data.items[0].subtotal).toBe(5_400);
  });

  it("descarta uma linha irrecuperável em vez de falhar a proposta", () => {
    const data = dados({ services: [servicos[0], { name: "", quantity: 0, unitPrice: 0 }] });
    expect(data.items).toHaveLength(1);
  });

  it("aceita uma versão vazia, para uma proposta ainda por preencher", () => {
    const data = dados({ services: [], subtotal: 0, total: 0, paymentPlan: null });
    expect(boundServices(data).empty).toBe(true);
    expect(boundPayment(data).empty).toBe(true);
  });

  it("não inventa um plano de pagamento quando não há nenhum", () => {
    expect(dados({ paymentPlan: null }).plan).toBeNull();
  });
});

describe("tabela de serviços (item 26)", () => {
  it("mostra uma linha por serviço, pela ordem comercial", () => {
    const table = boundServices(dados());
    expect(table.rows.map((row) => row.name)).toEqual([
      "Projeto de arquitectura",
      "Design de interiores",
      "Mobiliário (opcional)",
    ]);
  });

  it("formata o dinheiro com a mesma função do resto da proposta", () => {
    // "R$ 5.400,00" e não "5400": dois formatadores divergiriam no primeiro caso.
    const table = boundServices(dados());
    expect(table.rows[0].subtotal).toBe("R$ 5.400,00");
    expect(table.rows[1].unitPrice).toBe("R$ 8.000,00");
  });

  it("separa o opcional do total contratado", () => {
    const table = boundServices(dados());
    expect(table.totals.find((line) => line.label.startsWith("Subtotal"))?.value).toBe("R$ 13.400,00");
    expect(table.totals.find((line) => line.label.startsWith("Opcionais"))?.value).toBe("R$ 5.000,00");
    expect(table.totals.at(-1)?.value).toBe("R$ 13.400,00");
  });

  it("marca as colunas de dinheiro como numéricas", () => {
    // É o que permite alinhá-las à direita e não as oferecer como campos.
    const money = boundServices(dados()).columns.filter((column) => column.numeric).map((column) => column.title);
    expect(money).toEqual(["Quantidade", "Preço unitário", "Subtotal"]);
  });
});

describe("tabela de investimento (item 29)", () => {
  it("NÃO inclui os opcionais nas linhas de dados", () => {
    // O erro do item 71: somar opcionais não contratados no valor mostrado.
    const table = boundInvestment(dados());
    expect(table.rows.map((row) => row.name)).toEqual(["Projeto de arquitectura", "Design de interiores"]);
  });

  it("mostra o desconto com o sinal que o ADMIN escolheu", () => {
    const desconto = boundInvestment(dados({ adjustment: -1_400, total: 12_000 }));
    expect(desconto.totals.find((line) => line.label === "Desconto")?.value).toBe("R$ -1.400,00");
    expect(desconto.totals.at(-1)?.value).toBe("R$ 12.000,00");
  });

  it("nomeia o acréscimo quando o ajuste é positivo", () => {
    // Um acréscimo chamado "Desconto" mentiria ao cliente.
    const acrescimo = boundInvestment(dados({ adjustment: 500, total: 13_900 }));
    expect(acrescimo.totals.find((line) => line.label === "Acréscimo")?.value).toBe("R$ 500,00");
  });

  it("omite a linha de ajuste quando não há ajuste", () => {
    expect(boundInvestment(dados()).totals.map((line) => line.label)).not.toContain("Desconto");
  });

  it("usa o total PERSISTIDO, não o recalculado", () => {
    // A versão é a fonte que o cliente aprova. Se divergirem, é sinal de que
    // algo foi alterado por fora do mecanismo comercial — e o número que o
    // cliente assinou é o que tem de aparecer.
    const data = dados({ total: 99_999 });
    expect(boundInvestment(data).totals.at(-1)?.value).toBe("R$ 99.999,00");
  });
});

describe("tabela de escopo (item 26)", () => {
  const comEscopo = dados({
    services: [{ ...servicos[0], scope: "Planta eake-up", exclusions: "Mobiliário" }, servicos[1]],
  });

  it("mostra o que entra e o que não entra", () => {
    const table = boundScope(comEscopo);
    expect(table.rows[0].scope).toBe("Planta eake-up");
    expect(table.rows[0].exclusions).toBe("Mobiliário");
  });

  it("omite a linha sem escopo, em vez de a mostrar vazia", () => {
    // Uma linha vazia ocupa espaço na proposta e não informa o cliente de nada.
    expect(boundScope(comEscopo).rows).toHaveLength(1);
  });

  it("não tem totais: escopo não é dinheiro", () => {
    expect(boundScope(comEscopo).totals).toEqual([]);
  });
});

describe("tabela de pagamento (item 30)", () => {
  const table = (source: Partial<CommercialSource> = {}) => boundPayment(dados(source));

  it("mostra as parcelas do plano congelado, pela ordem de cobrança", () => {
    expect(table().rows.map((row) => row.label)).toEqual(["assinatura", "anteprojeto", "entrega final"]);
    expect(table().rows.map((row) => row.order)).toEqual(["1", "2", "3"]);
  });

  it("mostra percentual e valor de cada parcela", () => {
    expect(table({ total: 9_200 }).rows[0].percent).toBe("40%");
    expect(table({ total: 9_200 }).rows[0].amount).toBe("R$ 3.680,00");
  });

  it("as parcelas somam EXACTAMENTE o total, sem divergência de centavos", () => {
    // É o requisito explícito do item 30. O plano é CONGELADO com um total, e
    // mudar o total da proposta não o recalcula — por isso o teste constrói o
    // plano para o total que vai usar. É essa imutabilidade que garante que a
    // proposta já enviada não muda sozinha.
    const total = 13_400;
    const data = dados({
      total,
      paymentPlan: freezePaymentPlan({
        formalText: { formaPagamento: "40% assinatura, 30% anteprojeto, 30% entrega final" },
        total,
      }),
    });
    const parcelas = boundPayment(data).rows.map((row) => Number(row.amount.replace(/[^\d]/g, "")));
    // R$ 13.400,00 = 1.340.000 cêntimos: nem um cêntimo criado nem perdido.
    expect(parcelas.reduce((soma, valor) => soma + valor, 0)).toBe(1_340_000);
    // E o total mostrado ao lado é o mesmo da proposta.
    expect(boundPayment(data).totals.at(-1)?.value).toBe("R$ 13.400,00");
  });

  it("mostra o total ao lado das parcelas", () => {
    expect(table({ total: 13_400 }).totals.at(-1)).toEqual({
      label: "Total",
      value: "R$ 13.400,00",
      emphasis: true,
    });
  });

  it("não inventa parcelas quando o plano é inválido", () => {
    // Uma proposta sem plano mostra "sem parcelas", não um plano inventado.
    expect(table({ paymentPlan: { format: 9 } }).empty).toBe(true);
  });
});

describe("cronograma (item 28)", () => {
  const etapas = boundSchedule(dados());

  it("acumula a duração: cada etapa começa quando a anterior acaba", () => {
    expect(etapas.map((step) => step.days)).toEqual([30, 20, 10]);
    expect(etapas.map((step) => step.note)).toEqual([
      "Início (dia 1) · 30 dias",
      "Dia 31 · 20 dias",
      "Dia 51 · 10 dias",
    ]);
  });

  it("numera as etapas pela ordem comercial", () => {
    expect(etapas.map((step) => step.sequence)).toEqual([1, 2, 3]);
    expect(etapas.map((step) => step.label)).toEqual(["01", "02", "03"]);
  });

  it("usa o prazo do serviço, e assume um quando não existe", () => {
    // Sem prazo, a sequência partia e o cliente ficava sem prever o fim da obra.
    const semPrazo = boundSchedule(
      dados({ services: [{ name: "Serviço", quantity: 1, unitPrice: 100, order: 1 }] }),
    );
    expect(semPrazo[0].days).toBe(DEFAULT_SERVICE_DAYS);
  });

  it("actualiza quando o cronograma comercial muda", () => {
    // O ponto do item 28: nada foi escrito à mão, logo mudar o prazo muda a
    // apresentação. Se isto passasse com um prazo fixo, a ligação era falsa.
    const antes = boundSchedule(dados());
    const depois = boundSchedule(
      dados({ services: [{ ...servicos[0], estimatedDays: 60 }, servicos[1], servicos[2]] }),
    );
    expect(depois[1].note).not.toBe(antes[1].note);
    expect(depois[1].note).toBe("Dia 61 · 20 dias");
  });

  it("devolve vazio quando a proposta não tem serviços", () => {
    expect(boundSchedule(dados({ services: [] }))).toEqual([]);
  });
});

describe("comparativo de opções (item 27)", () => {
  it("separa o essencial do alargado, pelos valores da proposta", () => {
    const sides = boundOptions(dados());
    expect(sides.map((side) => side.title)).toEqual(["OPÇÃO 01", "OPÇÃO 02"]);
    expect(sides[0].value).toBe("R$ 13.400,00");
    expect(sides[1].value).toBe("R$ 18.400,00");
  });

  it("nomeia os serviços de cada opção a partir das linhas", () => {
    expect(boundOptions(dados())[0].services).toEqual([
      "Projeto de arquitectura",
      "Design de interiores",
    ]);
  });

  it("recomenda só uma opção, e é texto do autor", () => {
    const sides = boundOptions(dados());
    expect(sides.filter((side) => side.highlight)).toHaveLength(1);
    expect(sides[0].recommendation).toContain("Recomendada");
  });

  it("não inventa uma segunda opção quando não há opcionais", () => {
    // Uma opção vazia mostraria um cartão sem serviços, que compara o quê?
    const sides = boundOptions(dados({ services: servicos.filter((item) => !item.optional) }));
    expect(sides).toHaveLength(1);
  });
});

describe("resolvedor único", () => {
  it("devolve a mesma tabela que a função específica da fonte", () => {
    // Se `resolveBinding` e a função directa divergissem, a mesma informação
    // apareceria de duas maneiras em ecrãs diferentes.
    const data = dados();
    expect(resolveBinding("INVESTIMENTO", data)).toEqual(boundInvestment(data));
    expect(resolveBinding("PAGAMENTO", data)).toEqual(boundPayment(data));
    expect(resolveBinding("ESCOPO", data)).toEqual(boundScope(data));
    expect(resolveBinding("SERVICOS", data)).toEqual(boundServices(data));
  });

  it("nunca lança para uma fonte desconhecida", () => {
    // Uma proposta já enviada não pode dar 500 por um `binding` gravado por uma
    // versão futura do editor.
    const alien = "FONTE_FUTURA" as Parameters<typeof resolveBinding>[0];
    expect(() => resolveBinding(alien, dados())).not.toThrow();
  });
});

describe("guarda de honestidade", () => {
  it("recusa um elemento ligado que também tem linhas escritas à mão", () => {
    expect(() =>
      assertBindingIsHonest({ binding: "INVESTIMENTO", columns: ["Serviço"], rows: [["Projecto", "25.000"]] }),
    ).toThrow(CommercialBindingError);
  });

  it("aceita um elemento ligado cujas linhas vêm do servidor", () => {
    expect(() => assertBindingIsHonest({ binding: "INVESTIMENTO", columns: [], rows: [] })).not.toThrow();
  });

  it("aceita conteúdo do autor que não é comercial", () => {
    // Um ESCOPO ligado pode trazer uma legenda do autor sem inventar dinheiro.
    expect(() => assertBindingIsHonest({ binding: "ESCOPO", columns: ["Serviço"], rows: [["Cozinha"]] })).not.toThrow();
  });

  it("aceita uma tabela do autor, que é o caso comum", () => {
    expect(() => assertBindingIsHonest({ binding: null, columns: ["A"], rows: [["1"]] })).not.toThrow();
  });

  it("a mensagem diz o que está errado e o que fazer", () => {
    // Uma mensagem que não diz o que fazer obriga o ADMIN a procurar no código.
    try {
      assertBindingIsHonest({ binding: "PAGAMENTO", columns: ["a"], rows: [["b"]] });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("Condições de pagamento");
      expect((error as Error).message).toContain("ProposalVersion");
    }
  });
});

describe("a ligação sobrevive ao ciclo de gravação", () => {
  // Tipada como `StudioDeck` e não inferida: sem a anotação, o objecto
  // literal alargaria `layout` a `string` e o teste não compilava — o que
  // significaria um teste que não roda.
  const slide = (elements: StudioElement[]): StudioDeck => ({
    theme: "arqvertice-minimal",
    origin: null,
    slides: [
      {
        id: "s1",
        layout: "investment",
        eyebrow: "",
        title: "Investimento",
        body: "",
        hidden: false,
        notes: "",
        elements,
      },
    ],
  });

  it("lê uma tabela ligada e descarta as linhas escritas à mão que vinham gravadas", () => {
    const deck = readStudioDeck({
      slides: [
        {
          title: "Investimento",
          elements: [
            { kind: "table", binding: "INVESTIMENTO", columns: ["Serviço"], rows: [["Projecto", "R$ 25.000,00"]] },
          ],
        },
      ],
    });
    const element = deck.slides[0].elements[0];
    expect(element.kind).toBe("table");
    if (element.kind === "table") {
      expect(element.binding).toBe("INVESTIMENTO");
      expect(element.rows).toEqual([]);
    }
  });

  it("mantém uma tabela do autor intacta", () => {
    const deck = readStudioDeck({
      slides: [{ title: "Materiais", elements: [{ kind: "table", columns: ["Material"], rows: [["Madeira"]] }] }],
    });
    const element = deck.slides[0].elements[0];
    if (element.kind === "table") {
      expect(element.binding).toBeNull();
      expect(element.rows).toEqual([["Madeira"]]);
    }
  });

  it("recusa um deck que introduza dinheiro à mão num elemento ligado", () => {
    // A guarda corre sobre o DECK INTEIRO, e não só sobre o painel: um comando de
    // IA não pode construir o elemento já com linhas e contornar a interface.
    const deck = slide([
      { kind: "table", id: "t1", binding: "INVESTIMENTO", columns: ["Serviço"], rows: [["Projecto", "R$ 90.000,00"]] },
    ]);
    expect(() => assertNoCommercialInvented(deck)).toThrow(StudioContentError);
  });

  it("deixa passar um deck ligado e limpo", () => {
    const deck = slide([
      { kind: "table", id: "t1", binding: "INVESTIMENTO", columns: [], rows: [] },
    ]);
    expect(() => assertNoCommercialInvented(deck)).not.toThrow();
  });
});