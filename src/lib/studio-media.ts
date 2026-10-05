/**
 * FASE 4C — MEDIA STUDIO (itens 19 a 24).
 *
 * Este módulo é a METADATA das imagens. Os bytes ficam no storage que já
 * existe (`@/server/storage`) e a origem visual das imagens de serviço continua
 * a ser `ServiceItem.presentationImages` — criar um segundo sistema de media
 * seria exactamente o que o item 20 proíbe.
 *
 * A decisão que estrutura tudo o resto:
 *
 *  · **Nenhum ajuste toca no ficheiro original** (item 21). Recorte, ponto
 *    focal, `fit` e "usar como fundo" são METADATA guardadas ao lado do
 *    `url`. O original fica intacto e o ajuste é reversível. Reescrever o
 *    binário a cada ajuste seria irreversível, multiplicaria o storage e
 *    perderia a imagem de origem de um modo que ninguém consegue desfazer.
 *
 *  · **A escolha de imagem tem ORDEM** (item 24). Imagem do projecto, depois
 *    carregada pelo utilizador, depois biblioteca, e só no fim geração por IA.
 *    E gerar automaticamente quando já existe uma imagem adequada é proibido
 *    sem pedido explícito — é o `rankFor` que decide, não o chamador.
 *
 * A `MediaOrigin` e o `ImageFit` NÃO são redefinidos aqui: vêm do `studio-deck`,
 * que é quem persiste. Uma segunda nomenclatura faria o `source` gravado numa
 * página deixar de ser comparável com o da biblioteca.
 */

import type { ImageFit, MediaOrigin } from "./studio-deck";

/* -------------------------------------------------------------------------- */
/* TAXONOMIA (item 20)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * As categorias do item 20, tal como ele as enumera.
 *
 * São as do BRIEFING, não as de uma biblioteca genérica: um estúdio de
 * arquitectura não precisa de "abstract" nem de "people", precisa de saber se
 * uma foto é de fachada, de cozinha ou de material.
 */
