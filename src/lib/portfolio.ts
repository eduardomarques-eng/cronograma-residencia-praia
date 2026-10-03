import { normalizeDiscipline, type Discipline } from "./commercial-scope";

/**
 * Tópico 44 — portfólio contextual.
 *
 * A imagem tem de **reforçar o serviço apresentado**, não decorar. Por isso a
 * seleção é uma pontuação explícita e explicável sobre quatro eixos —
 * disciplina, estilo, ambiente e tipo de projeto — e nunca uma escolha
 * aleatória. Quando nada pontua o suficiente, o sistema devolve `null` em vez de
 * empurrar uma imagem irrelevante (Tópico 30).
 */

export type PortfolioContext = {
  discipline?: string | null;
  style?: string | null;
  environment?: string | null;
  projectType?: string | null;
};

export type PortfolioImage = {
  id: string;
  url: string;
  altText?: string | null;
  disciplines?: readonly string[];
  styles?: readonly string[];
  environments?: readonly string[];
  projectTypes?: readonly string[];
  active?: boolean;
  /** Posição manual do ADMIN; menor aparece primeiro. */
  displayOrder?: number;
  discipline?: string | null;
};

/**
 * Prompt 18, itens 15 e 16 — identidade do item RESOLVIDO.
 *
 * A pendência 5 era real: o override mantinha o `id` do original, o que fazia
 * o documento apontar a uma imagem que não estava a ser mostrada. Aqui as duas
 * identidades ficam separadas e explícitas:
 *
 *  · `originalId` — o item que o sistema seleccionou;
 *  · `image`      — a imagem ACTUALMENTE apresentada, com o seu id real;
 *
 * e `overrideId` mais `overriddenBy`preserveem o rasto da substituição, que
 * o item 15 exige ("preservar histórico da substituição").
 */
export type ResolvedPortfolioItem = {
  /** Identidade do item original, preservada mesmo após substituição. */
  originalId: string;
  /** Identidade da imagem efectivamente apresentada. */
  image: PortfolioImage;
  overrideId: string | null;
  overriddenBy: string | null;
  /**
   * Pontuação de adequação ao CONTEXTO (item 17).
   *
   * Semanticamente é "quanto esta imagem serve o espaço", não "qualidade da
   * imagem". Por isso sobrevive à substituição: o ADMIN escolheu substituir a
   * imagem mantendo a intenção de servir aquele contexto. Está documentado aqui
   * porque é uma decisão, não um acidente — ver `resolvePortfolioSelection`.
   */
  score: number;
  reasons: string[];
  /** `ORDER` é a ordem original; um override não muda a posição na apresentação. */
  order: number;
  context: PortfolioContext;
  state: "ORIGINAL" | "SUBSTITUIDA" | "REMOVIDA";
};

/** Overrides persistidos: id do original → id da substituta ("" = remover). */
export type PortfolioOverrides = Record<string, string>;

export type PortfolioMatch = {
  image: PortfolioImage;
  score: number;
  /** Por que esta imagem foi escolhida — o ADMIN precisa de justificar. */
  reasons: string[];
};

export type PortfolioSelection = {
  matches: PortfolioMatch[];
  /** Verdadeiro quando nenhuma imagem atingiu o corte de relevância. */
  empty: boolean;
};

const RELEVANCE_THRESHOLD = 2;

/**
 * Normaliza rótulos para comparação: remove acentos e padroniza a caixa.
 *
 * A remoção de acentos segue a técnica já validada em `commercial-scope.ts`:
 * NFD seguido da classe de caracteres combinantes Unicode.
 */
function normalize(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

function matchesAxis(expected: readonly string[] | undefined, actual: string): boolean {
  if (!expected?.length || !actual) return false;
  const target = normalize(actual);
  return expected.some((item) => {
    const value = normalize(item);
    // Correspondência exata ou por conteúdo: "RESIDENCIAL" casa com
    // "RESIDENCIAL_UNIFAMILIAR", o que dá contexto ao semântico.
    return value === target || target.includes(value) || value.includes(target);
  });
}

export type PortfolioScoreInput = {
  image: PortfolioImage;
  context: PortfolioContext;
};

/** Pontua uma imagem e regista o motivo de cada ponto atribuído. */
export function scorePortfolioImage({ image, context }: PortfolioScoreInput): PortfolioMatch {
  const reasons: string[] = [];
  let score = 0;

  if (matchesAxis(image.disciplines, context.discipline ?? "")) {
    score += 2;
    reasons.push(`disciplina ${context.discipline}`);
  }
  if (matchesAxis(image.styles, context.style ?? "")) {
    score += 2;
    reasons.push(`estilo ${context.style}`);
  }
  if (matchesAxis(image.environments, context.environment ?? "")) {
    score += 1;
    reasons.push(`ambiente ${context.environment}`);
  }
  if (matchesAxis(image.projectTypes, context.projectType ?? "")) {
    score += 1;
    reasons.push(`tipo ${context.projectType}`);
  }

  return { image, score, reasons };
}

/**
 * Seleciona as imagens para um contexto.
 *
 * Desempate determinístico: pontuação, depois `displayOrder`, depois id —
 * nunca a ordem de entrada do banco, para que o resultado não oscile entre
 * duas leituras da mesma tabela.
 */
export function selectPortfolioImages(
  images: ReadonlyArray<PortfolioImage>,
  context: PortfolioContext,
  options: { limit?: number; threshold?: number } = {},
): PortfolioSelection {
  const limit = options.limit ?? 6;
  const threshold = options.threshold ?? RELEVANCE_THRESHOLD;

  const matches = images
    .filter((image) => image.active !== false)
    .map((image) => scorePortfolioImage({ image, context }))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const orderA = a.image.displayOrder ?? 0;
      const orderB = b.image.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.image.id.localeCompare(b.image.id);
    })
    .slice(0, limit);

  return { matches, empty: matches.length === 0 };
}

