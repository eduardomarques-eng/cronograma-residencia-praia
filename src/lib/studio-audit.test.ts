import { describe, expect, it } from "vitest";
import { diffStudioDecks, type StudioEditOrigin } from "./studio-audit";
import { AUDIT_ACTION, AUDIT_ACTION_LABELS, AUDIT_ENTITY, type AuditAction } from "./audit-events";
import type { StudioDeck, StudioSlide } from "./studio-deck";

const slide = (id: string, extra: Partial<StudioSlide> = {}): StudioSlide => ({
  id,
  layout: "title-text",
  eyebrow: "",
  title: `Página ${id}`,
  body: "",
  elements: [],
  hidden: false,
  notes: "",
  ...extra,
});

const deck = (slides: StudioSlide[], theme = "arqvertice-minimal"): StudioDeck => ({
  theme: theme as StudioDeck["theme"],
  origin: null,
  slides,
});

const imagem = (id: string, url: string, source: "library" | "ai" = "library") => ({
  kind: "image" as const,
  id,
  url,
  alt: "",
  fit: "cover" as const,
  background: false,
  source,
});

/** Os nomes das acções disparadas por uma alteração. */
const actions = (before: StudioDeck | null, after: StudioDeck, origin: StudioEditOrigin = "MANUAL") =>
  diffStudioDecks(before, after, origin).map((event) => event.action);

