/**
 * FASE 3 — escritor de PDF no servidor, sem dependências.
 *
 * Decisão (opção A, server-side): o projecto não tem nenhuma biblioteca de PDF
 * instalada — `pdf-lib`, `pdfkit`, `jspdf` e `html2pdf` não existem em
 * `node_modules`, e o único pacote de browser (`playwright`) é `devDependency`
 * dos testes E2E. Instalar um Chromium de几百 MB só para desenhar um relatório
 * seria a solução mais pesada e a que mais falha em ambiente serverless.
 *
 * O que aqui está é o mínimo que produz um PDF REAL e válido:
 *   · PDF 1.4, A4 retrato;
 *   · fontes standard do PDF (Helvetica) com `WinAnsiEncoding` — cobre toda a
 *     acentuação portuguesa (á, ã, ç, É, õ…) sem embeber ficheiro de fonte;
 *   · texto escrito em strings hexadecimais, o que dispensa escapes e garante
 *     que o ficheiro sai byte-a-byte igual em qualquer máquina;
 *   · paginação com quebra de página, linhas de tabela que não se partem ao
 *     meio e cabeçalho de tabela repetido em cada página;
 *   · saída DETERMINÍSTICA (sem data nem aleatoriedade): os mesmos dados
 *     produzem sempre o mesmo ficheiro, o que permite comparar e testar.
 *
 * Limite conhecido e declarado: caracteres fora de WinAnsi (emoji, sinais como
 * "≥") são substituídos por equivalente ASCII em vez de falhar. Para relatórios
 * em português não há perda; para texto com glifos CJK o ficheiro não serve.
 */

/** A4 em pontos (72 pt = 1 polgada). */
export const A4 = { width: 595.28, height: 841.89 };

/**
 * Pontos de largura por caractere (AFM das fontes standard, milésimas de em).
 *
 * Só ASCII 32-126. Acentos usam a largura da letra base: em Helvetica "Á" tem
 * exactamente a largura de "A", por isso a tabela continua exacta.
 */
const WIDTH_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const WIDTH_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Marcas de combinação Unicode (o que fica depois de "NFD" num acento). */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Letra base de um caractere acentuado, para medir a largura. */
function baseLetter(codePoint: number): number {
  const base = String.fromCodePoint(codePoint).normalize("NFD").replace(COMBINING_MARKS, "");
  return base.codePointAt(0) ?? 32;
}

/** Unicode para byte CP1252 nos caracteres acima de 0x7F. */
const CP1252_SPECIALS = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);

/**
 * Converte texto em bytes WinAnsi.
 *
 * Caracteres fora da codificação viram "?" em vez de gerar um ficheiro
 * corrompido — o relatório continua a abrir, e a perda fica visível para quem lê.
 */
export function toWinAnsi(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index) ?? 32;
    if (codePoint > 0xffff) {
      index += 1; // par suplente ocupa duas posições
      bytes[index - 1] = 0x3f;
      continue;
    }
    if (codePoint < 0x80 || (codePoint >= 0xa0 && codePoint <= 0xff)) {
      bytes[index] = codePoint;
      continue;
    }
    bytes[index] = CP1252_SPECIALS.get(codePoint) ?? 0x3f;
  }
  return bytes;
}

