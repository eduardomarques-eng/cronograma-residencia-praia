/**
 * FASE 4C — O DECK DO STUDIO (itens 9 a 19).
 *
 * Este módulo é o CONTRATO da apresentação, na mesma linha em que
 * `proposal-item.ts` é o contrato das linhas comerciais. A apresentação não é
 * uma imagem nem uma lista de parágrafos: é uma lista de PÁGINAS, cada uma com
 * um LAYOUT e um conjunto de ELEMENTOS.
 *
 * Três decisões estruturais, e a razão de cada uma:
 *
 *  1. **Compatibilidade com o que já existe.** O `ProposalVersion.presentation`
 *     guarda hoje `{ slides: [{ title, body }] }`. O DTO público, o PDF e o
 *     `ProposalPresentation` leem exactamente `title` e `body`. Se este módulo
 *     deixasse de os escrever, uma proposta antiga deixaria de ser legível
 *     para o cliente. Por isso `toPersistedDeck` SEMPRE volta a achatar o título
 *     e o corpo ao nível da página: o modelo rico é para o editor, os campos
 *     planos são para quem lê.
 *
 *  2. **O deck NUNCA guarda valores comerciais inventados.** Um `metric`
 *     (destaque numérico) só é aceite se o servidor tiver fornecido o valor. A
 *     regra é verificada por `assertNoCommercialInvented`, não apenas
 *     documentada num prompt que ninguém audita.
 *
 *  3. **Determinismo.** Nenhuma função deste módulo sorteia, usa relógio ou
 *     consome `Math.random`. O mesmo deck e o mesmo comando produzem sempre o
 *     mesmo resultado — sem isso, um "desfazer" não desfaz e um teste não
 *     fixa. Os ids são derivados do conteúdo, não gerados.
 */

import { resolveLayout, type LayoutKey } from "./studio-layout";
import {
  assertBindingIsHonest,
  isCommercialBinding,
  type CommercialBinding,
} from "./studio-commercial";

/**
 * De onde veio a imagem (item 19).
 *
 * A origem é persistida porque responde a duas perguntas que o cliente faz e
 * que um URL sozinho não responde: "é imagem do projecto?" e "isto foi gerado
 * por IA?". Uma imagem gerada por IA é materialmente diferente de uma
 * fotografia do projecto real, e essa diferença tem de ser visível.
 */
export type MediaOrigin = "upload" | "project" | "library" | "deck" | "ai";

export type ImageRef = { url: string; alt?: string | null; source: MediaOrigin };

/** Papéis de texto. O papel decide escala e peso — é a hierarquia, sem CSS à mão. */
export type TextRole = "kicker" | "title" | "lead" | "body" | "caption";

export type TextElement = { kind: "text"; id: string; role: TextRole; text: string };

export type ImageFit = "cover" | "contain";

export type ImageElement = {
  kind: "image";
  id: string;
  url: string;
  alt: string;
  fit: ImageFit;
  /** `true` quando a imagem serve de fundo da página. */
  background: boolean;
  source: MediaOrigin;
};

export type GalleryElement = {
  kind: "gallery";
  id: string;
  images: Array<{ url: string; alt: string; source: MediaOrigin }>;
};

export type CardItem = { title: string; body: string; image: ImageRef | null };

export type CardsElement = {
  kind: "cards";
  id: string;
  items: CardItem[];
  /** `asymmetric` distribui larguras em vez de colunas iguais. */
  variant: "grid" | "asymmetric" | "stacked";
};

export type MetricElement = {
  kind: "metric";
  id: string;
  label: string;
  /**
   * Valor EXIBIDO. Vem do servidor (a `ProposalVersion`), nunca escrito livre.
   * É o que impede a IA de inventar um preço num destaque.
   */
  value: string;
  hint: string | null;
};

export type CtaElement = { kind: "cta"; id: string; title: string; body: string; action: string };

