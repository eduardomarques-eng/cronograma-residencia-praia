import type { LayoutKey } from "./studio-layout";

/**
 * FASE 4C — GERADOR DE ESTRUTURA (itens 6 e 7).
 *
 * "Gerar estrutura" é uma operação separada de "Gerar apresentação", e a
 * separação é deliberada: o ADMIN revê e edita o ESQUELETO antes de existir
 * uma linha de texto final. Uma proposta é uma decisão comercial; se a IA
 * decidir de uma vez quantas páginas há e o que dizem, o ADMIN nunca teve
 * hipótese de discordar da estrutura.
 *
 * Duas garantias estruturam este módulo:
 *
 *  1. **Nada é inventado.** Uma secção entra na estrutura porque existe DADO
 *     que a sustente — linhas de serviço, um plano de pagamento, um
 *     cronograma. Cada entrada guarda o `reason` que a justifica ou a exclui,
 *     e `dataAvailable: false` é recusado. Um "Cronograma" sem cronograma no
 *     sistema seria uma promessa que ninguém pode cumprir.
 *
 *  2. **Sem limite artificial.** O item 7 proíbe o teto de nove páginas, mas
 *     também proíbe o inverso — encher a proposta de páginas. `auditOutline`
 *     dá a CADA página uma função verificável e `MAX_RECOMMENDED_SLIDES` é um
 *     aviso de composição, não um corte.
 */

/** As onze secções que o item 6 enumera, na ordem de leitura. */
export type OutlineSectionKey =
  | "CAPA"
  | "CONTEXTO"
  | "DIAGNOSTICO"
  | "CONCEITO"
  | "ESCOPO"
  | "SERVICOS"
  | "PROCESSO"
  | "CRONOGRAMA"
  | "INVESTIMENTO"
  | "CONDICOES"
  | "PROXIMOS_PASSOS";

export type OutlineRequirement = {
  /** Título exacto que o editor propõe. Editável pelo ADMIN. */
  title: string;
  /** O que esta secção serve, em uma frase. */
  purpose: string;
  /** Layout natural para a secção. O ADMIN pode trocar. */
  layout: LayoutKey;
  /** O que tem de EXISTIR no sistema para esta secção ser honesta. */
  requires: OutlineDataKey;
  /** `true` quando a proposta não faz sentido comercial sem esta secção. */
  essential: boolean;
};

export type OutlineDataKey =
  | "projeto"
  | "briefing"
  | "servicos"
  | "cronograma"
  | "pagamento"
  | "validade"
  | "proximoPasso";

export type OutlineSection = OutlineRequirement & {
  key: OutlineSectionKey;
  /** `false` quando não há dado que sustente a secção. */
  dataAvailable: boolean;
  /** Por que entra, ou por que não entra. Mostrado ao ADMIN. */
  reason: string;
};

const section = (
  key: OutlineSectionKey,
  title: string,
  purpose: string,
  layout: LayoutKey,
  requires: OutlineDataKey,
  essential: boolean,
): OutlineRequirement => ({ title, purpose, layout, requires, essential });

/**
 * CATÁLOGO DAS SECÇÕES.
 *
 * A ordem é a ordem em que o cliente compreende o valor, e é a mesma ordem de
 * `NARRATIVE_SECTIONS` em `template-registry.ts`. Se um dia divergirem, nasce
 * uma segunda verdade sobre a narrativa da proposta — daí ser declarada aqui
 * com o mesmo sentido.
 */
