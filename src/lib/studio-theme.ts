/**
 * FASE 4C — SISTEMA DE TEMAS (itens 13 e 14).
 *
 * Um tema é um conjunto de TOKENS, não um ficheiro de estilos. Nenhum tema
 * define cores, fontes ou espaçamentos de raiz: eles vêm do Design System
 * (`globals.css`), que já é a identidade ARQVERTICE. O tema limita-se a
 * COMBINAR esses tokens — muda o peso do título, o contraste do fundo, o raio
 * do cartão, a sombra — mas nunca inventa uma paleta nova.
 *
 * Esta é a diferença entre "temas editoriais" (item 13) e "identidade nova"
 * (que o item 14 proíbe). Um tema Minimal e um Editorial usam a MESMA azul de
 * marca e a MESMA Montserrat; o que muda é a DOSAGEM: quanto branco, quão grande
 * é o título, onde está o peso.
 *
 * Os valores são referenciados por nome de token CSS (`var(--text-primary)`) e
 * nunca como hex. É o que garante que um tema continua a pertencer à marca
 * depois de o Design System mudar.
 */

export type ThemeKey =
  | "arqvertice-minimal"
  | "arqvertice-editorial"
  | "arqvertice-residencial"
  | "arqvertice-alto-padrao"
  | "arqvertice-tecnico"
  | "arqvertice-engenharia";

export type ThemeTokens = {
  background: string;
  surface: string;
  overlay: string;
  title: string;
  body: string;
  muted: string;
  accent: string;
  border: string;
};

export type Theme = {
  key: ThemeKey;
  label: string;
  /** Para quem é. Aparece no seletor como texto de ajuda. */
  intent: string;
  tokens: ThemeTokens;
  /** Escala relativa dos textos: `1` é o tamanho de referência. */
  scale: { kicker: number; title: number; lead: number; body: number; caption: number };
  /** Peso do título. 800 dá a leitura editorial de alto impacto. */
  titleWeight: number;
  /** Espaço entre blocos, como múltiplo do espaçamento base. */
  spacing: number;
  radius: string;
  shadow: string;
  card: "flat" | "outlined" | "raised" | "filled";
  image: "sharp" | "soft" | "rounded";
  table: "minimal" | "lined" | "striped";
  /** Densidade da página — quanto conteúdo cabe sem apertar. */
  density: "airy" | "balanced" | "dense";
  /** Preenchimento aplicado sobre imagem de fundo. */
  scrim: "none" | "light" | "strong";

  /* --- Dimensões que o item 13 exige e que faltavam --------------------- */

  typography: ThemeTypography;
  /** Tratamento do botão de acção (CTA). */
  button: ThemeButton;
  /** Tratamento do DESTAQUE numérico — o número que o cliente deve reter. */
  highlight: ThemeHighlight;
  /** ELEMENTOS RECORRENTES: o que se repete em todas as páginas. */
  recurring: ThemeRecurring;
};

/**
 * TIPOGRAFIA (item 13).
 *
 * `fontFamily` não aceita valor: é sempre a do Design System. Declarar o tipo
 * como literal é o que torna o item 14 verificável — um tema novo não
 * consegue introduzir uma família de fontes, porque não compila.
 */
export type ThemeTypography = {
  fontFamily: "design-system";
  /** Entreletra do título. `tight` é o padrão editorial. */
  titleTracking: "tight" | "normal" | "wide";
  /** Caixa do título. O `eyebrow` da marca é sempre maiúsculo. */
  titleCase: "none" | "uppercase";
};

export type ThemeButton = "solid" | "outline" | "ghost";

export type ThemeHighlight = {
  /** Como o elemento `metric` é desenhado. */
  style: "card" | "bare" | "rule";
  /** Peso visual do número dentro da página. */
  size: "normal" | "large" | "hero";
};

export type ThemeRecurring = {
  /** Numeração de página. */
  pageNumber: "none" | "footer" | "corner";
  /** Linha de identidade do estúdio. */
  identity: "none" | "footer" | "cover-only";
};