/**
 * Prompt 18, itens 15, 16, 19 e 20 — RESOLUÇÃO CENTRAL ÚNICA.
 *
 * Um único sítio decide, para um dado contexto e conjunto de overrides:
 * item original → override existente → item final → imagem final.
 *
 * Todos os consumidores (preview do ADMIN, proposta pública, gerador de
 * documento) usam ESTA função. É o que garante que os três mostram a mesma
 * imagem para a mesma versão da proposta — o objectivo do item 21.
 *
 * A antiga `applyPortfolioOverrides` foi REMOVIDA (não existiam dependências
 * fora do seu próprio teste, verificado por pesquisa no código). Não podia
 * cumprir o papel de todos modos: recebia apenas a selecção e não o catálogo,
 * logo não conseguia resolver uma substituta que não estivesse seleccionada.
 * Manter as duas seria justamente as "duas fontes de verdade" que o item 20
 * proíbe.
 *
 * Decisões, e porquê:
 *
 *  · A pontuação é de ADEQUAÇÃO AO CONTEXTO (item 17), não de qualidade da
 *    imagem. Verificar no código que só disciplina/estilo/ambiente/tipo entram
 *    na pontuação confirmou isto. Por isso a substituição não a recalcula:
 *    o ADMIN trocou a imagem mantendo a intenção de servir aquele espaço.
 *    Está escrito aqui para não voltar a ser questionado por engano.
 *  · A ordem não muda com a substituição — a substituição é de conteúdo, não
 *    de posição na apresentação.
 *  · Um override que aponta para imagem inexistente ou inativa é IGNORADO, e o
 *    original permanece: uma referência quebrada não pode apagar a imagem.
 *  · Um override para "" remove o item, registando-o como REMOVIDA em vez de o
 *    silenciar, para que o rasto da decisão exista.
 */
export function resolvePortfolioSelection(input: {
  images: ReadonlyArray<PortfolioImage>;
  context: PortfolioContext;
  overrides?: PortfolioOverrides;
  limit?: number;
  threshold?: number;
}): ResolvedPortfolioItem[] {
  const { images, context, overrides = {}, limit, threshold } = input;
  const byId = new Map(images.map((image) => [image.id, image]));

  // 1. Selecção por adequação ao contexto, com desempate estável.
  const selected = images
    .filter((image) => image.active !== false)
    .map((image) => scorePortfolioImage({ image, context }))
    .filter((match) => match.score >= (threshold ?? RELEVANCE_THRESHOLD))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const orderA = a.image.displayOrder ?? 0;
      const orderB = b.image.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.image.id.localeCompare(b.image.id);
    })
    .slice(0, limit);

  // 2. Resolução dos overrides, item a item.
  const resolved: ResolvedPortfolioItem[] = [];
  selected.forEach((match, index) => {
    const overrideId = overrides[match.image.id];

    if (overrideId === "") {
      resolved.push({
        originalId: match.image.id,
        image: match.image,
        overrideId: null,
        overriddenBy: null,
        score: match.score,
        reasons: [...match.reasons, "removida pelo ADMIN"],
        order: index,
        context,
        state: "REMOVIDA",
      });
      return;
    }

    if (overrideId === undefined) {
      resolved.push({
        originalId: match.image.id,
        image: match.image,
        overrideId: null,
        overriddenBy: null,
        score: match.score,
        reasons: match.reasons,
        order: index,
        context,
        state: "ORIGINAL",
      });
      return;
    }

    const replacement = byId.get(overrideId);
    if (!replacement || replacement.active === false) {
      // Referência quebrada: mantemos o original e dizemos porquê.
      resolved.push({
        originalId: match.image.id,
        image: match.image,
        overrideId,
        overriddenBy: null,
        score: match.score,
        reasons: [...match.reasons, "substituição inválida: imagem não disponível"],
        order: index,
        context,
        state: "ORIGINAL",
      });
      return;
    }

    resolved.push({
      originalId: match.image.id,
      image: replacement,
      overrideId,
      overriddenBy: match.image.id,
      score: match.score,
      reasons: [...match.reasons, "substituída pelo ADMIN"],
      order: index,
      context,
      state: "SUBSTITUIDA",
    });
  });

  return resolved;
}


/** Deriva o contexto de portfolio a partir de um serviço contratado. */
export function contextFromService(service: Record<string, unknown>): PortfolioContext {
  return {
    discipline: normalizeDiscipline(service.discipline ?? service.category) ?? (typeof service.discipline === "string" ? service.discipline : null),
    style: typeof service.style === "string" ? service.style : null,
    environment: typeof service.environment === "string" ? service.environment : null,
    projectType: typeof service.projectType === "string" ? service.projectType : null,
  };
}

export type { Discipline };
