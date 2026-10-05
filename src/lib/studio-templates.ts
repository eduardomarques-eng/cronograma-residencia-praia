/**
 * FASE 4D — TEMPLATES (item 37) E COMEÇAR EM BRANCO (item 36).
 *
 * Um template é um ESQUELETO de apresentação: a sequência de páginas, os layouts
 * e o tipo de conteúdo — nunca os valores de uma proposta concreta. É por isso
 * que este módulo não importa `studio-reference`: o fixture da Ravena é uma
 * PROPOSTA, e uma proposta não é um template. Misturar os dois é o caminho mais
 * curto para um cliente receber os números de outro.
 *
 * Duas garantias que os testes fixam e que valem mais do que o catálogo:
 *
 *  1. **Usar um template não altera o original.** `applyTemplate` e
 *     `duplicateDeck` devolvem SEMPRE objectos novos. Sem isso, editar a segunda
 *     proposta a partir de um template corromperia a primeira — e o ADMIN só
 *     descobriria isso ao voltar atrás, com o cliente a olhar para os dois.
 *  2. **Começar em branco é um caminho de primeira classe.** O item 36 exige que
 *     a IA seja assistente e não requisito: `blankDeck` não depende de modelo
 *     nenhum, e o editor abre com uma página vazia para o ADMIN começar.
 *
 * Os templates são dados puros: nada aqui toca na base de dados. É o que permite
 * validar o catálogo inteiro num teste, e o que impede que um template passe a
 * depender do estado de um cliente.
 */

import { readStudioDeck, stableId, toPersistedDeck, type StudioDeck, type StudioSlide } from "./studio-deck";
import { blankSlide, insertSlides } from "./studio-manipulate";
import { resolveLayout, type LayoutKey } from "./studio-layout";

/* -------------------------------------------------------------------------- */
/* CATEGORIAS (item 37)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * As sete categorias iniciais.
 *
 * São as que um escritório de arquitectura, interiores ou engenharia reconhece
 * sem explicação. Acrescentar uma categoria é uma entrada aqui — não um `if` num
 * componente, que é onde estas listas costumam divergir na primeira alteração.
 */