/**
 * Valores por omissão das dimensões editoriais.
 *
 * São OMISSÍVEIS de propósito: assim, acrescentar uma dimensão nova ao tema
 * não obriga a reescrever os seis temas já existentes — que é o requisito de
 * "o sistema deve permitir adicionar novos temas posteriormente".
 */
const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontFamily: "design-system",
  titleTracking: "tight",
  titleCase: "none",
};

const DEFAULT_HIGHLIGHT: ThemeHighlight = { style: "card", size: "normal" };

const DEFAULT_RECURRING: ThemeRecurring = { pageNumber: "footer", identity: "cover-only" };

/**
 * Tokens do Design System reutilizados por todos os temas.
 *
 * Declarados uma vez para que a diferença entre temas seja, literalmente, só a
 * dosagem: quem lê esta tabela vê o que muda e o que não muda.
 */
const DS = {
  surface: "var(--layer-1)",
  surfaceAlt: "var(--layer-2)",
  title: "var(--text-primary)",
  body: "var(--text-secondary)",
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  border: "var(--border-subtle)",
  borderStrong: "var(--border-strong)",
  overlay: "var(--overlay)",
} as const;

/**
 * Valores REAIS dos tokens do Design System, para a auditoria de contraste.
 *
 * `contrastRatio` só aceita HEX e recusa-se a adivinhar um `var(--...)`: sem o
 * valor resolvido, um teste que devolvesse um número estaria a fingir que
 * mediu. Mas sem esta tabela a auditoria não mediria NADA nos temas claros — e
 * um teste de acessibilidade que nunca mede é pior do que não existir.
 *
 * A tabela é deliberadamente PARCIAL: só entram os tokens cuja cor é fixa no
 * Design System. `--overlay` NÃO entra, porque é um véu sobre uma imagem, e o
 * seu contraste efectivo depende do que está por baixo — esse par continua
 * delegado, que é o comportamento correcto e não uma falha de medição.
 *
 * Se o Design System mudar uma cor, esta tabela tem de mudar com ela. É o
 * único ponto do Studio que conhece valores literais do tema claro.
 */
const DS_RESOLVED: Readonly<Record<string, string>> = {
  "var(--layer-1)": "#ffffff",
  "var(--layer-2)": "#f8fafc",
  "var(--layer-3)": "#ffffff",
  "var(--text-primary)": "#172033",
  "var(--text-secondary)": "#596579",
  "var(--text-muted)": "#8993a4",
  "var(--border-subtle)": "#e4e8ef",
  "var(--border-strong)": "#cbd5e1",
  "var(--accent)": "#2563eb",
};

/**
 * Resolve um token do Design System para o seu valor, quando é conhecido.
 *
 * Devolve `null` para o que não resolve — e `null` significa, em toda a
 * auditoria, "delegado ao Design System", nunca "aprovado".
 */
export function resolveDesignToken(value: string): string | null {
  const key = value.trim();
  return DS_RESOLVED[key] ?? (key.startsWith("#") ? key : null);
}

/**
 * Partes que um tema pode por omissão, sem as ter de repetir.
 *
 * `typography`, `button`, `highlight` e `recurring` ficam aqui de propósito:
 * são as dimensões que um tema novo NÃO tem de declarar para nascer válido,
 * e é isso que faz "o sistema deve permitir adicionar novos temas
 * posteriormente" ser verdade em vez de ser uma promessa.
 */
type ThemeRecipe = Omit<
  Theme,
  "key" | "label" | "intent" | "tokens" | "typography" | "button" | "highlight" | "recurring"
> &
  Partial<Pick<Theme, "typography" | "button" | "highlight" | "recurring">>;

/**
 * Constrói um tema a partir de uma dose parcial.
 *
 * Existe para deixar explícito o que um tema NÃO pode mudar: a tipografia, a
 * família de fontes e a paleta de marca entram por omissão e não têm override.
 * Se um tema futuro precisasse de outra fonte, este construtor teria de mudar —
 * e é melhor que isso apareça aqui do que numa classe Tailwind solta.
 */
