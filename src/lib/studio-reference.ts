import {
  readStudioDeck,
  stableId,
  toPersistedDeck,
  type StudioDeck,
  type StudioElement,
  type StudioSlide,
  type TextRole,
} from "./studio-deck";

/**
 * FASE 4D — PROPOSTA DE REFERÊNCIA (item 31).
 *
 * Este ficheiro é um FIXTURE, não uma fonte de verdade. Existe para que o Studio
 * possa ser validado contra uma proposta real — com capa, diagnóstico, escopo,
 * cronograma, opções, pagamento e próximos passos — sem depender de uma base de
 * dados povoada.
 *
 * A DISTINÇÃO que o próprio item 31 exige é a razão de este módulo existir
 * isolado:
 *
 *   **Estes valores são DADOS DE EXEMPLO, nunca regras do sistema.**
 *
 * `R$ 40/m²`, `R$ 35/m²`, `R$ 2.240,00`, `R$ 1.960,00`, `56 m²`, `30% / 35% / 35%`
 * e `20–25 dias` descrevem UMA proposta. Nenhum deles pode entrar no motor de
 * preços, no catálogo, num plano de pagamento ou num limite de validação.
 *
 * O ficheiro não é importado por nenhum módulo de produção — é verificado por
 * `studio-reference.test.ts`, que percorre `src` e falha se isso acontecer. É a
 * forma de a promessa ser verificável em vez de apenas estar escrita.
 *
 * É por isso que os valores vivem em `REFERENCE_VALUES` — um objecto nomeado,
 * isolado e legível — e não espalhados pelo meio do texto. Se alguém precisar
 * deles num teste, lê o nome; se alguém os usar no motor, o teste falha.
 */
import { formatCurrencyBRL } from "./contract-template";

/**
 * FASE 4D — PROPOSTA DE REFERÊNCIA (item 31).
 *
 * Este ficheiro é um FIXTURE, não uma fonte de verdade. Existe para que o Studio
 * possa ser validado contra uma proposta real — com capa, diagnóstico, escopo,
 * cronograma, opções, pagamento e próximos passos — sem depender de uma base de
 * dados povoada.
 *
 * A DISTINÇÃO que o próprio item 31 exige é a razão de este módulo existir
 * isolado:
 *
 *   **Estes valores são DADOS DE EXEMPLO, nunca regras do sistema.**
 *
 * `R$ 40/m²`, `R$ 35/m²`, `R$ 2.240,00`, `R$ 1.960,00`, `56 m²`, `30% / 35% / 35%`
 * e `20–25 dias` descrevem UMA proposta. Nenhum deles pode entrar no motor de
 * preços, no catálogo, num plano de pagamento ou num limite de validação. A
 * protecção não é por convenção: `fixtureValuesAreNotSystemRules` documenta a
 * lista, e `studio-reference.fixture.test.ts` falha se algum módulo do sistema
 * importar este ficheiro.
 *
 * É por isso que os valores vivem em `REFERENCE_VALUES` — um objecto nomeado,
 * isolado e legível — e não espalhados pelo meio do texto. Se alguém precisar
 * deles num teste, lê o nome; se alguém os usar no motor, o teste falha.
 */

/**
 * Valores do exemplo.
 *
 * Nomes explícitos e `as const`: o objecto é uma FONTE DADA, e o compilador
 * impõe que ninguém os fiddle como regra. O comentário de cada grupo diz o que
 * significam NESTA proposta — e é isso que impede a leitura errada.
 */
export const REFERENCE_VALUES = {
  /** Área do imóvel, em m². Medida do Apartamento Ravena. */
  areaM2: 56,
  /** Opção 01 — Pacote Completo, em reais por m². */
  opcao1PorM2: 40,
  /** Opção 01 — total da opção. */
  opcao1Total: 2_240,
  /** Opção 02 — Pacote Essencial, em reais por m². */
  opcao2PorM2: 35,
  /** Opção 02 — total da opção. */
  opcao2Total: 1_960,
  /** Condição de pagamento desta proposta: 30% + 35% + 35%. */
  entradaPercent: 30,
  segundaParcelaPercent: 35,
  terceiraParcelaPercent: 35,
  /** Prazo total, em dias úteis. */
  prazoMinDias: 20,
  prazoMaxDias: 25,
  /** Duração de cada etapa, em dias úteis. */
  etapa1Dias: 5,
  etapa2Dias: 8,
  etapa3MinDias: 7,
  etapa3MaxDias: 10,
} as const;