export const TEMPLATE_CATEGORIES = [
  "RESIDENCIAL",
  "INTERIORES",
  "ENGENHARIA",
  "ARQUITETURA",
  "ALTO_PADRAO",
  "COMERCIAL",
  "TECNICO",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<TemplateCategory, string>> = {
  RESIDENCIAL: "Residencial",
  INTERIORES: "Interiores",
  ENGENHARIA: "Engenharia",
  ARQUITETURA: "Arquitetura",
  ALTO_PADRAO: "Alto Padrão",
  COMERCIAL: "Comercial",
  TECNICO: "Técnico",
};

/* -------------------------------------------------------------------------- */
/* DEFINIÇÃO                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Um template.
 *
 * `layouts` e não `slideCount`: o template descreve a FORMA, e o conteúdo nasce ao
 * aplicar. Guardar a estrutura aqui e voltar a gerá-la ao aplicar daria duas
 * fontes para a mesma coisa — que é o defeito que a ligação comercial (itens 26 a
 * 30) acabou de eliminar.
 */
export type StudioTemplate = {
  key: string;
  label: string;
  category: TemplateCategory;
  /** Para que serve, em uma frase. É o texto de ajuda do ADMIN. */
  purpose: string;
  /** Layouts das páginas, pela ordem. Vazio = começar em branco. */
  layouts: readonly LayoutKey[];
  /** Tema sugerido. */
  theme: string;
};

/**
 * Construtor de uma entrada do catálogo.
 *
 * Normaliza o layout AQUI, e não ao aplicar: um template gravado numa versão
 * futura do catálogo tem de continuar a abrir alguma coisa, e normalizar na
 * aplicação deixaria o erro aparecer só quando alguém o usasse.
 */
const tpl = (
  key: string,
  label: string,
  category: TemplateCategory,
  purpose: string,
  layouts: readonly string[],
  theme = "arqvertice-minimal",
): StudioTemplate => ({
  key,
  label,
  category,
  purpose,
  layouts: layouts.map((layout) => resolveLayout(layout)),
  theme,
});

/**
 * CATÁLOGO DE TEMPLATES.
 *
 * Poucos, de propósito. O item 37 pede "poucos templates inicialmente,
 * qualidade > quantidade": um catálogo com vinte variantes quase iguais obriga o
 * ADMIN a compará-las todas e não o ajuda a decidir nada. Sete cobrem as sete
 * categorias; acrescentar-se-á um quando uma categoria ficar mal servida.
 */
export const TEMPLATES: readonly StudioTemplate[] = [
  tpl(
    "residencial",
    "Residencial",
    "RESIDENCIAL",
    "Obra residencial: diagnóstico, escopo por ambiente, investimento e prazos.",
    ["cover", "text-image", "scope", "investment", "payment-conditions", "cta", "closing"],
    "arqvertice-residencial",
  ),
  tpl(
    "interiores",
    "Interiores",
    "INTERIORES",
    "Design de interiores: conceito, moodboard, marcenaria e acabamentos.",
    ["cover", "image-full", "services", "gallery", "investment", "cta", "closing"],
    "arqvertice-editorial",
  ),
  tpl(
    "engenharia",
    "Engenharia",
    "ENGENHARIA",
    "Projeto de engenharia: diagnóstico, cálculo, memória descritiva e peças desenhadas.",
    ["cover", "title-text", "list", "table-highlight", "process", "cta", "closing"],
    "arqvertice-engenharia",
  ),
  tpl(
    "arquitetura",
    "Arquitetura",
    "ARQUITETURA",
    "Projeto de arquitectura: diagnóstico, partido, planta, medições e honorários.",
    ["cover", "text-image", "two-columns", "gallery", "scope", "investment", "cta"],
    "arqvertice-minimal",
  ),
  tpl(
    "alto-padrao",
    "Alto Padrão",
    "ALTO_PADRAO",
    "Obra de valor elevado: diagnóstico cuidado, marcenaria e opções de pacote.",
    ["cover", "image-background", "timeline", "services", "comparison", "metric-highlight", "cta"],
    "arqvertice-alto-padrao",
  ),
  tpl(
    "comercial",
    "Comercial",
    "COMERCIAL",
    "Espaço comercial: conceito, zoning, sinalética e faseamento de obra.",
    ["cover", "image-full", "three-columns", "cards-asymmetric", "timeline", "investment", "cta"],
    "arqvertice-editorial",
  ),
  tpl(
    "tecnico",
    "Técnico",
    "TECNICO",
    "Proposta técnica: índice de peças, tabelas densas e notas de execução.",
    ["cover", "title-text", "table-highlight", "process", "list", "cta"],
    "arqvertice-tecnico",
  ),
];

export function getTemplate(key: string): StudioTemplate | null {
  return TEMPLATES.find((template) => template.key === key) ?? null;
}

export function templatesByCategory(category: TemplateCategory): StudioTemplate[] {
  return TEMPLATES.filter((template) => template.category === category);
}

/* -------------------------------------------------------------------------- */
/* OPERAÇÕES                                                                   */
/* -------------------------------------------------------------------------- */

/** Título por omissão de uma página de template. */
const PLACEHOLDER_TITLES: Readonly<Record<string, string>> = {
  cover: "Capa",
  "title-text": "Secção",
  "text-image": "Diagnóstico",
  "image-text": "Conceito",
  "image-full": "Imagem",
  "image-background": "Capa com imagem",
  "two-columns": "Dois blocos",
  "three-columns": "Três blocos",
  "four-cards": "Quatro pontos",
  "cards-asymmetric": "Destaques",
  list: "Lista",
  "metric-highlight": "Número em destaque",
  "table-highlight": "Tabela",
  comparison: "Comparativo",
  timeline: "Cronograma",
  process: "Processo",
  gallery: "Galeria",
  "before-after": "Antes e depois",
  services: "Serviços",
  scope: "Escopo",
  investment: "Investimento",
  "payment-conditions": "Pagamento",
  cta: "Próximo passo",
  closing: "Encerramento",
};

/**
 * Página vazia de um template, com o título que a posição sugere.
 *
 * O título é um ROTULO, não conteúdo: o ADMIN escreve por cima. Serve para o
 * painel de páginas não mostrar nove páginas sem nome, que é indistinguível de um
 * bug.
 */
function templateSlide(layout: LayoutKey, position: number, templateKey: string): StudioSlide {
  return { ...blankSlide(layout, position), title: PLACEHOLDER_TITLES[layout] ?? "Página" };
}

/**
 * Aplica um template, devolvendo um deck NOVO.
 *
 * `base` é o deck a partir do qual se aplica — normalmente um deck em branco. É
 * explícito porque "aplicar" e "substituir" são operações diferentes e confundi-las
 * fazia com que um botão perdesse trabalho sem avisar.
 *
 * O resultado nunca partilha objectos com `base` nem com o template: os testes
 * verificam precisamente isso, porque é o defeito que só aparece quando o ADMIN
 * já salvou a primeira proposta.
 */
export function applyTemplate(
  template: StudioTemplate,
  base: StudioDeck,
  options: { replace?: boolean } = {},
): StudioDeck {
  const created = template.layouts.map((layout, index) =>
    templateSlide(layout, index, template.key),
  );

  // Sem `replace`, as páginas novas entram À FRENTE das existentes: é o que
  // permite juntar um template a uma proposta que já tem conteúdo.
  const merged = options.replace
    ? { ...base, slides: created }
    : insertSlides({ ...base, theme: template.theme }, 0, created);

  return readStudioDeck(toPersistedDeck({ ...merged, theme: template.theme }));
}

/**
 * Deck vazio para começar de raiz (item 36).
 *
 * Inclui UMA página: um editor sem páginas não tem o que mostrar e obriga o ADMIN
 * a descobrir que precisa de criar a primeira. A página vem com o layout `cover`,
 * porque quase toda a proposta começa com uma capa.
 *
 * Não depende de modelo, token ou serviço: é a prova de que a IA é assistente.
 */
export function blankDeck(theme = "arqvertice-minimal"): StudioDeck {
  return readStudioDeck(
    toPersistedDeck({
      theme,
      origin: null,
      slides: [{ ...blankSlide("cover", 0), title: PLACEHOLDER_TITLES.cover ?? "Capa" }],
    }),
  );
}

/**
 * Duplica um deck com ids NOVOS.
 *
 * Sem recriar os ids, o duplicado e o original passariam a partilhar
 * identidade: apagar uma página do duplicado apagaria a do original, e o histórico
 * de desfazer deixaria de saber qual era qual.
 *
 * É a operação que sustenta o "duplicar" e o "gerar nova proposta baseada neste"
 * do item 37 — e a razão de o original nunca ser alterado.
 */
export function duplicateDeck(deck: StudioDeck, salt: string): StudioDeck {
  return readStudioDeck(
    toPersistedDeck({
      theme: deck.theme,
      origin: deck.origin,
      slides: deck.slides.map((slide, position) => ({
        ...slide,
        id: stableId("slide", salt, position, slide.title, slide.body),
        elements: slide.elements.map((element) => ({
          ...element,
          id: stableId("el", salt, position, element.id),
        })),
      })),
    }),
  );
}

/**
 * Cria um template a partir de um deck existente.
 *
 * Guardar o CONTEÚDO num template seria guardar uma proposta dentro de outra, e o
 * próximo cliente a usá-lo receberia o texto do anterior. O que se guarda é a
 * ESTRUTURA: a sequência de layouts, o que é o que um template significa.
 *
 * Por isso os elementos são esvaziados e os títulos normalizados para os rótulos
 * de posição — o esqueleto sem o substance de uma proposta.
 */
export function templateFromDeck(deck: StudioDeck): StudioTemplate {
  return {
    key: "",
    label: "",
    category: "RESIDENCIAL",
    purpose: "",
    layouts: deck.slides.map((slide) => slide.layout),
    theme: deck.theme,
  };
}

/**
 * Escolhe o template mais próximo de um deck já existente.
 *
 * Serve ao "usar template" sem partir do zero: o ADMIN mostra um deck e pergunta
 * "que template se parece com isto?". A pontuação é por layouts coincidentes, e é
 * deliberadamente simples — uma heurística complicateda aqui seria mais código do
 * que a decisão que automatiza.
 */
export function nearestTemplate(deck: StudioDeck): StudioTemplate | null {
  const layouts = deck.slides.map((slide) => slide.layout);
  // Sem páginas não há nada a comparar. Devolver o primeiro template do catálogo
  // seria uma sugestão sem fundamento nenhum — e o ADMIN não saberia se era um
  // palpite ou uma conclusão.
  if (layouts.length === 0) return null;

  let melhor: { template: StudioTemplate; pontos: number } | null = null;

  for (const template of TEMPLATES) {
    const coincidentes = template.layouts.filter((layout) => layouts.includes(layout)).length;
    // Normaliza pelo maior dos dois: assim um template de 7 páginas não ganha só
    // por ser maior, e uma apresentação de 2 páginas não é punida por ser curta.
    const maior = Math.max(template.layouts.length, layouts.length, 1);
    const pontos = coincidentes / maior;
    if (!melhor || pontos > melhor.pontos) melhor = { template, pontos };
  }

  // Sem um único layout em comum, qualquer resposta seria arbitrária.
  return melhor && melhor.pontos > 0 ? melhor.template : null;
}