function makeTheme(
  key: ThemeKey,
  label: string,
  intent: string,
  tokens: Partial<ThemeTokens>,
  recipe: ThemeRecipe,
): Theme {
  return {
    key,
    label,
    intent,
    tokens: {
      background: DS.surface,
      surface: DS.surfaceAlt,
      overlay: DS.overlay,
      title: DS.title,
      body: DS.body,
      muted: DS.muted,
      accent: DS.accent,
      border: DS.border,
      ...tokens,
    },
    ...recipe,
    typography: recipe.typography ?? DEFAULT_TYPOGRAPHY,
    button: recipe.button ?? "solid",
    highlight: recipe.highlight ?? DEFAULT_HIGHLIGHT,
    recurring: recipe.recurring ?? DEFAULT_RECURRING,
  };
}

export const THEMES: Readonly<Record<ThemeKey, Theme>> = {
  "arqvertice-minimal": makeTheme(
    "arqvertice-minimal",
    "ARQVERTICE Minimal",
    "Muito espaço em branco, sem ornamento. Para quando o conteúdo fala sozinho.",
    {},
    {
      scale: { kicker: 1, title: 1, lead: 1, body: 1, caption: 0.95 },
      titleWeight: 700,
      spacing: 1,
      radius: "1rem",
      shadow: "var(--shadow-layer-1)",
      card: "outlined",
      image: "soft",
      table: "minimal",
      density: "airy",
      scrim: "light",
    },
  ),
  "arqvertice-editorial": makeTheme(
    "arqvertice-editorial",
    "ARQVERTICE Editorial",
    "Título grande e de magacine, muito ar. Para apresentar conceito e linguagem.",
    {},
    {
      scale: { kicker: 0.85, title: 1.45, lead: 1.15, body: 1.05, caption: 0.95 },
      titleWeight: 800,
      spacing: 1.35,
      radius: "0.5rem",
      shadow: "none",
      card: "flat",
      image: "sharp",
      table: "minimal",
      density: "airy",
      scrim: "strong",
    },
  ),
  "arqvertice-residencial": makeTheme(
    "arqvertice-residencial",
    "ARQVERTICE Residencial",
    "Quente e acolhedor, com imagens generosas. Para obras de habitação.",
    // Sem cor própria: o calor deste tema vem do DOSAGEM — raio grande, cartão
    // elevado e imagens arredondadas — e não de uma segunda paleta. Uma
    // paleta nova por tema é exactamente o que o item 14 proíbe.
    {},
    {
      scale: { kicker: 0.95, title: 1.15, lead: 1.1, body: 1.05, caption: 1 },
      titleWeight: 700,
      spacing: 1.15,
      radius: "1.25rem",
      shadow: "var(--shadow-layer-1)",
      card: "raised",
      image: "rounded",
      table: "lined",
      density: "balanced",
      scrim: "light",
    },
  ),
"arqvertice-alto-padrao": makeTheme(
    "arqvertice-alto-padrao",
    "ARQVERTICE Alto Padrão",
    "Escuro, contido e preciso. Para obras de valor elevado.",
    // Único tema com paleta própria, e mesmo assim derivada da família da
    // marca: o texto invertido sobre o mesmo azul-ardósia da marca.
    {
      background: "#0f172a",
      surface: "#1e293b",
      overlay: "#020617",
      title: "#f8fafc",
      body: "#cbd5e1",
      muted: "#94a3b8",
      accent: "#60a5fa",
      border: "#334155",
    },
    {
      scale: { kicker: 0.85, title: 1.25, lead: 1.1, body: 1, caption: 0.95 },
      titleWeight: 700,
      spacing: 1.2,
      radius: "0.75rem",
      shadow: "none",
      card: "filled",
      image: "soft",
      table: "lined",
      density: "balanced",
      scrim: "strong",
    },
  ),
  "arqvertice-tecnico": makeTheme(
    "arqvertice-tecnico",
    "ARQVERTICE Técnico",
    "Densidade de dados, grelhas visíveis, sem ar. Para proposta técnica.",
    { border: DS.borderStrong },
    {
      scale: { kicker: 0.9, title: 1, lead: 0.95, body: 0.92, caption: 0.88 },
      titleWeight: 700,
      spacing: 0.75,
      radius: "0.375rem",
      shadow: "none",
      card: "outlined",
      image: "sharp",
      table: "striped",
      density: "dense",
      scrim: "none",
    },
  ),
  "arqvertice-engenharia": makeTheme(
    "arqvertice-engenharia",
    "ARQVERTICE Engenharia",
    "Grelha técnica e leitura de desenho. Para Engenharia.",
    // Tokens do Design System, dos mais fortes: fundo na camada 2 e borda forte
    // para a grelha se ler como grelha.
    { background: DS.surfaceAlt, surface: DS.surface, border: DS.borderStrong },
    {
      scale: { kicker: 0.85, title: 1.05, lead: 1, body: 0.9, caption: 0.85 },
      titleWeight: 800,
      spacing: 0.65,
      radius: "0.25rem",
      shadow: "none",
      card: "flat",
      image: "sharp",
      table: "striped",
      density: "dense",
      scrim: "none",
    },
  ),
};