/** Metadados da proposta de exemplo. */
export type ReferenceMeta = {
  clientName: string;
  projectName: string;
  title: string;
  subtitle: string;
  technicalLead: string;
  studio: string;
};

/**
 * Quem é o cliente e o project's desta proposta de exemplo.
 *
 * Nomes fictícios de propósito: uma proposta real não pode ser confundida com a
 * de validação, e o Studio não deve habituar-se a mostrar dados inventados como
 * se fossem o cliente.
 */
export const REFERENCE_META: ReferenceMeta = {
  clientName: "Ravena",
  projectName: "Apartamento 56m² — Reestruturação",
  title: "Transformação & Design de Interiores",
  subtitle: "Projeto Executivo & Reestruturação — Apartamento 56m²",
  technicalLead: "Eduardo Marques",
  studio: "ArqVértice Studio",
};

/** Bloco de texto simples dentro de uma página de referência. */
const text = (id: string, role: TextRole, body: string): StudioElement => ({
  kind: "text",
  id,
  role,
  text: body,
});

/** Lista com marcadores, para escopos e acabamentos. */
const bullets = (id: string, items: string[]): StudioElement => ({
  kind: "cards",
  id,
  items: items.map((item) => ({ title: "", body: item, image: null })),
  variant: "stacked",
});

/**
 * Formata um valor na moeda da proposta para MOSTRAR no fixture.
 *
 * Reutiliza `formatCurrencyBRL` de propósito: um segundo formatador no Studio
 * divergiria do resto da proposta no primeiro valor com separador de milhares, e
 * o fixture deixaria de servir para validar a formatação real.
 */
const formatBRL = (value: number): string => formatCurrencyBRL(value);

/** Etapa de cronograma da referência. */
type ReferenceStep = { label: string; title: string; body: string; days: string };

/**
 * As ETAPAS do exemplo.
 *
 * A duração é TEXTO ("5 dias úteis"), e não um número: o exemplo tem uma etapa
 * com intervalo ("7–10 dias úteis"), e forçar um inteiro aqui seria inventar
 * precisão que o exemplo não tem. O cronograma ligado à proposta é que trabalha
 * com `estimatedDays` numérico — ver `studio-commercial`.
 */
const STEPS: readonly ReferenceStep[] = [
  {
    label: "Etapa 01",
    title: "Levantamento, briefing e conceito",
    body: "Levantamento presencial, Briefing, Layout 2D e Moodboard.",
    days: `${REFERENCE_VALUES.etapa1Dias} dias úteis`,
  },
  {
    label: "Etapa 02",
    title: "Modelação e visualização",
    body: "Modelagem 3D e Renders Fotorrealistas.",
    days: `${REFERENCE_VALUES.etapa2Dias} dias úteis`,
  },
  {
    label: "Etapa 03",
    title: "Caderno executivo e marcenaria",
    body: "Caderno Executivo de Infraestrutura e Detalhamento de Marcenaria.",
    days: `${REFERENCE_VALUES.etapa3MinDias}–${REFERENCE_VALUES.etapa3MaxDias} dias úteis`,
  },
];

/** Uma opção de investimento do exemplo. */
type ReferenceOption = { label: string; name: string; perM2: number; total: number; features: string[] };

/**
 * As DUAS opções do exemplo.
 *
 * Nenhuma delas é marcada como "recomendada" aqui: a recomendação é do ADMIN e
 * muda de proposta para proposta. Um template que trouxesse uma preferência
 * embutida faria o Studio escolher pelo cliente.
 */
const OPTIONS: readonly ReferenceOption[] = [
  {
    label: "OPÇÃO 01",
    name: "Pacote Completo",
    perM2: REFERENCE_VALUES.opcao1PorM2,
    total: REFERENCE_VALUES.opcao1Total,
    features: [
      "Projeto executivo completo",
      "Infraestrutura técnica integral",
      "Marcenaria sob medida",
      "Design e decoração",
    ],
  },
  {
    label: "OPÇÃO 02",
    name: "Pacote Essencial",
    perM2: REFERENCE_VALUES.opcao2PorM2,
    total: REFERENCE_VALUES.opcao2Total,
    features: ["Projeto executivo", "Infraestrutura técnica", "Design de interiores"],
  },
];

