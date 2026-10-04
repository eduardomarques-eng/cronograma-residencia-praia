import { describe, expect, it } from "vitest";
import { hexString, measureText, PdfWriter, toWinAnsi, wrapText } from "./pdf-writer";

/** Converte os bytes para latin1 — todos os bytes do PDF cabem nessa gama. */
function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("codificação WinAnsi", () => {
  it("mantém a acentuação portuguesa", () => {
    expect(Array.from(toWinAnsi("ãçéõÁÇÉÕ"))).toEqual([0xe3, 0xe7, 0xe9, 0xf5, 0xc1, 0xc7, 0xc9, 0xd5]);
  });

  it("converte travessão e aspas tipográficas", () => {
    // O travessão e as aspas curvas aparecem nos textos do relatório.
    expect(Array.from(toWinAnsi("— “x”"))).toEqual([0x97, 0x20, 0x93, 0x78, 0x94]);
  });

  it("substitui glifos fora da codificação em vez de gerar lixo", () => {
    // Emoji e sinais matemáticos não existem em WinAnsi.
    expect(Array.from(toWinAnsi("⚠"))).toEqual([0x3f]);
    expect(Array.from(toWinAnsi("≥"))).toEqual([0x3f]);
  });

  it("o travessão sai com o byte certo, não com '?'", () => {
    expect(Array.from(toWinAnsi("—"))).toEqual([0x97]);
  });

  it("mede um acento como a letra base", () => {
    expect(measureText("Á")).toBe(measureText("A"));
    expect(measureText("ç")).toBe(measureText("c"));
    expect(measureText("Relatório")).toBeGreaterThan(0);
  });
});

describe("quebra de linha", () => {
  it("respeita a largura máxima", () => {
    const lines = wrapText(
      "Estudo preliminar do projeto arquitetônico com estudo de sombras e ventilação natural",
      120,
      9,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureText(line) * 9).toBeLessThanOrEqual(120);
  });

  it("parte uma palavra mais larga que a coluna", () => {
    const lines = wrapText("Hidrossanitario", 20, 9);
    expect(lines.length).toBeGreaterThan(1);
  });

describe("ficheiro PDF", () => {
  it("produz um PDF válido com cabeçalho, xref e EOF", () => {
    const writer = new PdfWriter({ title: "Relatório", author: "ArqVértice", subject: "Cronograma" });
    writer.heading("1. DADOS DO PROJETO");
    writer.paragraph("Obra de teste com acentuação: residência, área, português.");
    const text = latin1(writer.build());

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("xref");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("Helvetica");
    expect(text).toContain("WinAnsiEncoding");
    expect(text).toContain("/Type /Page");
  });

  it("o startxref aponta para o início da tabela xref", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    writer.paragraph("conteúdo");
    const text = latin1(writer.build());
    const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("os offsets do xref batem certo com as posições reais", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    writer.paragraph("primeiro");
    writer.newPage();
    writer.paragraph("segundo");
    const text = latin1(writer.build());

    const rows = text.slice(text.indexOf("xref")).split("\n").slice(2);
    const offsets = rows
      .filter((row) => row.endsWith(" n "))
      .map((row) => Number(row.slice(0, 10)));
    expect(offsets.length).toBeGreaterThan(4);
    offsets.forEach((offset, index) => {
      expect(text.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
  });

  it("pagina: uma tabela longa gera várias páginas", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    writer.table({
      columns: [
        { title: "Descrição / Etapa", weight: 28 },
        { title: "Avanço Físico", weight: 14 },
      ],
      rows: Array.from({ length: 80 }, (_, index) => [`Etapa ${index + 1}`, "0%"]),
      progressColumn: 1,
      progressValues: Array.from({ length: 80 }, () => 50),
    });

    expect(writer.pageCount).toBeGreaterThan(2);
    const text = latin1(writer.build());
    expect((text.match(/\/Type \/Page /g) ?? []).length).toBe(writer.pageCount);
    // O cabeçalho da tabela repete-se em todas as páginas.
    const header = hexString("Descrição / Etapa").slice(1, 20);
    expect(text.split(header).length - 1).toBe(writer.pageCount);
  });

  it("uma tabela sem linhas escreve 'Sem registos' em vez de quebrar", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    writer.table({ columns: [{ title: "Etapa", weight: 1 }], rows: [] });
    expect(writer.pageCount).toBe(1);
    const text = latin1(writer.build());
    expect(text.slice(text.indexOf("stream"), text.indexOf("endstream"))).toContain(
      hexString("Sem registos."),
    );
  });

  it("nada transborda a margem inferior", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    for (let index = 0; index < 400; index += 1) writer.paragraph(`Linha de texto numero ${index}`);
    writer.stampFooters("Relatório");
    expect(writer.pageCount).toBeGreaterThan(5);
    expect(writer.y).toBeLessThanOrEqual(writer.height - writer.margin + 1);
  });

  it("o /Length de cada stream bate certo com o conteúdo real", () => {
    // Um /Length errado é o motivo mais comum de "PDF corrompido": o leitor conta
    // os bytes, encontra o fim do stream mais cedo e descarta o resto do ficheiro.
    const writer = new PdfWriter({ title: "Relatório", author: "A", subject: "S" });
    for (let index = 0; index < 60; index += 1) writer.paragraph(`Etapa ${index}: descrição longa.`);
    const text = latin1(writer.build());

    const pattern = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g;
    let checked = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      expect(match[2].length).toBe(Number(match[1]));
      checked += 1;
    }
    expect(checked).toBe(writer.pageCount);
  });

  it("nenhum byte acima de 0xFF escapa para o ficheiro", () => {
    // Todo o conteúdo é ASCII depois da codificação; um byte alto fora dos
    // streams (por exemplo no cabeçalho) desalinharia o xref.
    const writer = new PdfWriter({ title: "Título com ç e ã", author: "A", subject: "S" });
    writer.paragraph("Acentuação: ção, ã, çé.");
    const text = latin1(writer.build());
    const head = text.slice(0, text.indexOf("xref"));
    for (let index = 0; index < head.length; index += 1) {
      expect(head.charCodeAt(index)).toBeLessThanOrEqual(0xff);
    }
  });

  it("é determinístico: o mesmo desenho dá os mesmos bytes", () => {
    const draw = () => {
      const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
      writer.heading("Secção");
      writer.paragraph("Texto com acentuação.");
      writer.stampFooters("Relatório");
      return Array.from(writer.build());
    };
    expect(draw()).toEqual(draw());
  });

  it("o rodapé leva a contagem de páginas", () => {
    const writer = new PdfWriter({ title: "T", author: "A", subject: "S" });
    writer.paragraph("a");
    writer.newPage();
    writer.paragraph("b");
    writer.stampFooters("Cronograma");
    const text = latin1(writer.build());
    const streams = text.slice(text.indexOf("stream"), text.lastIndexOf("endstream"));
    expect(streams).toContain(hexString("Cronograma · 1/2"));
    expect(streams).toContain(hexString("Cronograma · 2/2"));
  });
});
  it("preserva a quebra explícita", () => {
    expect(wrapText("a\n\nb", 500, 10)).toEqual(["a", "", "b"]);
  });
});