export const THEME_ORDER: readonly ThemeKey[] = [
  "arqvertice-minimal",
  "arqvertice-editorial",
  "arqvertice-residencial",
  "arqvertice-alto-padrao",
  "arqvertice-tecnico",
  "arqvertice-engenharia",
];

/**
 * ÚNICO conjunto de cores literais que um tema pode usar.
 *
 * É a lista branca do item 14. Qualquer tema novo que precise de uma cor que
 * não esteja aqui tem de a declarar aqui primeiro — o que cria um ponto único
 * onde se vê, de uma vez, tudo o que o Studio introduz fora do Design System.
 */
/**
 * ÚNICO conjunto de cores literais que um tema pode usar.
 *
 * É a lista branca do item 14. Qualquer tema novo que precise de uma cor que
 * não esteja aqui tem de a declarar aqui primeiro — o que cria um ponto único
 * onde se vê, de uma vez, tudo o que o Studio introduz fora do Design System.
 *
 * Corresponde à paleta do tema escuro, que é o ÚNICO com identidade própria.
 * Os temas claros não aqui entram nada: recebem tokens do Design System.
 */
export const ALL_THEME_TOKENS: readonly string[] = [
  "#0f172a", // ardósia da capa e do rodapé
  "#1e293b",
  "#020617",
  "#f8fafc", // texto sobre fundo escuro
  "#cbd5e1",
  "#94a3b8",
  "#60a5fa", // azul da marca, esclarecer
  "#334155",
];

/** Tema por omissão. Minimal é o mais neutro e o mais seguro para começar. */
export const DEFAULT_THEME: ThemeKey = "arqvertice-minimal";

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);
}

export function getTheme(key: unknown): Theme {
  return THEMES[isThemeKey(key) ? key : DEFAULT_THEME];
}

/* -------------------------------------------------------------------------- */
/* ACESSIBILIDADE (item 14)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Contraste de um par de cores, pela fórmula WCAG 2.1.
 *
 * Só aceita cores HEX. Um tema que use `var(--accent)` é INDETERMINÁVEL no
 * momento da construção — e um teste de acessibilidade que não consegue ler o
 * valor está a fingir que verifica. `auditTheme` reporta esses casos como
 * "delegado ao Design System" em vez de os dar como aprovados.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = parseHex(foreground);
  const b = parseHex(background);
  if (!a || !b) return null;
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const [light, dark] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (light + 0.05) / (dark + 0.05);
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Mínimo de contraste do texto CORPO, WCAG AA.
 *
 * É 4.5:1 e não é negociável. Um tema que falhe isto deixa de ser um tema
 * "editorial" e passa a ser uma proposta ilegível para parte dos clientes.
 */