/** Condição de pagamento do exemplo: entrada e duas parcelas. */
const PAYMENT_LABELS = ["Entrada", "Segunda parcela", "Terceira parcela"] as const;
const PAYMENT_PERCENTS = [
  REFERENCE_VALUES.entradaPercent,
  REFERENCE_VALUES.segundaParcelaPercent,
  REFERENCE_VALUES.terceiraParcelaPercent,
] as const;
/* -------------------------------------------------------------------------- */
/* AS 9 PÁGINAS DA REFERÊNCIA                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Constrói a apresentação de referência.
 *
 * Devolve um `StudioDeck` novo a cada chamada — nunca um objecto partilhado. Um
 * template vivo que o editor possa mutar seria a origem de um bug que só aparece
 * na terceira edição: o conteúdo do exemplo a mudar-se a si próprio.
 *
 * Os identificadores derivam do CONTEÚDO (`stableId`), e não de um contador, para
 * que duas importações da referência produzam exactamente o mesmo deck — que é o
 * que permite comparar duas execuções num teste.
 *
 * `clientName` e `projectName` são parâmetros porque o esqueleto é reutilizável
 * (item 37): a referência descreve uma proposta concreta, mas a sequência de
 * páginas e os TÍTULOS servem qualquer projeto do mesmo tipo.
 */