/** Texto como string hexadecimal, para não precisar de escapes no PDF. */
export function hexString(text: string): string {
  return `<${Array.from(toWinAnsi(text), (byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}

/** Largura do texto em pontos, para corpo de tamanho 1. */
export function measureText(text: string, bold = false): number {
  const table = bold ? WIDTH_BOLD : WIDTH_REGULAR;
  let total = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 32;
    if (codePoint >= 32 && codePoint <= 126) total += table[codePoint - 32];
    else total += table[baseLetter(codePoint) - 32] ?? 556;
  }
  return total / 1000;
}

/**
 * Quebra o texto em linhas que cabem em `maxWidth`, à escala do corpo `size`.
 *
 * Quebra por palavra; uma palavra mais larga que a coluna é cortada em partes
 * em vez de transbordar a margem — acontece numa tabela estreita.
 */
export function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const limit = maxWidth / size;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, bold) <= limit) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measureText(word, bold) <= limit) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const character of word) {
        if (measureText(chunk + character, bold) > limit) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export type Align = "left" | "center" | "right";

export type PdfTextOptions = { size?: number; bold?: boolean; color?: string; align?: Align };
export type PdfRectOptions = { fill?: string; stroke?: string; lineWidth?: number };

export type PdfTableColumn = {
  title: string;
  /** Largura relativa. As colunas são normalizadas para caber na largura útil. */
  weight: number;
  align?: Align;
};

export type PdfTableOptions = {
  columns: PdfTableColumn[];
  rows: string[][];
  size?: number;
  /** Espaçamento vertical dentro da célula, em pontos. */
  padding?: number;
  /** Cor do fundo do cabeçalho. */
  headerFill?: string;
  /** Índice da coluna que leva a barra de avanço físico. */
  progressColumn?: number;
  progressValues?: number[];
};

/**
 * Documento A4 em construção, com cursor de fluxo e quebra de página.
 *
 * As coordenadas públicas são medidas de cima para baixo (`y` cresce para
 * baixo), como no CSS. A conversão para o sistema do PDF, em que `y` cresce para
 * cima, acontece em `drawText`, `rect` e `stampFooters`.
 */
export class PdfWriter {
  readonly width = A4.width;
  readonly height = A4.height;
  readonly margin: number;
  private pages: string[] = [];
  private current = "";
  /** Cursor vertical, medido do topo. */
  y = 0;

  constructor(
    private readonly info: { title: string; author: string; subject: string },
    options: { margin?: number } = {},
  ) {
    this.margin = options.margin ?? 36;
    this.newPage();
  }

  get contentWidth(): number {
    return this.width - this.margin * 2;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Começa uma página nova. A primeira é criada pelo construtor. */
  newPage(): void {
    this.pages.push(this.current);
    this.current = "";
    this.y = this.margin;
  }

  /** Garante que `height` pontos ainda cabem; se não, abre página nova. */
  ensure(height: number): void {
    if (this.y + height > this.height - this.margin) this.newPage();
  }

  /** Desenha um rectângulo. `y` é medido do topo. */
  rect(x: number, y: number, width: number, height: number, options: PdfRectOptions = {}): void {
    const top = this.height - y - height;
    const parts: string[] = [];
    if (options.fill) parts.push(`${options.fill} rg`);
    if (options.stroke) {
      parts.push(`${options.stroke} RG`);
      parts.push(`${(options.lineWidth ?? 0.6).toFixed(2)} w`);
    }
    parts.push(`${x.toFixed(2)} ${top.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    parts.push(options.stroke ? "B" : "f");
    this.current += `${parts.join("\n")}\n`;
  }

  /** Texto numa posição absoluta. `baseline` é a linha de base, medida do topo. */
  drawText(text: string, x: number, baseline: number, options: PdfTextOptions = {}): void {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const width = measureText(text, bold) * size;
    const align = options.align ?? "left";
    const left = align === "left" ? x : align === "center" ? x - width / 2 : x - width;
    const prefix = options.color ? `${options.color} rg\n` : "";
    this.current +=
      `${prefix}BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${left.toFixed(2)} ${(this.height - baseline).toFixed(2)} Tm ${hexString(text)} Tj ET\n`;
  }

  /**
   * Escreve texto em fluxo, com quebra de linha e quebra de página.
   *
   * `gapAfter` é o espaço que fica DEPOIS do bloco — quem chama decide quanto
   * respira depois de um título.
   */
  flowText(
    text: string,
    options: PdfTextOptions & { gapAfter?: number; lineHeight?: number; indent?: number } = {},
  ): void {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const lineHeight = options.lineHeight ?? size * 1.35;
    const indent = options.indent ?? 0;
    const lines = wrapText(text, this.contentWidth - indent, size, bold);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.drawText(line, this.margin + indent, this.y + size, { size, bold, color: options.color });
      this.y += lineHeight;
    }
    this.y += options.gapAfter ?? 0;
  }

  /** Título de secção, com a barra escura da referência. */
  heading(title: string, options: { size?: number; gapAfter?: number } = {}): void {
    const size = options.size ?? 11;
    this.ensure(size * 3);
    this.rect(this.margin, this.y + 2, 4, size + 4, { fill: "#0f172a" });
    this.drawText(title, this.margin + 10, this.y + size + 2, { size, bold: true, color: "#0f172a" });
    this.y += size + 6 + (options.gapAfter ?? 8);
  }

  /** Parágrafo justificado à esquerda, com respiro entre parágrafos. */
  paragraph(text: string, options: { size?: number; color?: string } = {}): void {
    this.flowText(text, { size: options.size ?? 9, color: options.color ?? "#1f2937", gapAfter: 5 });
  }

  /**
   * Grelha de rótulo/valor — a ficha técnica da secção 1.
   *
   * Os valores quebram dentro da própria coluna: um endereço longo não invade a
   * coluna vizinha.
   */
  keyValueGrid(rows: { label: string; value: string }[], options: { columns?: number; labelWidth?: number } = {}): void {
    const columns = options.columns ?? 2;
    const labelWidth = options.labelWidth ?? 96;
    const cellWidth = this.contentWidth / columns;
    const size = 8.5;
    const lineHeight = size * 1.25;

    for (let index = 0; index < rows.length; index += columns) {
      const slice = rows.slice(index, index + columns);
      const wrapped = slice.map((row) => wrapText(row.value, cellWidth - labelWidth - 8, size));
      const height = Math.max(...wrapped.map((lines) => lines.length), 1) * lineHeight + 6;
      this.ensure(height);
      slice.forEach((row, column) => {
        const x = this.margin + column * cellWidth;
        this.drawText(row.label.toUpperCase(), x, this.y + size, { size: size - 1, bold: true, color: "#64748b" });
        wrapped[column].forEach((line, lineIndex) => {
          this.drawText(line, x + labelWidth, this.y + size + lineIndex * lineHeight, {
            size,
            bold: true,
            color: "#0f172a",
          });
        });
      });
      this.rect(this.margin, this.y + height - 2, this.contentWidth, 0.4, { fill: "#e2e8f0" });
      this.y += height;
    }
  }

  /** Lista de linhas "rótulo: valor", usada nas equipas e nos alertas. */
  labelledList(
    items: { label: string; value: string }[],
    options: { size?: number; labelWidth?: number } = {},
  ): void {
    const size = options.size ?? 8.5;
    const lineHeight = size * 1.3;
    const labelWidth = options.labelWidth ?? 150;
    for (const item of items) {
      const lines = wrapText(item.value, this.contentWidth - labelWidth, size);
      this.ensure(lines.length * lineHeight + 3);
      this.drawText(item.label, this.margin, this.y + size, { size, bold: true, color: "#0f172a" });
      lines.forEach((line, index) => {
        this.drawText(line, this.margin + labelWidth, this.y + size + index * lineHeight, {
          size,
          color: "#334155",
        });
      });
      this.y += lines.length * lineHeight + 3;
    }
  }

  /**
   * Tabela com cabeçalho repetido em cada página e linhas que não se partem.
   *
   * Uma linha que não caiba inteira vai para a página seguinte e o cabeçalho é
   * redesenhado lá, para a coluna continuar a dizer o que é.
   */
  table(options: PdfTableOptions): void {
    const size = options.size ?? 8.5;
    const lineHeight = size * 1.3;
    const padding = options.padding ?? 4;
    const total = options.columns.reduce((sum, column) => sum + column.weight, 0) || 1;
    const widths = options.columns.map((column) => (column.weight / total) * this.contentWidth);
    const progressColumn = options.progressColumn;
    const progressValues = options.progressValues ?? [];

    const drawHeader = () => {
      const height = lineHeight + padding * 2;
      this.rect(this.margin, this.y, this.contentWidth, height, { fill: options.headerFill ?? "#0f172a" });
      let x = this.margin;
      options.columns.forEach((column, index) => {
        this.drawText(column.title, x + 4, this.y + padding + lineHeight * 0.8, {
          size,
          bold: true,
          color: "#ffffff",
          align: column.align ?? "left",
        });
        x += widths[index];
      });
      this.y += height;
    };

    drawHeader();

    if (options.rows.length === 0) {
      this.ensure(lineHeight + padding * 2);
      this.drawText("Sem registos.", this.margin + 4, this.y + padding + lineHeight * 0.8, {
        size,
        color: "#64748b",
      });
      this.y += lineHeight + padding * 2;
      return;
    }

    options.rows.forEach((row, rowIndex) => {
      const cells = options.columns.map((column, index) =>
        wrapText(row[index] ?? "", widths[index] - 8, size),
      );
      const textHeight = Math.max(...cells.map((lines) => lines.length)) * lineHeight;
      const barHeight = progressColumn === undefined ? 0 : 10;
      const height = Math.max(textHeight, barHeight) + padding * 2;
      if (this.y + height > this.height - this.margin) {
        this.newPage();
        drawHeader();
      }
      if (rowIndex % 2 === 1) this.rect(this.margin, this.y, this.contentWidth, height, { fill: "#f8fafc" });
      let x = this.margin;
      cells.forEach((lines, index) => {
        const column = options.columns[index];
        if (progressColumn === index) {
          // A barra substitui o número: é o "avanço físico" da referência.
          const progress = Math.max(0, Math.min(100, progressValues[rowIndex] ?? 0));
          const trackWidth = widths[index] - 8;
          const top = this.y + padding;
          this.rect(x + 4, top, trackWidth, 6, { fill: "#e2e8f0" });
          this.rect(x + 4, top, (trackWidth * progress) / 100, 6, { fill: progressColor(progress) });
          this.drawText(`${progress}%`, x + 4, top + 15, { size, bold: true, color: "#0f172a" });
        } else {
          lines.forEach((line, lineIndex) => {
            this.drawText(line, x + 4, this.y + padding + lineHeight * 0.8 + lineIndex * lineHeight, {
              size,
              color: "#0f172a",
              align: column.align ?? "left",
            });
          });
        }
        x += widths[index];
      });
      this.rect(this.margin, this.y + height, this.contentWidth, 0.4, { fill: "#e2e8f0" });
      this.y += height;
    });
  }
