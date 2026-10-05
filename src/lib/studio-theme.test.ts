import { describe, expect, it } from "vitest";
import {
  ALL_THEME_TOKENS,
  auditAllThemes,
  auditTheme,
  contrastRatio,
  DEFAULT_THEME,
  getTheme,
  isThemeKey,
  MIN_BODY_CONTRAST,
  THEME_ORDER,
  themePreview,
  applyTheme,
} from "./studio-theme";

/**
 * FASE 4C — temas (item 13) e identidade ARQVERTICE (item 14).
 *
 * O item 14 é uma regra de NEGAÇÃO ("não substituir o Design System", "não
 * incluir marca de terceiros"). Regras de negação não se provam a olho: por
 * isso são testes que varrem o catálogo e falham se alguém escrever um hex
 * arbitrário ou escrever o nome de uma marca de terceiro.
 */
describe("catálogo de temas (item 13)", () => {
  it("tem os seis temas pedidos e nenhum a mais", () => {
    // "Não criar dezenas sem necessidade": seis é o número pedido.
    expect(THEME_ORDER).toEqual([
      "arqvertice-minimal",
      "arqvertice-editorial",
      "arqvertice-residencial",
      "arqvertice-alto-padrao",
      "arqvertice-tecnico",
      "arqvertice-engenharia",
    ]);
  });

  it("todos os temas começam por ARQVERTICE", () => {
    // A pertença à marca é visível no nome que o próprio cliente vê.
    THEME_ORDER.forEach((key) => expect(getTheme(key).label.startsWith("ARQVERTICE")).toBe(true));
  });

  it("todo tema tem as dimensões que o item 13 enumera", () => {
    THEME_ORDER.forEach((key) => {
      const theme = getTheme(key);
      expect(theme.typography).toBeDefined();
      expect(theme.scale.title).toBeGreaterThan(0);
      expect(theme.tokens.background).toBeTruthy();
      expect(theme.tokens.border).toBeTruthy();
      expect(theme.radius).toBeTruthy();
      expect(theme.shadow).toBeTruthy();
      expect(theme.spacing).toBeGreaterThan(0);
      expect(theme.card).toBeTruthy();
      expect(theme.image).toBeTruthy();
      expect(theme.table).toBeTruthy();
      expect(theme.button).toBeTruthy();
      expect(theme.highlight.style).toBeTruthy();
      expect(theme.recurring.pageNumber).toBeTruthy();
    });
  });

  it("reconhece chaves válidas e recusa inválidas", () => {
    expect(isThemeKey("arqvertice-editorial")).toBe(true);
    expect(isThemeKey("tema-inventado")).toBe(false);
    expect(getTheme("tema-inventado").key).toBe(DEFAULT_THEME);
  });

  it("tem nomes distintos", () => {
    const labels = THEME_ORDER.map((key) => getTheme(key).label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("identidade ARQVERTICE (item 14)", () => {
  it("só o tema escuro usa cores literais, e está declarado", () => {
    // Um tema com paleta própria é uma decisão; cinco paletas livres seriam uma
    // identidade nova — que é exactamente o que o item 14 proíbe.
    const comHex = THEME_ORDER.filter((key) =>
      Object.values(getTheme(key).tokens).some((value) => value.startsWith("#")),
    );
    expect(comHex).toEqual(["arqvertice-alto-padrao"]);
  });

  it("todos os hexadecimais estão na lista declarada", () => {
    THEME_ORDER.forEach((key) => {
      Object.values(getTheme(key).tokens).forEach((value) => {
        if (value.startsWith("#")) expect(ALL_THEME_TOKENS).toContain(value.toLowerCase());
      });
    });
  });

  it("a lista de cores não tem repetidos", () => {
    expect(new Set(ALL_THEME_TOKENS).size).toBe(ALL_THEME_TOKENS.length);
  });

  it("nenhum tema introduz uma família de fontes fora do Design System", () => {
    // `fontFamily` é um literal de tipo: nem compila com outro valor.
    THEME_ORDER.forEach((key) => expect(getTheme(key).typography.fontFamily).toBe("design-system"));
  });

  it("NÃO menciona nenhuma marca de terceiros", () => {
    const proibidas = ["gamma", "made with", "canva", "notion", "figma", "powerpoint", "microsoft"];
    THEME_ORDER.forEach((key) => {
      const texto = JSON.stringify(getTheme(key)).toLowerCase();
      proibidas.forEach((marca) => expect(texto).not.toContain(marca));
    });
  });
});

describe("acessibilidade (item 14)", () => {
  it("todos os temas são legíveis segundo o WCAG AA", () => {
    auditAllThemes().forEach((audit) => expect({ t: audit.theme, ok: audit.readable }).toEqual({ t: audit.theme, ok: true }));
  });

  it("calcula contraste de pares conhecidos", () => {
    // Branco sobre preto é o máximo; branco sobre branco é o mínimo.
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
  });

  it("aceita hex de três dígitos", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 0);
  });

  it("devolve null para uma cor que não é hex, em vez de inventar", () => {
    // Um token do Design System é opaco em tempo de construção. Devolver um
    // número faria o teste de acessibilidade passar sem ter medido nada.
    expect(contrastRatio("var(--text-primary)", "#ffffff")).toBeNull();
  });

  it("marca um tema com contraste insuficiente", () => {
    const base = getTheme(DEFAULT_THEME);
    const mau = auditTheme({ ...base, tokens: { ...base.tokens, body: "#eeeeee" } });
    expect(mau.readable).toBe(false);
    expect(mau.checks.some((check) => check.passes === false)).toBe(true);
  });

  it("delega ao Design System o que não pode medir", () => {
    const audit = auditTheme(getTheme(DEFAULT_THEME));
    expect(audit.checks.filter((check) => check.passes === null).length).toBeGreaterThan(0);
  });

  it("o mínimo de corpo é o da norma, não um número escolhido", () => {
    expect(MIN_BODY_CONTRAST).toBe(4.5);
  });
});

describe("preview e aplicação de tema (item 13)", () => {
  it("o preview traz só o que o selector desenha", () => {
    const preview = themePreview("arqvertice-editorial");
    expect(preview.key).toBe("arqvertice-editorial");
    expect(preview.titleScale).toBeGreaterThan(1);
    expect(preview.background).toBeTruthy();
  });

  it("preview de uma chave inválida cai no tema por omissão", () => {
    expect(themePreview("inexistente").key).toBe(DEFAULT_THEME);
  });

  it("aplica o tema SÓ nesta apresentação, sem tocar no resto", () => {
    const deck = { theme: "arqvertice-minimal", slides: [] as unknown[], outraProp: 1 };
    const themed = applyTheme(deck, "arqvertice-tecnico");
    expect(themed.theme).toBe("arqvertice-tecnico");
    // O original fica intacto: é o que garante "aplicar somente nesta
    // apresentação" quando há várias abertas ao mesmo tempo.
    expect(deck.theme).toBe("arqvertice-minimal");
    expect(themed.outraProp).toBe(1);
  });

  it("aplicar um tema inválido não corrompe a apresentação", () => {
    expect(applyTheme({ theme: "arqvertice-minimal" }, "nao-existe").theme).toBe(DEFAULT_THEME);
  });
});