export const OUTLINE_SECTIONS: Readonly<Record<OutlineSectionKey, OutlineRequirement>> = {
  CAPA: section("CAPA", "Proposta comercial", "Abre com o que é e para quem.", "cover", "projeto", true),
  CONTEXTO: section(
    "CONTEXTO",
    "O projeto do cliente",
    "Mostra que o estúdio ouviu o cliente.",
    "text-image",
    "briefing",
    false,
  ),
  DIAGNOSTICO: section(
    "DIAGNOSTICO",
    "O que foi identificado",
    "Traduz o problema em linguagem clara.",
    "list",
    "briefing",
    false,
  ),
  CONCEITO: section(
    "CONCEITO",
    "A direção de projeto",
    "Explica a intenção estética e funcional.",
    "image-full",
    "projeto",
    false,
  ),
  ESCOPO: section(
    "ESCOPO",
    "Escopo contratado",
    "Separa o que entra do que fica de fora.",
    "scope",
    "servicos",
    true,
  ),
  SERVICOS: section(
    "SERVICOS",
    "Serviços",
    "Detalha o que o cliente está a contratar.",
    "services",
    "servicos",
    true,
  ),
  PROCESSO: section(
    "PROCESSO",
    "Como trabalhamos",
    "Reduz a incerteza mostrando o método.",
    "process",
    "projeto",
    false,
  ),
  CRONOGRAMA: section(
    "CRONOGRAMA",
    "Cronograma",
    "Liga o serviço a um prazo.",
    "timeline",
    "cronograma",
    false,
  ),
  INVESTIMENTO: section(
    "INVESTIMENTO",
    "Investimento",
    "O valor e o que o compõe.",
    "investment",
    "servicos",
    true,
  ),
  CONDICOES: section(
    "CONDICOES",
    "Condições e pagamento",
    "Como e quando se paga.",
    "payment-conditions",
    "pagamento",
    true,
  ),
  PROXIMOS_PASSOS: section(
    "PROXIMOS_PASSOS",
    "Próximos passos",
    "Pede uma decisão concreta.",
    "cta",
    "proximoPasso",
    true,
  ),
};

/** Ordem de leitura. Não é a ordem do objecto — é a ordem comercial. */
export const OUTLINE_ORDER: readonly OutlineSectionKey[] = [
  "CAPA",
  "CONTEXTO",
  "DIAGNOSTICO",
  "CONCEITO",
  "ESCOPO",
  "SERVICOS",
  "PROCESSO",
  "CRONOGRAMA",
  "INVESTIMENTO",
  "CONDICOES",
  "PROXIMOS_PASSOS",
];
/**
 * O que o sistema sabe hoje sobre esta proposta.
 *
 * É uma lista curta de VERDADES, não de dados brutos: quem chama responde
 * "existe cronograma?", não "carrega o cronograma". Isso mantém o gerador
 * testável sem base de dados e impede que ele comece a interpretar objectos.
 */
export type OutlineInputs = {
  projeto: boolean;
  briefing: boolean;
  servicos: boolean;
  cronograma: boolean;
  pagamento: boolean;
  validade: boolean;
  proximoPasso: boolean;
};

const REASON_WHEN_ABSENT: Record<OutlineSectionKey, string> = {
  CAPA: "Não há projeto associado à proposta.",
  CONTEXTO: "O briefing ainda não tem respostas do cliente.",
  DIAGNOSTICO: "O briefing ainda não tem respostas do cliente.",
  CONCEITO: "Não há projeto descrito.",
  ESCOPO: "Ainda não existem linhas de serviço contratadas.",
  SERVICOS: "Ainda não existem linhas de serviço contratadas.",
  PROCESSO: "Não há projeto descrito.",
  CRONOGRAMA: "Não existe cronograma calculado para este projeto.",
  INVESTIMENTO: "Ainda não existem linhas de serviço com valor.",
  CONDICOES: "Não existe plano de pagamento definido.",
  PROXIMOS_PASSOS: "A proposta não define próximo passo.",
};

/**
 * Gera a estrutura sugerida.
 *
 * Duas regras, e ambas verificáveis num teste:
 *
 *  · uma secção **essencial** sem dado entra na mesma assim, marcada
 *    `dataAvailable: false` — não é removida. Tirar o "Investimento" de uma
 *    proposta sem valores não resolve o problema: torna-a inválida e invisível
 *    ao mesmo tempo. Fica visível, com o aviso certo.
 *  · uma secção **opcional** sem dado é EXCLUÍDA, e o `reason` diz porquê. É o
 *    que impede a IA de encher a proposta de páginas deBorbolha.
 */