/**
 * Campos que uma tabela, um cronograma ou um comparativo LIGADO transportam.
 *
 * Não é herencia: os três elementos genuinely podem mostrar dados comerciais
 * (itens 26 a 30) e o resto do conteúdo continua a ser do autor. Ao pôr o
 * `binding` nos TRÊS em vez de criar três tipos novos, a regra de "este
 * elemento tem um número" é uma só, verificada num só sítio.
 */
type Bindable = {
  /**
   * Fonte comercial de que este elemento se alimenta.
   *
   * `null` significa conteúdo do autor — uma tabela de acabamentos, um
   * comparativo de materiais. Não é erro: é o caso comum.
   */
  binding: CommercialBinding | null;
};

/**
 * Tabela (item 26).
 *
 * Quando `binding` está preenchido, `columns` e `rows` são IGNORADOS na
 * apresentação: as linhas vêm de `resolveBinding`. Guardá-las seria ter duas
 * fontes para o mesmo número, e `assertBindingIsHonest` recusa isso.
 */
export type TableElement = Bindable & {
  kind: "table";
  id: string;
  columns: string[];
  rows: string[][];
};

/** Cronograma (item 28). Vinculado, as etapas vêm de `boundSchedule`. */
export type TimelineElement = Bindable & {
  kind: "timeline";
  id: string;
  steps: Array<{ label: string; title: string; body: string }>;
};

/** Comparativo (item 27). Vinculado, os lados vêm de `boundOptions`. */
export type ComparisonElement = Bindable & {
  kind: "comparison";
  id: string;
  sides: Array<{ title: string; items: string[]; highlight: boolean }>;
};

export type StudioElement =
  | TextElement
  | ImageElement
  | GalleryElement
  | CardsElement
  | TableElement
  | TimelineElement
  | ComparisonElement
  | MetricElement
  | CtaElement;

export type StudioElementKind = StudioElement["kind"];

/** Slot equivalente de um elemento, para o registo de layouts. */
export type SlotKind = StudioElementKind;

/**
 * Erro de conteúdo do Studio.
/* -------------------------------------------------------------------------- */
/* PÁGINAS                                                                     */
/* -------------------------------------------------------------------------- */

export type StudioSlide = {
  id: string;
  layout: LayoutKey;
  /** Rótulo curto acima do título. */
  eyebrow: string;
  title: string;
  /** Corpo principal — espelhado no formato antigo, para o DTO e o PDF. */
  body: string;
  elements: StudioElement[];
  /** Página escondida: some da apresentação pública, não do editor. */
  hidden: boolean;
  /** Notas do autor. Nunca publicadas. */
  notes: string;
};

export type DeckOrigin = { proposalId: string; version: number; label: string };

export type StudioDeck = {
  theme: string;
  slides: StudioSlide[];
  /**
   * Origem, quando a apresentação nasceu de outra (item 12, Remix).
   *
   * `null` numa apresentação criada de raiz. Num Remix aponta para a
   * apresentação de origem — e nunca é apagada, porque é o rasto de que esta
   * variação nasceu.
   */
  origin: DeckOrigin | null;
};

/* -------------------------------------------------------------------------- */
/* NORMALIZAÇÃO                                                                */
/* -------------------------------------------------------------------------- */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Texto limpo, ou string vazia. Nunca `undefined` a persistir. */
const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const bool = (value: unknown): boolean => value === true;

/**
 * Id ESTÁVEL, derivado do conteúdo.
 *
 * Um id aleatório faria com que o mesmo deck tivesse nomes diferentes a cada
 * leitura — e o cursor de selecção, o desfazer e o histórico deixariam de
 * funcionar. A derivação é determinística por construção.
 */