describe("item 56 — o que a auditoria tem de responder", () => {
  it("a criação regista a apresentação inteira", () => {
    expect(actions(null, deck([slide("s1"), slide("s2")]))).toContain("STUDIO_DECK_CREATED");
  });

  it("a importação fica registada como importação", () => {
    expect(actions(null, deck([slide("s1")]), "IMPORTACAO")).toContain("STUDIO_DECK_IMPORTED");
  });

  it("uma edição manual não aparece como edição por IA", () => {
    const before = deck([slide("s1")]);
    const after = deck([slide("s1", { title: "Novo título" })]);
    expect(actions(before, after)).toContain("STUDIO_SLIDE_EDITED");
    expect(actions(before, after)).not.toContain("STUDIO_AI_EDIT_APPLIED");
  });

  it("uma edição por IA é distinguida da manual", () => {
    const before = deck([slide("s1")]);
    const after = deck([slide("s1", { title: "Reescrito" })]);
    expect(actions(before, after, "IA")).toContain("STUDIO_AI_EDIT_APPLIED");
  });

  it("regista a criação de uma página", () => {
    expect(actions(deck([slide("s1")]), deck([slide("s1"), slide("s2")]))).toContain("STUDIO_SLIDE_ADDED");
  });

  it("regista a exclusão de uma página", () => {
    expect(actions(deck([slide("s1"), slide("s2")]), deck([slide("s1")]))).toContain("STUDIO_SLIDE_REMOVED");
  });

  it("distingue duplicação de criação", () => {
    // Uma cópia é a MESMA página com outro id. Sem esta distinção o registo
    // diria "criada" e a revisão perdia o rasto da origem.
    const disparados = actions(
      deck([slide("s1", { title: "Escopo" })]),
      deck([slide("s1", { title: "Escopo" }), slide("s2", { title: "Escopo" })]),
    );
    expect(disparados).toContain("STUDIO_SLIDE_DUPLICATED");
    expect(disparados).not.toContain("STUDIO_SLIDE_ADDED");
  });

  it("regista a mudança de layout", () => {
    expect(actions(deck([slide("s1")]), deck([slide("s1", { layout: "cover" })]))).toContain(
      "STUDIO_LAYOUT_CHANGED",
    );
  });

  it("regista a mudança de tema", () => {
    expect(actions(deck([slide("s1")], "arqvertice-minimal"), deck([slide("s1")], "arqvertice-bold"))).toContain(
      "STUDIO_THEME_CHANGED",
    );
  });

  it("regista a reordenação sem dizer que houve edição", () => {
    const disparados = actions(deck([slide("s1"), slide("s2")]), deck([slide("s2"), slide("s1")]));
    expect(disparados).toContain("STUDIO_SLIDE_REORDERED");
    expect(disparados).not.toContain("STUDIO_SLIDE_EDITED");
  });

  it("regista a substituição de imagem", () => {
    // Mesma url com id novo: o cliente vê outra imagem no mesmo sítio.
    const disparados = actions(
      deck([slide("s1", { elements: [imagem("i1", "/a.jpg")] })]),
      deck([slide("s1", { elements: [imagem("i2", "/a.jpg")] })]),
    );
    expect(disparados).toContain("STUDIO_IMAGE_REPLACED");
  });

  it("uma inserção de imagem não é uma substituição", () => {
    const disparados = actions(deck([slide("s1")]), deck([slide("s1", { elements: [imagem("i1", "/nova.jpg")] })]));
    expect(disparados).toContain("STUDIO_IMAGE_INSERTED");
  });

  it("uma inserção feita por IA é registada como geração", () => {
    const disparados = actions(
      deck([slide("s1")]),
      deck([slide("s1", { elements: [imagem("i1", "/gerada.jpg", "ai")] })]),
      "IA",
    );
    expect(disparados).toContain("STUDIO_IMAGE_GENERATED");
  });

  it("nada muda, nada é registado", () => {
    expect(diffStudioDecks(deck([slide("s1"), slide("s2")]), deck([slide("s1"), slide("s2")]), "MANUAL")).toHaveLength(0);
  });

describe("item 56 — o catálogo é o registo único", () => {
  it("toda a acção emitida existe no catálogo", () => {
    // É esta lista que obriga a decidir o que é crítico. Uma acção emitida fora
    // dela é uma acção que ninguém decidiu auditar.
    const casos: Array<[StudioDeck | null, StudioDeck, StudioEditOrigin]> = [
      [null, deck([slide("s1")]), "IMPORTACAO"],
      [deck([slide("s1")]), deck([slide("s1", { title: "x" }), slide("s2")]), "MANUAL"],
      [deck([slide("s1"), slide("s2")]), deck([slide("s2"), slide("s1")]), "IA"],
      [deck([slide("s1")], "arqvertice-minimal"), deck([slide("s1", { layout: "cover" })], "arqvertice-bold"), "TEMPLATE"],
      [deck([slide("s1")]), deck([slide("s1", { elements: [imagem("i1", "/g.jpg", "ai")] })]), "IA"],
    ];

    const emitidas = new Set<string>();
    for (const [before, after, origin] of casos) {
      for (const event of diffStudioDecks(before, after, origin)) emitidas.add(event.action);
    }

    expect(emitidas.size).toBeGreaterThan(5);
    for (const action of emitidas) {
      expect(Object.keys(AUDIT_ACTION)).toContain(action);
      expect(AUDIT_ACTION_LABELS[action as AuditAction]).toBeTruthy();
    }
  });

  it("toda a acção do catálogo tem rótulo em português", () => {
    for (const action of Object.keys(AUDIT_ACTION) as AuditAction[]) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
    }
  });

  it("a auditoria do Studio usa a versão como entidade, sem tabela paralela", () => {
    // O deck vive em `ProposalVersion.presentation` (item 59).
    expect(AUDIT_ENTITY.STUDIO_DECK).toBe("ProposalVersion");
  });
});
  it("uma inserção no meio não conta como edição das seguintes", () => {
    // A comparação é por identidade, não por posição: sem isto, inserir no meio
    // geraria ruído em todas as páginas seguintes.
    const eventos = diffStudioDecks(deck([slide("s1"), slide("s3")]), deck([slide("s1"), slide("s2"), slide("s3")]), "MANUAL");
    expect(eventos.map((event) => event.action)).toEqual(["STUDIO_SLIDE_ADDED"]);
  });

  it("guarda as páginas envolvidas para o registo ser localizável", () => {
    const evento = diffStudioDecks(deck([slide("s1"), slide("s2")]), deck([slide("s1", { title: "Novo" }), slide("s2")]), "MANUAL").find(
      (e) => e.action === "STUDIO_SLIDE_EDITED",
    );
    expect(evento?.refs.slideIds).toEqual(["s1"]);
  });
});