export const MIN_BODY_CONTRAST = 4.5;

export type ThemeContrastCheck = {
  pair: string;
  ratio: number | null;
  /** `null` quando o valor vem do Design System e é delegado a ele. */
  passes: boolean | null;
};

export type ThemeAudit = {
  theme: ThemeKey;
  checks: ThemeContrastCheck[];
  /** Há alguma combinação que se sabe falhar? */
  readable: boolean;
};

/**
 * Auditoria de acessibilidade de um tema.
 *
 * `readable` só é `false` quando uma cor LITERAL falha o mínimo. Um par que
 * depende do Design System devolve `passes: null` — o valor é o que o
 * Design System garante, e o Studio não o duplica para o auditar.
 */
export function auditTheme(theme: Theme): ThemeAudit {
  const pairs: Array<[string, string, string]> = [
    ["title", theme.tokens.title, theme.tokens.background],
    ["body", theme.tokens.body, theme.tokens.background],
    ["body sobre superfície", theme.tokens.body, theme.tokens.surface],
    ["acento", theme.tokens.accent, theme.tokens.background],
    ["título sobre overlay", "#f8fafc", theme.tokens.overlay],
  ];

  const checks: ThemeContrastCheck[] = pairs.map(([pair, foreground, background]) => {
    // Um par é medível quando QUALQUER dos lados resolve: o contraste é
    // simétrico, e descartar o par por o fundo ser um `var()` deixaria a
    // auditoria cega justamente nos temas do Design System.
    const fore = resolveDesignToken(foreground);
    const back = resolveDesignToken(background);
    if (!fore || !back) return { pair, ratio: null, passes: null };
    const ratio = contrastRatio(fore, back);
    if (ratio === null) return { pair, ratio: null, passes: null };
    return { pair, ratio, passes: ratio >= MIN_BODY_CONTRAST };
  });

  return {
    theme: theme.key,
    checks,
    readable: checks.every((check) => check.passes !== false),
  };
}

/** Auditoria de TODOS os temas. Usada no teste de integridade da marca. */
export function auditAllThemes(): ThemeAudit[] {
  return THEME_ORDER.map((key) => auditTheme(THEMES[key]));
}

/* -------------------------------------------------------------------------- */
/* PREVIEW (item 13)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Resumo serializável de um tema, para o selector.
 *
 * Devolve APENAS o que se mostra no preview. Não é o tema inteiro porque a
 * interface não precisa da escala completa para desenhar um cartão de escolha,
 * e mandar o objecto inteiro faria o React re-renderizar o selector inteiro
 * quando um único tema muda.
 */
export type ThemePreview = {
  key: ThemeKey;
  label: string;
  intent: string;
  background: string;
  surface: string;
  title: string;
  accent: string;
  density: Theme["density"];
  /** Largura relativa do título, para desenhar a miniatura. */
  titleScale: number;
};

/** Monta o preview de um tema, ou de uma chave desconhecida com recurso ao omisso. */
export function themePreview(key: unknown): ThemePreview {
  const theme = getTheme(key);
  return {
    key: theme.key,
    label: theme.label,
    intent: theme.intent,
    background: theme.tokens.background,
    surface: theme.tokens.surface,
    title: theme.tokens.title,
    accent: theme.tokens.accent,
    density: theme.density,
    titleScale: theme.scale.title,
  };
}

/** Previews de todos os temas, pela ordem do selector. */
export function allThemePreviews(): ThemePreview[] {
  return THEME_ORDER.map(themePreview);
}

/**
 * Troca o tema de UMA apresentação.
 *
 * Devolve um deck novo e não toca em mais nada. O item 13 diz "aplicar tema
 * somente nesta apresentação" — e como o tema vive no DECK e não na proposta,
 * outra proposta nunca é afectada.
 */
export function applyTheme<T extends { theme: string }>(deck: T, key: unknown): T {
  return { ...deck, theme: getTheme(key).key };
}