export function buildReferenceDeck(
  options: { clientName?: string; projectName?: string; origin?: string } = {},
): StudioDeck {
  const origin = options.origin ?? "referencia";
  const client = (options.clientName ?? REFERENCE_META.clientName).trim() || REFERENCE_META.clientName;
  const project = (options.projectName ?? REFERENCE_META.projectName).trim() || REFERENCE_META.projectName;

  /** Cria uma página com id derivado do título. */
  const page = (
    layout: StudioSlide["layout"],
    title: string,
    elements: StudioElement[],
    extra: Partial<StudioSlide> = {},
  ): StudioSlide => ({
    id: stableId("slide", origin, layout, title),
    layout,
    eyebrow: "",
    title,
    body: "",
    elements,
    hidden: false,
    notes: "",
    ...extra,
  });

  const slides: StudioSlide[] = [
    /* 1 — Capa. `cover` não aceita tabela nem timeline: a capa é capa. */
    page("cover", REFERENCE_META.title, [
      text("ref-capa-subtitulo", "lead", REFERENCE_META.subtitle),
      text("ref-capa-cliente", "caption", `Cliente: ${client}`),
      text(
        "ref-capa-responsavel",
        "caption",
        `Responsável técnico: ${REFERENCE_META.studio} | ${REFERENCE_META.technicalLead}`,
      ),
    ]),

    /* 2 — Diagnóstico. As fotos reais são o que prova o imóvel; sem elas a
       página descreve e não mostra. */
    page("text-image", "Diagnóstico e Validação Estrutural", [
      text("ref-diag-fotos", "kicker", "Análise das fotos do imóvel"),
      text("ref-diag-espacial", "body", "Integração espacial entre Sala de Estar e Cozinha."),
      text("ref-diag-engenharia", "kicker", "Engenharia e segurança"),
      text(
        "ref-diag-engenho-corpo",
        "body",
        "Remoção e abertura de parede divisória de alvenaria com acompanhamento e laudo técnico de Engenharia Estrutural para total segurança da obra.",
      ),
      text("ref-diag-foco", "kicker", "Foco do projeto"),
      text(
        "ref-diag-foco-corpo",
        "body",
        "Ganho de iluminação natural, sensação de amplitude e fluidez de circulação.",
      ),
    ]),

    /* 3 — Escopo. `cards` empilhadas leem-se como lista com marcadores, que é
       como um escopo se lê. */
    page("scope", "Escopo Completo dos Projetos & Entregáveis", [
      bullets("ref-escopo-infra", [
        "Plantas de Demolição/Construção",
        "Elétrica",
        "Iluminação/Gesso",
        "Pontos Hidráulicos",
        "Paginação de Piso",
      ]),
      bullets("ref-escopo-design", [
        "Moodboard de materiais",
        "Mobiliário solto",
        "Curadoria de objetos",
        "Paisagismo interno",
      ]),
      text("ref-escopo-marcenaria", "kicker", "Marcenaria sob medida"),
      text("ref-escopo-marcenaria-corpo", "body", "Projeto técnico e detalhamento executivo."),
    ]),

    /* 4 — Cronograma. As etapas vão como TEXTO porque o exemplo tem uma etapa com
       intervalo ("7–10 dias"); o cronograma LIGADO é que usa `estimatedDays`
       numérico — ver `studio-commercial`. */
    page("timeline", "Cronograma e Etapas do Trabalho", [
      text(
        "ref-cronograma-total",
        "lead",
        `Total: ${REFERENCE_VALUES.prazoMinDias} a ${REFERENCE_VALUES.prazoMaxDias} dias úteis`,
      ),
      {
        kind: "timeline",
        id: "ref-cronograma-etapas",
        binding: null,
        steps: STEPS.map((step) => ({
          label: step.label,
          title: `${step.title} (${step.days})`,
          body: step.body,
        })),
      },
    ]),

    /* 5 — Marcenaria. Lista de módulos + o diferencial técnico, que é o
       argumento que justifica o preço. */
    page("services", "Marcenaria Sob Medida & Pranchas Executivas", [
      bullets("ref-marcenaria-modulos", [
        "Cozinha",
        "Bancadas integradas",
        "Banheiro",
        "Roupeiros da Suíte",
      ]),
      text("ref-marcenaria-diferencial", "kicker", "Diferencial técnico"),
      text(
        "ref-marcenaria-diferencial-corpo",
        "body",
        "Elevações cotadas com espessuras de MDF, divisão de gavetas, prateleiras, ferragens e puxadores prontas para produção.",
      ),
    ]),

    /* 6 — Opções de investimento.
       O VALOR é TEXTO do exemplo, porque não há proposta real por trás de um
       fixture. Quando este esqueleto for usado numa proposta verdadeira, a página
       passa a `binding: "OPCORES"` e o valor vem do servidor. A nota fica escrita
       porque é ela que impede que alguém leia estes números como um catálogo. */
    page("comparison", "Tabela Comparativa das Opções de Investimento", [
      {
        kind: "comparison",
        id: "ref-opcoes",
        binding: null,
        sides: OPTIONS.map((option, index) => ({
          title: `${option.label} · ${option.name}`,
          items: [`${formatBRL(option.perM2)}/m² · Total ${formatBRL(option.total)}`, ...option.features],
          highlight: index === 0,
        })),
      },
      text("ref-opcoes-nota", "caption", "Os valores são exemplos desta proposta e não regras do sistema."),
    ]),

    /* 7 — Condições de pagamento. */
    page("payment-conditions", "Condições e Formas de Pagamento", [
      bullets(
        "ref-pagamento-parcelas",
        PAYMENT_LABELS.map((label, index) => `${label}: ${PAYMENT_PERCENTS[index]}%`),
      ),
      text("ref-pagamento-metodo", "kicker", "Pagamento"),
      text("ref-pagamento-metodo-corpo", "body", "PIX ou Cartão de Crédito."),
    ]),

    /* 8 — Moodboard. */
    page("services", "Amostra Visual, Moodboard & Paisagismo", [
      bullets("ref-moodboard", [
        "Carvalho claro",
        "Linho",
        "Quartzo branco",
        "Iluminação quente",
        "Vegetação em vasos de cerâmica/pedra",
      ]),
    ]),

    /* 9 — Próximos passos. Fecha com um pedido de decisão claro, que é o que o
       cliente tem de fazer a seguir. */
    page("cta", "Próximos Passos & Início do Projeto", [
      bullets("ref-passos", [
        "Escolha da opção",
        "Assinatura do contrato",
        "Pagamento da entrada",
        "Agendamento da medição técnica",
      ]),
      text("ref-passos-diferencial", "kicker", "Diferencial"),
      text(
        "ref-passos-diferencial-corpo",
        "body",
        "15+ anos de experiência técnica em engenharia e arquitetura.",
      ),
      {
        kind: "cta",
        id: "ref-passos-cta",
        title: "Falar com a equipa",
        body: "Responde em WhatsApp. Portfólio em behance.net/eduardoarquitetura.",
        action: "Contactar",
      },
    ]),
  ];

  // `readStudioDeck` normaliza e valida: uma referência que se tornasse inválida
  // passaria a devolver um deck vazio em vez de uma proposta de validação, e o
  // teste que valida o Studio deixaria de testar alguma coisa.
  return readStudioDeck(toPersistedDeck({ theme: "arqvertice-editorial", slides, origin: null }));
}

/**
 * O deck de referência, pronto a gravar.
 *
 * Uma função e não uma constante: devolver o mesmo objecto a todos os chamadores
 * permitiria que um deles o mutasse e contaminasse os próximos.
 */
export function referenceDeck(): StudioDeck {
  return buildReferenceDeck();
}

/**
 * Confirma que os valores da referência são DADOS e não REGRAS.
 *
 * Não faz nada em tempo de execução: existe para dar um nome verificável à
 * promessa do cabeçalho. O teste correspondente percorre o código do sistema e
 * falha se um módulo de produção importar este ficheiro — que é o que garante que
 * `R$ 40/m²` não acaba, por um caminho indirecto, num cálculo de preço.
 */
export function fixtureValuesAreNotSystemRules(): readonly string[] {
  return Object.values(REFERENCE_VALUES).map(String);
}