export const MEDIA_CATEGORIES = [
  "fachada",
  "sala",
  "cozinha",
  "quarto",
  "suite",
  "banheiro",
  "area-gourmet",
  "paisagismo",
  "materiais",
  "obra",
  "detalhe",
  "render",
  "referencia",
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

/** Rótulos em português, para a interface. A chave é o valor persistido. */
export const MEDIA_CATEGORY_LABEL: Readonly<Record<MediaCategory, string>> = {
  fachada: "Fachada",
  sala: "Sala",
  cozinha: "Cozinha",
  quarto: "Quarto",
  suite: "Suíte",
  banheiro: "Banheiro",
  "area-gourmet": "Área gourmet",
  paisagismo: "Paisagismo",
  materiais: "Materiais",
  obra: "Obra",
  detalhe: "Detalhe",
  render: "Render",
  referencia: "Referência",
};

/** Ambientes: Onde a foto foi tirada. Distinto de CATEGORIA porque uma foto de
 * "cozinha" pode ser de uma cozinha de casa ou de um showroom. */
export const MEDIA_ENVIRONMENTS = [
  "casa",
  "apartamento",
  "comercial",
  "escritorio",
  "showroom",
  "obra",
  "exterior",
  "not-aplicavel",
] as const;

export type MediaEnvironment = (typeof MEDIA_ENVIRONMENTS)[number];

/**
 * De onde veio a imagem (item 22).
 *
 * `AI` e `VARIACAO` são separados de propósito: o cliente tem de poder
 * distinguir uma fotografia do projecto real de uma imagem gerada, e
 * distinguir uma geração de uma variação de referência.
 *
 * Os nomes vêm do `MediaOrigin` do `studio-deck` — este módulo ADICIONA
 * `variacao`, não substitui. Duas listas de origens no mesmo produto divergiriam
 * na primeira alteração, e o `source` gravado numa página deixaria de ser
 * legível pela biblioteca.
 */
export type MediaOriginKind = MediaOrigin | "variacao";

export type MediaType = "foto" | "render" | "desenho" | "material";

/* -------------------------------------------------------------------------- */
/* TRANSFORMAÇÕES (item 21)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ponto focal, em percentagem (0 a 1) do tamanho da imagem.
 *
 * É o que permite que um recorte não corte o rosto do cliente nem a peça
 * central de uma cozinha. Guardar isto em vez de recortar é o que mantém o
 * original intacto.
 */
export type FocalPoint = { x: number; y: number };

/**
 * Como a imagem ocupa o espaço.
 *
 * `cover` preenche e corta; `contain` mostra tudo com barras. O item 21 pede
 * "manter proporção" — as duas opções mantêm sempre a proporção; o que muda é
 * se se perde conteúdo.
 *
 * Reutiliza o `ImageFit` do `studio-deck`: é esse valor que é gravado na
 * página, e um terceiro nome que não chega ao deck seria revertido ao guardar.
 */
export type ImageFitMode = ImageFit;

/**
 * Ajustes de uma imagem numa página.
 *
 * Tudo isto é reversível e não toca no ficheiro. `crop` guarda a fração
 * visível; `null` significa "imagem inteira".
 */
export type ImageTransform = {
  fit: ImageFitMode;
  focal: FocalPoint;
  /** Fração visível, 0 a 1. `null` = sem recorte. */
  crop: { top: number; right: number; bottom: number; left: number } | null;
  /** A imagem serve de fundo da página (item 19). */
  background: boolean;
  /** Distância focal em píxeis de ecrã, para afastar o conteúdo da imagem. */
  padding: number;
};

export const DEFAULT_TRANSFORM: ImageTransform = {
  fit: "cover",
  focal: { x: 0.5, y: 0.5 },
  crop: null,
  background: false,
  padding: 0,
};

/** Aplica um ajuste sem tocar no original. Devolve um objecto novo. */
export function withTransform(current: ImageTransform, patch: Partial<ImageTransform>): ImageTransform {
  return { ...current, ...patch, focal: { ...current.focal, ...(patch.focal ?? {}) } };
}

/**
 * Limita o ponto focal à área da imagem.
 *
 * Sem isto, arrastar o ponto focal para fora produzia um `x: 1.4` que nenhuma
 * implementação de recorte sabe aplicar — e o resultado era um deslocamento
 * aleatório que o utilizador não conseguia repor.
 */
export function clampFocal(point: FocalPoint): FocalPoint {
  const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
  return { x: clamp(point.x), y: clamp(point.y) };
}

/**
 * Área efectivamente visível depois do recorte.
 *
 * O recorte nunca pode fechar a imagem: um `crop` com largura ou altura zero
 * faria o elemento desaparecer da página, e o utilizador perdia o texto que
 * estava a escrever à volta.
 */
export function visibleArea(crop: ImageTransform["crop"]): { width: number; height: number } {
  if (!crop) return { width: 1, height: 1 };
  const width = Math.max(0.05, 1 - crop.left - crop.right);
  const height = Math.max(0.05, 1 - crop.top - crop.bottom);
  return { width, height };
}

/* -------------------------------------------------------------------------- */
/* ACTIVO (item 20)                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Uma imagem da biblioteca.
 *
 * `url` é a chave no storage existente — não um caminho inventado. `origin` e
 * `provenance` (item 22) são o que responde a "de onde veio esta imagem" meses
 * depois, quando alguém se Pergunta se pode mostrar ao cliente.
 */
export type MediaAsset = {
  id: string;
  url: string;
  alt: string;
  category: MediaCategory;
  environment: MediaEnvironment;
  type: MediaType;
  origin: MediaOriginKind;
  /** Disciplina técnica, quando aplicável. */
  discipline: string | null;
  tags: string[];
  description: string;
  /** Projecto a que pertence; `null` na biblioteca geral do estúdio. */
  projectId: string | null;
  /** Cliente, só quando o MEDIA_SHARE_WITH_CLIENT permite. */
  clientId: string | null;
  capturedAt: string | null;
  createdAt: string;
};

/**
 * O registo de proveniência de uma imagem gerada (item 22).
 *
 * É obrigatório guardar o PROMPT e o MODELO. Uma imagem gerada sem prompt não
 * pode ser reproduzida, corrigida nem defendida numa reunião — e o cliente
 * pode perguntar o que está a ver.
 */
export type MediaProvenance = {
  model: string;
  prompt: string;
  /** `null` quando não houve imagem de referência (item 23). */
  referenceId: string | null;
  /** Descrição do que se pediu mudar na variação. */
  variationOf: string | null;
  proposalId: string | null;
  slideId: string | null;
};

/**
 * Uma imagem com a sua proveniência e o seu transform actual.
 *
 * Junta o que o storage tem (o activo) ao que a página tem (o ajuste). São
 * coisas diferentes: a imagem é partilhada entre páginas, o ajuste não.
 */
export type ResolvedMedia = {
  asset: MediaAsset;
  transform: ImageTransform;
  provenance: MediaProvenance | null;
};

/* -------------------------------------------------------------------------- */
/* ORDEM DE PREFERÊNCIA (itens 19 e 24)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ordem de preferência declarada no item 24.
 *
 * 1. imagens do projecto;
 *  2. imagens carregadas pelo utilizador;
 *  3. biblioteca ARQVERTICE;
 *  4. geração por IA.
 *
 * É uma função, e não um `sort` scattered pelos chamadores: o item 24 diz
 * "não gerar automaticamente se já existir uma imagem adequada", e essa regra
 * só é respeitável se existir UM sítio que a decide.
 */
export function rankFor(origin: MediaOriginKind): number {
  switch (origin) {
    case "project":
      return 0;
    case "upload":
    case "deck":
      return 1;
    case "library":
      return 2;
    default:
      // `ai` e `variacao` por último de propósito: mostrar ao cliente uma imagem
      // gerada quando existe uma fotografia real do projecto seria apresentar uma
      // ilusão como se fosse obra feita.
      return 3;
  }
}

export type MediaSuggestion = {
  asset: MediaAsset;
  /** 0 = melhor. */
  rank: number;
  /** Por que foi sugerida, para o editor poder explicar. */
  reasons: string[];
};

const normalize = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Sugere imagens para uma página (item 24).
 *
 * `allowGeneration` é explícito: o chamador tem de pedir a geração. Com
 * `false`, uma imagem gerada que já exista entra na lista mas fica marcada,
 * para que o ADMIN perceba que era essa a única opção.
 */
export function suggestMediaForSlide(input: {
  assets: readonly MediaAsset[];
  slide: { title: string; body: string; elements: readonly { kind: string }[] };
  context: { projectType?: string | null; discipline?: string | null; environment?: MediaEnvironment | null };
  allowGeneration?: boolean;
  limit?: number;
}): MediaSuggestion[] {
  const termos = normalize(`${input.slide.title} ${input.slide.body}`.split(/\W+/).join(" ")).split(/\s+/).filter(Boolean);
  const palavras = new Set(termos.filter((t) => t.length > 3));

  const scored = input.assets
    .filter((asset) => (asset.origin === "ai" || asset.origin === "variacao") ? Boolean(input.allowGeneration) : true)
    .map((asset) => {
      const reasons: string[] = [];
      let score = 0;

      if (asset.projectId && asset.origin === "project") {
        score += 40;
        reasons.push("É uma imagem deste projecto.");
      }
      if (asset.projectId && asset.origin !== "project") {
        score += 12;
        reasons.push("Está associada a este projecto.");
      }
      if (input.context.discipline && asset.discipline === input.context.discipline) {
        score += 18;
        reasons.push("É da mesma disciplina.");
      }
      if (input.context.environment && asset.environment === input.context.environment) {
        score += 14;
        reasons.push("Foi tirada no mesmo tipo de ambiente.");
      }

      const alvo = normalize(`${asset.description} ${asset.tags.join(" ")} ${asset.category}`);
      const intersecao = [...palavras].filter((p) => alvo.includes(p));
      if (intersecao.length > 0) {
        score += Math.min(24, intersecao.length * 6);
        reasons.push(`Combina com o texto da página (${intersecao.slice(0, 3).join(", ")}).`);
      }
      if (!asset.alt.trim()) {
        // Uma imagem sem descrição não é publicável; vale menos.
        score -= 10;
        reasons.push("Não tem descrição — a acessibilidade fica em falta.");
      }

      return { asset, rank: rankFor(asset.origin), score, reasons };
    })
    // A ordem de preferência do item 24 é PRIMÁRIA; a pontuação desempata.
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .filter((entry) => entry.score > 0);

  return scored.slice(0, input.limit ?? 12).map(({ asset, rank, reasons }) => ({ asset, rank, reasons }));
}

/* -------------------------------------------------------------------------- */
/* VALIDAÇÃO E PROVENIÊNCIA (itens 22 e 23)                                    */
/* -------------------------------------------------------------------------- */

/** Erro de conteúdo de media, para o editor mostrar junto ao campo. */
export class MediaContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaContentError";
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Lê um activo gravado, validando a taxonomia.
 *
 * Uma categoria desconhecida é um dado de outro momento: reduzi-la a
 * `referencia` mantém a imagem utilizável, em vez de a perder. Perder uma
 * fotografia de arquitectura por causa de um valor novo numa tabela seria
 * absurdamente caro.
 */
export function readMediaAsset(raw: unknown): MediaAsset | null {
  const value = asRecord(raw);
  const id = asText(value.id);
  const url = asText(value.url);
  if (!id || !url) return null;

  const category = asText(value.category) as MediaCategory;
  const environment = asText(value.environment) as MediaEnvironment;
  const origin = asText(value.origin) as MediaOriginKind;
  const type = asText(value.type) as MediaType;

  const origins: MediaOriginKind[] = ["upload", "project", "library", "deck", "ai", "variacao"];
  const types: MediaType[] = ["foto", "render", "desenho", "material"];

  return {
    id,
    url,
    alt: asText(value.alt),
    category: (MEDIA_CATEGORIES.includes(category) ? category : "referencia") as MediaCategory,
    environment: (MEDIA_ENVIRONMENTS.includes(environment) ? environment : "not-aplicavel") as MediaEnvironment,
    type: (types.includes(type) ? type : "foto") as MediaType,
    origin: (origins.includes(origin) ? origin : "upload") as MediaOriginKind,
    discipline: asText(value.discipline) || null,
    tags: Array.isArray(value.tags) ? value.tags.map(asText).filter(Boolean) : [],
    description: asText(value.description),
    projectId: asText(value.projectId) || null,
    // A política de partilha é aplicada no SERVIDOR; aqui o valor apenas
    // viaja, e um `clientId` só existe porque o servidor o conceded.
    clientId: asText(value.clientId) || null,
    capturedAt: asText(value.capturedAt) || null,
    createdAt: asText(value.createdAt) || new Date(0).toISOString(),
  };
}

/**
 * Prepara o registo de uma imagem gerada (item 22).
 *
 * O prompt é obrigatório e nunca é inventado a partir de um título: se o
 * utilizador não escreveu nada, a função recusa. Uma imagem gerada sem prompt
 * guardado não pode ser reproduzida nem defendida numa reunião.
 */
export function createGenerationRecord(input: {
  prompt: string;
  model: string;
  /** `null` quando não há imagem de referência (item 23). */
  referenceId?: string | null;
  variationOf?: string | null;
  proposalId?: string | null;
  slideId?: string | null;
}): MediaProvenance {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new MediaContentError(
      "Escreva o que pretende na imagem. Uma imagem gerada sem instrução não pode ser reproduzida depois.",
    );
  }
  if (!input.model.trim()) {
    throw new MediaContentError("Não foi indicado que serviço gerou a imagem.");
  }
  return {
    model: input.model.trim(),
    prompt,
    referenceId: input.referenceId?.trim() || null,
    variationOf: input.variationOf?.trim() || null,
    proposalId: input.proposalId ?? null,
    slideId: input.slideId ?? null,
  };
}

/**
 * Verifica que uma variação não vai substituir a imagem de referência
 * (item 23: "nunca sobrescrever a imagem original").
 *
 * A regra é estrutural, não uma recomendação: a variação tem sempre um id
 * novo e guarda `referenceId` a apontar para a original. Isto é o que torna
 * "usar esta imagem como referência" seguro — a original continua lá.
 */
export function assertVariationIsSeparate(original: MediaAsset, variation: MediaAsset): void {
  if (original.id === variation.id) {
    throw new MediaContentError("Uma variação tem de ser uma imagem nova, não a mesma imagem outra vez.");
  }
  if (variation.url === original.url) {
    throw new MediaContentError("A variação aponta para o mesmo ficheiro que a referência. Gere um ficheiro novo.");
  }
}
