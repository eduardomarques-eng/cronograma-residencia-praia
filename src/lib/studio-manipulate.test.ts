import { describe, expect, it } from "vitest";
import {
  addBlankSlide,
  blankSlide,
  canRedo,
  canUndo,
  commit,
  compatibleLayouts,
  createHistory,
  duplicateSlide,
  evaluateLayoutChange,
  HISTORY_LIMIT,
  insertElement,
  insertSlides,
  LayoutIncompatibleError,
  moveSlide,
  nudgeSlide,
  redo,
  removeElement,
  removeSlide,
  reorderSlides,
  replaceLayout,
  setSlideHidden,
  undo,
  updateSlide,
} from "./studio-manipulate";
import type { StudioDeck, StudioElement, StudioSlide } from "./studio-deck";

const texto = (id: string, text: string): StudioElement => ({ kind: "text", id, role: "body", text });

describe("páginas em branco têm identidade própria", () => {
  it("duas páginas em branco com o mesmo layout não partilham id", () => {
    // Sem a posição no id, o React via duas páginas onde existe uma, e apagar
    // uma apagava as duas.
    expect(blankSlide("title-text", 0).id).not.toBe(blankSlide("title-text", 1).id);
  });

  it("acrescentar duas páginas seguidas dá ids diferentes", () => {
    const deck: StudioDeck = { theme: "arqvertice-minimal", slides: [slide("s1", "Capa")], origin: null };
    const once = addBlankSlide(deck, 1);
    const twice = addBlankSlide(once, 2);
    expect(twice.slides[1].id).not.toBe(twice.slides[2].id);
    expect(twice.slides).toHaveLength(3);
  });

  it("acrescenta no fim sem perder as páginas existentes", () => {
    const deck: StudioDeck = { theme: "arqvertice-minimal", slides: [slide("s1", "Capa")], origin: null };
    expect(addBlankSlide(deck, 1).slides[0].id).toBe("s1");
  });
});

describe("inserção de elementos (item 9)", () => {
  const base: StudioDeck = { theme: "arqvertice-minimal", slides: [slide("s1", "Capa")], origin: null };

  it("acrescenta ao fim por omissão", () => {
    const next = insertElement(base, 0, texto("el-a", "um"));
    expect(next.slides[0].elements.map((e) => e.id)).toEqual(["el-a"]);
  });

  it("não altera o deck de origem", () => {
    insertElement(base, 0, texto("el-a", "um"));
    expect(base.slides[0].elements).toHaveLength(0);
  });

  it("insere na posição pedida", () => {
    const withOne = insertElement(base, 0, texto("el-a", "um"));
    const next = insertElement(withOne, 0, texto("el-b", "dois"), 0);
    expect(next.slides[0].elements.map((e) => e.id)).toEqual(["el-b", "el-a"]);
  });

  it("desambigua ids repetidos em vez de recusar", () => {
    // Inserir a mesma imagem duas vezes na página é legítimo.
    const once = insertElement(base, 0, texto("el-a", "um"));
    const twice = insertElement(once, 0, texto("el-a", "outro"));
    expect(twice.slides[0].elements).toHaveLength(2);
    expect(twice.slides[0].elements[0].id).not.toBe(twice.slides[0].elements[1].id);
  });

  it("recusa uma página que não existe", () => {
    expect(() => insertElement(base, 9, texto("el-a", "um"))).toThrow(RangeError);
  });
});

describe("remoção de elementos", () => {
  it("remove pelo identificador", () => {
    const withElements: StudioDeck = {
      theme: "arqvertice-minimal",
      slides: [{ ...slide("s1", "Capa"), elements: [texto("el-a", "um"), texto("el-b", "dois")] }],
      origin: null,
    };
    expect(removeElement(withElements, 0, "el-a").slides[0].elements.map((e) => e.id)).toEqual(["el-b"]);
  });
});