export function suggestOutline(inputs: OutlineInputs): OutlineSection[] {
  return OUTLINE_ORDER.map((key) => {
    const requirement = OUTLINE_SECTIONS[key];
    const available = inputs[requirement.requires];

    if (!available) {
      return {
        ...requirement,
        key,
        title: requirement.title,
        dataAvailable: false,
        // A distinção está no AVISO, não na presença. Uma secção essencial sem
        // dado continua visível — escondê-la resolveria o sintoma e criaria uma
        // proposta inválida que ninguém percebeu. Uma opcional sem dado é
        // excluída por `outlineToSections`, e este `reason` explica porquê.
        reason: requirement.essential
          ? `${REASON_WHEN_ABSENT[key]} Esta secção é obrigatória numa proposta — preencha-a antes de enviar.`
          : REASON_WHEN_ABSENT[key],
      };
    }
    return {
      ...requirement,
      key,
      title: requirement.title,
      dataAvailable: true,
      reason: `Incluída porque existe ${requirement.requires} na proposta.`,
    };
  });
}

/** Só as secções que devem virar página, pela ordem de leitura. */
export function outlineToSections(entries: readonly OutlineSection[]): OutlineSection[] {
  return entries.filter((entry) => entry.dataAvailable || entry.essential);
}

/* -------------------------------------------------------------------------- */
/* ITEM 7 — QUANTIDADE DE SLIDES                                               */
/* -------------------------------------------------------------------------- */

/**
 * Aviso de composição, NÃO um limite.
 *
 * O item 7 proíbe explicitamente um teto pequeno. Este número existe apenas
 * para dizer "esta proposta tem 24 páginas — é mesmo o que quer?". Pode e deve
 * ser ultrapassado: uma proposta de engenharia com 30 páginas é legítima.
 */
export const MAX_RECOMMENDED_SLIDES = 18;

/**
 * A função de uma página, segundo o item 7.
 *
 * `NARRATIVA` explica, `COMERCIAL` convince, `VISUAL` mostra. Uma página sem
 * nenhuma das três não justifica existir — e é isso que o `auditOutline`
 * detecta, sem dizer ao ADMIN o que apagar.
 */
export type SlideFunction = "NARRATIVA" | "COMERCIAL" | "VISUAL" | "SEM_FUNCAO";

/**
 * Deduz a função de uma página a partir do seu conteúdo.
 *
 * É uma leitura do que a página CONTÉM, não do que se pretende que signifique:
 * uma página com um destaque numérico é comercial porque tem um número, não
 * porque o layout se chama "investimento".
 */
export function slideFunction(input: {
  layout: LayoutKey;
  hasImage: boolean;
  hasMetric: boolean;
  hasTable: boolean;
  hasCards: boolean;
  wordCount: number;
}): SlideFunction {
  if (input.hasMetric || input.hasTable) return "COMERCIAL";
  if (input.hasImage) return "VISUAL";
  if (input.hasCards || input.wordCount >= 20) return "NARRATIVA";
  return "SEM_FUNCAO";
}

export type OutlineAuditEntry = {
  index: number;
  title: string;
  slideFunction: SlideFunction;
  /** Motivo legível, para o editor mostrar ao ADMIN. */
  note: string;
};

export type OutlineAudit = {
  entries: OutlineAuditEntry[];
  total: number;
  /** Páginas que não justificam a existência. */
  orphans: number;
  /** `true` quando o total é alto. Não bloqueia nada. */
  aboveRecommended: boolean;
};

/**
 * Auditoria de composição.
 *
 * Não altera nada — só diz. Quem decide é o ADMIN, porque às vezes uma página
 * "sem função" existe por um acordo verbal com o cliente que o sistema não vê.
 */
export function auditOutline(
  pages: ReadonlyArray<{
    title: string;
    layout: LayoutKey;
    hasImage: boolean;
    hasMetric: boolean;
    hasTable: boolean;
    hasCards: boolean;
    wordCount: number;
  }>,
): OutlineAudit {
  const entries: OutlineAuditEntry[] = pages.map((page, index) => {
    const role = slideFunction({
      layout: page.layout,
      hasImage: page.hasImage,
      hasMetric: page.hasMetric,
      hasTable: page.hasTable,
      hasCards: page.hasCards,
      wordCount: page.wordCount,
    });
    return {
      index,
      title: page.title,
      slideFunction: role,
      note:
        role === "SEM_FUNCAO"
          ? "Esta página não tem imagem, número, tabela nem texto suficiente. Só continua a existir se o cliente a pedir."
          : "",
    };
  });

  return {
    entries,
    total: entries.length,
    orphans: entries.filter((entry) => entry.slideFunction === "SEM_FUNCAO").length,
    aboveRecommended: entries.length > MAX_RECOMMENDED_SLIDES,
  };
}