export function stableId(prefix: string, ...parts: Array<string | number>): string {
  const base = parts
    .join("|")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${prefix}_${base || "x"}`;
}

const MEDIA_ORIGINS: MediaOrigin[] = ["upload", "project", "library", "deck", "ai"];

function normalizeImageRef(raw: unknown): ImageRef | null {
  const value = asRecord(raw);
  const url = text(value.url);
  if (!url) return null;
  const source = text(value.source);
  return {
    url,
    alt: text(value.alt) || null,
    source: (MEDIA_ORIGINS.includes(source as MediaOrigin) ? source : "upload") as MediaOrigin,
  };
}

/**
 * Normaliza um elemento gravado.
 *
 * Um elemento irrecuperável é OMITIDO, nunca guardado a meio: um `metric` sem
 * valor ou uma comparação com um só lado não se corrigem sozinhos no ecrã —
 * vazios e obrigavam o ADMIN a apagar à mão.
 */
function normalizeElement(raw: unknown, index: number): StudioElement | null {
  const value = asRecord(raw);
  switch (text(value.kind)) {
    case "text": {
      const role = text(value.role);
      const roles: TextRole[] = ["kicker", "title", "lead", "body", "caption"];
      return {
        kind: "text",
        id: text(value.id) || stableId("el", "text", index, text(value.text).slice(0, 24)),
        role: (roles.includes(role as TextRole) ? role : "body") as TextRole,
        text: text(value.text),
      };
    }
    case "image": {
      const image = normalizeImageRef(value);
      if (!image) return null;
      return {
        kind: "image",
        id: text(value.id) || stableId("el", "image", image.url),
        url: image.url,
        alt: text(value.alt) || image.alt || "",
        fit: text(value.fit) === "contain" ? "contain" : "cover",
        background: bool(value.background),
        source: image.source,
      };
    }
    case "gallery": {
      const images = (Array.isArray(value.images) ? value.images : [])
        .map(normalizeImageRef)
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .map((entry) => ({ url: entry.url, alt: entry.alt ?? "", source: entry.source }));
      if (images.length === 0) return null;
      return { kind: "gallery", id: text(value.id) || stableId("el", "gallery", index), images };
    }
    case "cards": {
      const items = (Array.isArray(value.items) ? value.items : [])
        .map((entry) => {
          const item = asRecord(entry);
          return { title: text(item.title), body: text(item.body), image: normalizeImageRef(item.image) };
        })
        .filter((item) => item.title || item.body);
      if (items.length === 0) return null;
      const variant = text(value.variant);
      return {
        kind: "cards",
        id: text(value.id) || stableId("el", "cards", index, items.length),
        items,
        variant: (["grid", "asymmetric", "stacked"].includes(variant) ? variant : "grid") as CardsElement["variant"],
      };
    }
    case "table": {
      const binding = isCommercialBinding(value.binding) ? value.binding : null;
      // Uma tabela ligada guarda a FONTE, não as linhas. Ler as linhas gravadas
      // aqui seria aceitar que uma tabela de investimento sobrevive com números
      // escritos à mão depois de a proposta mudar — que é o defeito do item 26.
      const columns = binding ? [] : (Array.isArray(value.columns) ? value.columns : []).map(text).filter(Boolean);
      const rows = binding
        ? []
        : (Array.isArray(value.rows) ? value.rows : [])
            .map((row) => (Array.isArray(row) ? row.map(text) : []))
            .filter((row) => row.length > 0);
      // Ligada e vazia é VÁLIDA: a apresentação resolve as linhas no servidor, e
      // uma proposta ainda por preencher tem de poder mostrar a estrutura certa.
      if (!binding && (columns.length === 0 || rows.length === 0)) return null;
      return {
        kind: "table",
        id: text(value.id) || stableId("el", "table", index, binding ?? columns.length),
        columns,
        rows,
        binding,
      };
    }
    case "timeline": {
      const binding = isCommercialBinding(value.binding) ? value.binding : null;
      const steps = (Array.isArray(value.steps) ? value.steps : [])
        .map((entry) => {
          const step = asRecord(entry);
          return { label: text(step.label), title: text(step.title), body: text(step.body) };
        })
        .filter((step) => step.title || step.body);
      if (!binding && steps.length === 0) return null;
      return {
        kind: "timeline",
        id: text(value.id) || stableId("el", "timeline", index, binding ?? steps.length),
        steps,
        binding,
      };
    }
    case "comparison": {
      const binding = isCommercialBinding(value.binding) ? value.binding : null;
      const sides = (Array.isArray(value.sides) ? value.sides : [])
        .map((entry) => {
          const side = asRecord(entry);
          return {
            title: text(side.title),
            items: (Array.isArray(side.items) ? side.items : []).map(text).filter(Boolean),
            highlight: bool(side.highlight),
          };
        })
        .filter((side) => side.title || side.items.length > 0);
      // Um comparativo com um só lado não compara: mostraria um vazio.
      if (!binding && sides.length < 2) return null;
      return {
        kind: "comparison",
        id: text(value.id) || stableId("el", "comparison", index, binding ?? sides.length),
        sides,
        binding,
      };
    }
    case "metric": {
      const label = text(value.label);
      const valueText = text(value.value);
      // Sem valor não há destaque: um cartão vazio ocupa espaço e não informa.
      if (!valueText || !label) return null;
      return {
        kind: "metric",
        id: text(value.id) || stableId("el", "metric", label, valueText),
        label,
        value: valueText,
        hint: text(value.hint) || null,
      };
    }
    case "cta": {
      const title = text(value.title);
      const action = text(value.action);
      // Sem acção, um CTA é um título decorativo: não pede nada ao cliente.
      if (!title || !action) return null;
      return {
        kind: "cta",
        id: text(value.id) || stableId("el", "cta", title),
        title,
        body: text(value.body),
        action,
      };
    }
    default:
      return null;
  }
}

/**
 * Lê a apresentação gravada e devolve um deck.
 *
 * `readStudioDeck` é o ÚNICO ponto de entrada do deck no sistema. Aceita o
 * formato novo e o antigo, e nunca lança: uma apresentação corrompida devolve
 * um deck vazio em vez de partir a página do cliente. É preferível mostrar
 * "sem páginas" a mostrar um erro 500 numa proposta já enviada.
 */
export function readStudioDeck(raw: unknown): StudioDeck {
  const value = asRecord(raw);
  const rawSlides = Array.isArray(value.slides) ? value.slides : [];
  const slides: StudioSlide[] = [];

  rawSlides.forEach((entry, index) => {
    const slide = asRecord(entry);
    const title = text(slide.title);
    const body = text(slide.body);
    const elements = (Array.isArray(slide.elements) ? slide.elements : [])
      .map((element, elementIndex) => normalizeElement(element, elementIndex))
      .filter((element): element is StudioElement => element !== null);

    // Uma página sem título, corpo ou elementos não é publicável: o DTO público
    // filtrá-la-ia na mesma, e guardá-la aqui só faria o editor mostrar um
    // vazio que o ADMIN teria de apagar à mão.
    if (!title && !body && elements.length === 0) return;

    slides.push({
      id: text(slide.id) || stableId("slide", index, title.slice(0, 24), body.slice(0, 24)),
      layout: resolveLayout(slide.layout),
      eyebrow: text(slide.eyebrow),
      title,
      body,
      elements,
      hidden: bool(slide.hidden),
      notes: text(slide.notes),
    });
  });

  const origin = asRecord(value.origin);
  const theme = text(value.theme);

  return {
    theme: theme || "arqvertice-minimal",
    slides,
    origin: text(origin.proposalId)
      ? {
          proposalId: text(origin.proposalId),
          version: Number(origin.version) || 1,
          label: text(origin.label) || "Apresentação de origem",
        }
      : null,
  };
}

/**
 * Prepara o deck para gravar em `ProposalVersion.presentation`.
 *
 * `title` e `body` são SEMPRE escritos ao nível da página. É isso que mantém o
 * DTO público, o PDF e a página do cliente a lerem a proposta sem uma linha de
 * código nova. Um modelo rico só pode ser adoptado se não quebrar quem já lê.
 */
export function toPersistedDeck(deck: StudioDeck): Record<string, unknown> {
  return {
    theme: deck.theme,
    origin: deck.origin,
    slides: deck.slides.map((slide) => ({
      id: slide.id,
      layout: slide.layout,
      eyebrow: slide.eyebrow,
      title: slide.title,
      body: slide.body,
      elements: slide.elements,
      hidden: slide.hidden,
      notes: slide.notes,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* GUARDA ANTI-INVENÇÃO                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Erro de conteúdo do Studio.
 *
 * Tem nome próprio para o editor distinguir "a IA tentou inventar um preço"
 * (mostrar junto ao comando, com o campo a corrigir) de "o servidor falhou"
 * (erro de sistema). Uma `instanceof` resolve os dois sem parsing de mensagem.
 */
export class StudioContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioContentError";
  }
}

/**
 * Números que não podem aparecer escritos à mão num destaque.
 *
 * A regra comercial da fase é literal: a IA não inventa preço, total, área,
 * prazo ou condição. Este é o ponto do Studio onde essa regra é VERIFICÁVEL —
 * em vez de ser uma instrução dentro de um prompt, que ninguém audita depois.
 */
const MONEY_PATTERN = /(?:r\$\s*\d|€\s*\d|\d[\d.]*\s*(?:reais|euros|eur|usd))/i;

/** Rótulo normalizado -> valor que o servidor autoriza mostrar. */
export type CommercialSlots = Readonly<Record<string, string>>;

const normalizeLabel = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Recusa destaques cujo valor não foi confirmado pela versão da proposta.
 *
 * `provided` são os rótulo->valor que a `ProposalVersion` autoriza a mostrar.
 * Um destaque com rótulo desconhecido é recusado; e mesmo com rótulo correcto,
 * um valor monetário diferente do autorizado também — porque um rótulo certo
 * com número inventado é o pior caso: passa a validação do rótulo e mente na
 * mesma.
 */
export function assertNoCommercialInvented(deck: StudioDeck, provided: CommercialSlots = {}): void {
  const unknown: string[] = [];
  const authorized = new Map(
    Object.entries(provided).map(([label, value]) => [normalizeLabel(label), value] as const),
  );

  deck.slides.forEach((slide) => {
    slide.elements.forEach((element) => {
      /*
       * Um elemento LIGADO tem duas fontes para o mesmo número: a que o
       * servidor resolve e a que o autor escreveu. Recusar aqui — e não só no
       * painel — é o que garante que a recusa não se pode contornar por um
       * comando de IA que construa o elemento já com linhas.
       *
       * O erro é TRADUZIDO para `StudioContentError`: o editor só conhece este
       * tipo, e é ele que distingue "isto corrige-se aqui" de "o servidor
       * falhou". Deixar a excepção da ligação escapar faria uma falha de conteúdo
       * aparecer ao ADMIN como erro de sistema.
       */
      try {
        assertBindingIsHonest(element as { binding?: CommercialBinding | null });
      } catch (error) {
        throw new StudioContentError(
          error instanceof Error ? error.message : "Elemento comercial inválido.",
        );
      }

      if (element.kind !== "metric") return;
      const expected = authorized.get(normalizeLabel(element.label));
      if (expected === undefined) {
        unknown.push(element.label);
        return;
      }
      if (expected.trim() !== element.value.trim() && MONEY_PATTERN.test(element.value)) {
        unknown.push(`${element.label} = ${element.value}`);
      }
    });
  });

  if (unknown.length > 0) {
    throw new StudioContentError(
      `Valor comercial não confirmado pela versão da proposta: ${unknown.join(", ")}. ` +
        "Destaques com valores são preenchidos pelo servidor, não escritos à mão.",
    );
  }
}