const slide = (id: string, title: string, extra: Partial<StudioSlide> = {}): StudioSlide => ({
  id,
  layout: "title-text",
  eyebrow: "",
  title,
  body: "",
  elements: [],
  hidden: false,
  notes: "",
  ...extra,
});

const deck = (): StudioDeck => ({
  theme: "arqvertice-minimal",
  origin: null,
  slides: [slide("a", "A"), slide("b", "B"), slide("c", "C")],
});

/**
 * FASE 4C — manipulação de páginas (item 8) e troca de layout (item 10).
 *
 * A propriedade que estes testes protegem é "nada é mutado". Sem ela, o
 * histórico de desfazer do editor visual é impossível — e um desfazer que não
 * desfaz é pior do que não o ter.
 */
describe("manipulação de páginas", () => {
  it("nunca muta o deck original", () => {
    const original = deck();
    const before = JSON.stringify(original);
    duplicateSlide(original, 0);
    removeSlide(original, 1);
    moveSlide(original, 0, 2);
    updateSlide(original, 0, { title: "Novo" });
    expect(JSON.stringify(original)).toBe(before);
  });

  it("duplica a página logo a seguir, com id NOVO", () => {
    const result = duplicateSlide(deck(), 0);
    expect(result.slides.map((s) => s.title)).toEqual(["A", "A", "B", "C"]);
    expect(result.slides[1].id).not.toBe(result.slides[0].id);
  });

  it("duplica os elementos com id novo", () => {
    const withElement = deck();
    withElement.slides[0].elements = [{ kind: "text", id: "e1", role: "body", text: "Olá" }];
    const result = duplicateSlide(withElement, 0);
    expect(result.slides[1].elements[0].id).not.toBe(result.slides[0].elements[0].id);
    expect(result.slides[1].elements[0]).toMatchObject({ kind: "text", text: "Olá" });
  });

  it("remove a página certa", () => {
    expect(removeSlide(deck(), 1).slides.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("recusa remover a ÚLTIMA página", () => {
    // Uma apresentação sem páginas não é uma apresentação.
    const one = { ...deck(), slides: [slide("a", "A")] };
    expect(() => removeSlide(one, 0)).toThrow(RangeError);
  });

  it("recusa posições fora da apresentação", () => {
    expect(() => removeSlide(deck(), 9)).toThrow(RangeError);
    expect(() => moveSlide(deck(), 0, 9)).toThrow(RangeError);
  });

  it("move uma página para outra posição", () => {
    expect(moveSlide(deck(), 0, 2).slides.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("sobe e desce sem erro nas extremidades", () => {
    // `direction` é um delta de ÍNDICE: -1 sobe, +1 desce. Na primeira página
    // não há para subir, e na última não há para descer: em ambos os casos o
    // deck volta intacto, sem exceção — um botão de topo no fim da lista não
    // pode rebentar o editor.
    const base = deck();
    expect(nudgeSlide(base, 0, -1).slides.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(nudgeSlide(base, 2, 1).slides.map((s) => s.id)).toEqual(["a", "b", "c"]);
    // E o movimento possível, dentro dos limites, continua a funcionar.
    expect(nudgeSlide(base, 2, -1).slides.map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(nudgeSlide(base, 0, 1).slides.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("reordena por arrasto, recebendo ids", () => {
    expect(reorderSlides(deck(), ["c", "a", "b"]).slides.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("nunca perde uma página num arrasto incompleto", () => {
    // Perder uma página por um arrasto mal formado seria perda de dados.
    const result = reorderSlides(deck(), ["c", "a"]);
    expect(result.slides).toHaveLength(3);
    expect(result.slides.map((s) => s.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("insere antes e depois", () => {
    const base = deck();
    expect(insertSlides(base, 0, [blankSlide()]).slides).toHaveLength(4);
    expect(insertSlides(base, 3, [blankSlide()]).slides[3].title).toBe("");
  });

  it("esconde sem apagar, e restaura", () => {
    const hidden = setSlideHidden(deck(), 1, true);
    expect(hidden.slides).toHaveLength(3);
    expect(hidden.slides[1].hidden).toBe(true);
    expect(setSlideHidden(hidden, 1, false).slides[1].hidden).toBe(false);
  });
});
describe("troca de layout sem perder conteúdo (item 10)", () => {
  const withTable = slide("a", "Valores", {
    elements: [{ kind: "table", id: "t1", columns: ["Serviço", "Valor"], rows: [["Projeto", "25.000"]], binding: null }],
  });

  it("permite trocar quando o layout novo aceita tudo", () => {
    const result = evaluateLayoutChange(slide("a", "Texto"), "text-image");
    expect(result.safe).toBe(true);
    expect(result.warning).toBe("");
  });

  it("assinala a troca que esconderia uma tabela", () => {
    const result = evaluateLayoutChange(withTable, "gallery");
    expect(result.safe).toBe(false);
    expect(result.incompatible).toContain("table");
    expect(result.warning).toContain("table");
  });

  it("considera segura uma troca para o mesmo layout", () => {
    expect(evaluateLayoutChange(withTable, "title-text").safe).toBe(true);
  });

  it("RECUSA aplicar a troca perigosa", () => {
    const base: StudioDeck = { theme: "arqvertice-minimal", origin: null, slides: [withTable] };
    expect(() => replaceLayout(base, 0, "gallery")).toThrow(LayoutIncompatibleError);
  });

  it("a troca segura preserva todos os elementos", () => {
    const base: StudioDeck = { theme: "arqvertice-minimal", origin: null, slides: [withTable] };
    const result = replaceLayout(base, 0, "investment");
    expect(result.slides[0].layout).toBe("investment");
    expect(result.slides[0].elements).toHaveLength(1);
  });

  it("lista apenas os layouts que servem a página", () => {
    const options = compatibleLayouts(withTable);
    expect(options).toContain("investment");
    expect(options).not.toContain("gallery");
  });
});

describe("histórico de desfazer e refazer (item 8)", () => {
  it("começa sem passado nem futuro", () => {
    const history = createHistory(deck());
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("desfaz e refaz uma alteração", () => {
    let history = createHistory(deck());
    history = commit(history, duplicateSlide(history.present, 0));
    expect(history.present.slides).toHaveLength(4);

    history = undo(history);
    expect(history.present.slides).toHaveLength(3);

    history = redo(history);
    expect(history.present.slides).toHaveLength(4);
  });

  it("ignora um commit que não muda nada", () => {
    const history = createHistory(deck());
    expect(commit(history, history.present)).toBe(history);
  });

  it("uma edição nova descarta o refazer", () => {
    // Sem isto, o refazer saltava para um ramo que o ADMIN já não viu.
    let history = createHistory(deck());
    history = commit(history, duplicateSlide(history.present, 0));
    history = undo(history);
    expect(canRedo(history)).toBe(true);
    history = commit(history, moveSlide(history.present, 0, 1));
    expect(canRedo(history)).toBe(false);
  });

  it("desfazer no início não faz nada", () => {
    const history = createHistory(deck());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("limita a memória do histórico", () => {
    let history = createHistory(deck());
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      history = commit(history, duplicateSlide(history.present, 0));
    }
    expect(history.past.length).toBe(HISTORY_LIMIT);
  });

  it("guarda estados independentes, não referências partilhadas", () => {
    // É o que garante que desfazer volta ao texto EXATO, e não a uma versão
    // do mesmo objecto que alguém já alterou.
    let history = createHistory(deck());
    const originalTitle = history.present.slides[0].title;
    history = commit(history, updateSlide(history.present, 0, { title: "Alterado" }));
    history = undo(history);
    expect(history.present.slides[0].title).toBe(originalTitle);
  });
});