/**
   * Rodapé em todas as páginas, já com a contagem final.
   *
   * `pages[0]` é o conteúdo vazio criado pelo construtor e nunca chega ao
   * ficheiro — por isso o índice do rodapé conta a partir do segundo elemento,
   * senão a última folha saía com "3/2".
   */
  stampFooters(text: string): void {
    const total = this.pageCount;
    const stamp = (page: string, index: number): string => {
      const size = 8;
      const label = `${text} · ${index + 1}/${total}`;
      const width = measureText(label, false) * size;
      const left = this.width - this.margin - width;
      const baseline = this.height - this.margin / 2;
      return (
        `${page}0.6 0.65 0.72 rg\n` +
        `BT /F1 ${size} Tf 1 0 0 1 ${left.toFixed(2)} ${(this.height - baseline).toFixed(2)} Tm ${hexString(label)} Tj ET\n`
      );
    };
    const finished = this.pages.slice(1).map((page, index) => stamp(page, index));
    this.pages = ["", ...finished];
    this.current = stamp(this.current, this.pages.length - 1);
  }

  /**
   * Monta o ficheiro.
   *
   * Numeração fixa para o que o trailer referencia: 1 catálogo, 2 páginas,
   * 3 e 4 as fontes, 5 a metadados, e a partir daí o par
   * (conteúdo, página) de cada folha. Determinístico: nem data nem
   * aleatoriedade entram no documento, portanto os mesmos desenhos dão sempre
   * os mesmos bytes.
   */
  build(): Uint8Array {
    const streams = [...this.pages.slice(1), this.current];
    const contents = streams.length ? streams : [""];

    const catalog = "<< /Type /Catalog /Pages 2 0 R >>";
    const pages = `<< /Type /Pages /Kids [${contents
      .map((_, index) => `${7 + index * 2} 0 R`)
      .join(" ")}] /Count ${contents.length} >>`;
    const fontRegular = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    const fontBold = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const info = `<< /Title ${hexString(this.info.title)} /Author ${hexString(this.info.author)} /Subject ${hexString(this.info.subject)} /Producer ${hexString("ArqVértice Flow")} >>`;

    const ordered: string[] = [catalog, pages, fontRegular, fontBold, info];
    contents.forEach((content, index) => {
      ordered.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
      ordered.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`,
      );
    });

    const chunks: string[] = ["%PDF-1.4\n%PDFGEN\n"];
    const offsets: number[] = [];
    let length = chunks[0].length;
    ordered.forEach((object, index) => {
      offsets.push(length);
      const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
      chunks.push(chunk);
      length += chunk.length;
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${ordered.length + 1}\n0000000000 65535 f \n`;
    for (const start of offsets) xref += `${String(start).padStart(10, "0")} 00000 n \n`;
    xref +=
      `trailer\n<< /Size ${ordered.length + 1} /Root 1 0 R /Info 5 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(xref);

    const text = chunks.join("");
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
    return bytes;
  }
}

/** Cor da barra de avanço — a legenda do cronograma de referência. */
export function progressColor(progress: number): string {
  if (progress >= 99) return "#ca8a04";
  if (progress >= 40) return "#65a30d";
  return "#38bdf8";
}
