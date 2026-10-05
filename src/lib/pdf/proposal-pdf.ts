import { PdfWriter, type PdfTableOptions } from "./pdf-writer";
import { readPaymentPlanSnapshot } from "@/lib/payment-plan";
import { readProposalItems, computeTotals, type ProposalItem } from "@/lib/proposal-item";
import { formatCurrencyBRL } from "@/lib/contract-template";

/**
 * FASE 4C — PROPOSTA FORMAL EM PDF (itens 37, 58 e 60).
 *
 * Três decisões de arquitectura, e a razão de cada uma:
 *
 *  1. **Server-side, sem dependências novas.** O projecto já tem `PdfWriter`, um
 *     escritor PDF 1.4 sem dependências, usado no relatório de cronograma. O
 *     item 58 manda auditar o que existe antes de instalar Puppeteer/Playwright:
 *     instalar um Chromium de centenas de MB para desenhar um documento que o
 *     escritor existente produz em milissegundos seria a solução mais pesada e a
 *     que mais falha em ambiente serverless.
 *
 *  2. **Uma única fonte.** Este gerador consome a MESMA `ProposalVersion` que a
 *     página pública, o preview do ADMIN e o contrato. Não recalcula nada: usa
 *     `readProposalItems` e `readPaymentPlanSnapshot`, as funções que os outros
 *     usam. É o que torna o item 60 verificável — se o PDF e o ecrã divergissem,
 *     haveria duas regras de leitura da versão.
 *
 *  3. **Determinístico.** Sem relógio e sem aleatoriedade: os mesmos dados
 *     produzem os mesmos bytes. Um PDF que muda a cada geração não pode ser
 *     comparado, nem guardado em cache, nem serve de prova de qual versão o
 *     cliente recebeu.
 */

export type ProposalPdfInput = {
  /** Identificação comercial (item 3). */
  code: string | null;
  title: string;
  version: number;
  clientName: string;
  projectName: string;
  projectDescription?: string | null;
  /** As MESMAS linhas que o editor, o preview e o contrato leem. */
  services: unknown;
  total: number;
  adjustment: number;
  /** Plano CONGELADO na versão (item 31). Nunca recalculado aqui. */
  frozenPaymentPlan: unknown;
  formalText: unknown;
  validityDays: number | null;
  expiresAt: Date | null;
  issuedAt: Date;
  company: { name: string; document: string | null };
};

const MUTED = "#64748b";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** Uma linha da tabela de serviços, com o preço CONGELADO da versão. */
function serviceRow(item: ProposalItem): string[] {
  return [
    item.name,
    String(item.quantity).replace(".", ","),
    item.unit ?? "un.",
    formatCurrencyBRL(item.unitPrice),
    formatCurrencyBRL(item.subtotal),
  ];
}

/**
 * Constrói o PDF da proposta formal.
 *
 * Devolve os BYTES, não o writer: quem chama decide se grava em disco, envia
 * por resposta HTTP ou anexa ao módulo de documentos.
 */
export function generateProposalPdf(input: ProposalPdfInput): Uint8Array {
  const items = readProposalItems(input.services);
  const totals = computeTotals(items, Number(input.adjustment ?? 0));
  const formalText = asRecord(input.formalText);
  const plan = readPaymentPlanSnapshot(input.frozenPaymentPlan);

  const pdf = new PdfWriter({
    title: input.title || "Proposta comercial",
    author: input.company.name,
    subject: `${input.projectName} — versão ${input.version}`,
  });

  /* Capa — identificação (item 37). */
  pdf.drawText(input.company.name.toUpperCase(), pdf.margin, 64, { size: 11, bold: true, color: MUTED });
  pdf.heading("PROPOSTA COMERCIAL", { size: 22, gapAfter: 4 });
  pdf.paragraph(input.title, { size: 11, color: MUTED });
  pdf.ensure(24);
  pdf.keyValueGrid(
    [
      { label: "Proposta", value: input.code ?? "—" },
      { label: "Versão", value: String(input.version) },
      { label: "Cliente", value: input.clientName },
      { label: "Projeto", value: input.projectName },
      { label: "Emissão", value: formatDateBR(input.issuedAt) },
      { label: "Validade", value: input.validityDays ? `${input.validityDays} dias` : "—" },
      ...(input.expiresAt ? [{ label: "Válida até", value: formatDateBR(input.expiresAt) }] : []),
      ...(input.company.document ? [{ label: "Identificação", value: input.company.document }] : []),
    ],
    { columns: 2 },
  );

  /* Objecto e escopo (itens 25, 26 e 37). */
  const object = text(formalText.object);
  if (object) {
    pdf.ensure(40);
    pdf.heading("1. Objecto");
    pdf.paragraph(object);
  }

  /* Serviços contratados (item 18). */
  pdf.ensure(70);
  pdf.heading("2. Serviços contratados");
  const obrigatorias = items.filter((item) => !item.optional);
  const opcionais = items.filter((item) => item.optional);

  if (items.length === 0) {
    pdf.paragraph("Nenhum serviço incluído nesta versão.", { color: MUTED });
  } else {
    const table: PdfTableOptions = {
      columns: [
        { title: "Serviço", weight: 3 },
        { title: "Qtd.", weight: 1, align: "right" },
        { title: "Unidade", weight: 1, align: "right" },
        { title: "Valor unitário", weight: 1.5, align: "right" },
        { title: "Subtotal", weight: 1.5, align: "right" },
      ],
      rows: [
        ...obrigatorias.map(serviceRow),
        ...opcionais.map((item) => [...serviceRow(item), "opcional"]),
      ],
      headerFill: "#f1f5f9",
    };
    pdf.table(table);

    // O total é impresso a partir de `computeTotals` — a mesma função que
    // gravou o número na base. Se os dois divergissem, o PDF estaria a mostrar
    // um valor que o cliente nunca aprovou.
    //
    // `flowText` alinha pela margem esquerda; para alinhar à direita usa-se
    // `drawText` com a borda direita da área útil como origem.
    const rightEdge = pdf.margin + pdf.contentWidth;
    pdf.ensure(46);
    pdf.drawText(`Subtotal: ${formatCurrencyBRL(totals.contractedSubtotal)}`, rightEdge, pdf.y + 10, {
      size: 10,
      bold: true,
      align: "right",
    });
    pdf.y += 14;
    if (totals.adjustment !== 0) {
      pdf.drawText(
        `${totals.adjustment < 0 ? "Desconto" : "Acréscimo"}: ${formatCurrencyBRL(totals.adjustment)}`,
        rightEdge,
        pdf.y + 10,
        { size: 10, align: "right" },
      );
      pdf.y += 14;
    }
    pdf.drawText(`TOTAL: ${formatCurrencyBRL(totals.total)}`, rightEdge, pdf.y + 13, {
      size: 13,
      bold: true,
      align: "right",
    });
    pdf.y += 20;
  }

  /* Opcional separado (item 17): nunca somado ao total, sempre visível. */
  if (opcionais.length > 0) {
    pdf.ensure(50);
    pdf.heading("2.1 Serviços opcionais");
    pdf.paragraph(
      `Os serviços abaixo NÃO estão incluídos no valor total. Se contratados, acrescem ${formatCurrencyBRL(totals.optionalSubtotal)}.`,
      { color: MUTED },
    );
    pdf.labelledList(
      opcionais.map((item) => ({ label: item.name, value: formatCurrencyBRL(item.subtotal) })),
    );
  }

  /* Incluído / não incluído (itens 25 e 26). */
  const included = text(formalText.included);
  const excluded = text(formalText.excluded);
  if (included || excluded) {
    pdf.ensure(60);
    pdf.heading("3. Incluído e não incluído");
    if (included) {
      pdf.drawText("Incluído", pdf.margin, pdf.y, { size: 10, bold: true });
      pdf.y += 12;
      pdf.paragraph(included);
    }
    if (excluded) {
      pdf.ensure(40);
      pdf.drawText("Não incluído", pdf.margin, pdf.y, { size: 10, bold: true });
      pdf.y += 12;
      pdf.paragraph(excluded);
    }
  }

  /* Premissas (item 27). */
  const premisses = Array.isArray(formalText.premisses)
    ? (formalText.premisses as unknown[]).map(String).filter((value) => value.trim())
    : text(formalText.premises)
      ? [text(formalText.premises)!]
      : [];
  if (premisses.length > 0) {
    pdf.ensure(60);
    pdf.heading("4. Premissas");
    // Cada premissa é uma linha de texto corrido, não um par rótulo/valor: o
    // enunciado é o que importa e truncá-lo numa coluna de valor seria enganador.
    premisses.forEach((premise) => pdf.flowText(`• ${premise}`, { size: 9, color: "#1f2937", gapAfter: 3 }));
  }

  /* Condição de pagamento (itens 30 a 32). */
  pdf.ensure(70);
  pdf.heading("5. Condição de pagamento");
  if (plan && plan.installments.length > 0) {
    pdf.table({
      columns: [
        { title: "Parcela", weight: 3 },
        { title: "%", weight: 1, align: "right" },
        { title: "Valor", weight: 1.5, align: "right" },
      ],
      rows: plan.installments.map((installment, index) => [
        `${index + 1}. ${installment.label}`,
        `${String(installment.percent).replace(".", ",")}%`,
        formatCurrencyBRL(installment.amount),
      ]),
      headerFill: "#f1f5f9",
    });
    const methods = text(formalText.metodoPagamento);
    if (methods) pdf.paragraph(`Método: ${methods}`, { color: MUTED });
  } else {
    // Item 31: um plano ausente é um dado a reportar, não um espaço em branco.
    // O PDF nunca "adivinha" uma condição de pagamento.
    pdf.paragraph("Condição de pagamento não definida nesta versão.", { color: MUTED });
  }

  /* Condições e observações (itens 26 e 27). */
  const conditions = text(formalText.conditions);
  const observations = text(formalText.observations);
  if (conditions || observations) {
    pdf.ensure(60);
    pdf.heading("6. Condições e observações");
    if (conditions) pdf.paragraph(conditions);
    if (observations) pdf.paragraph(observations, { color: MUTED });
  }

  /* Aceite (item 37). */
  pdf.ensure(90);
  pdf.heading("7. Aceite");
  pdf.paragraph(
    "A aprovação é registada electronicamente através do link seguro desta proposta e identifica a versão apresentada neste documento.",
    { color: MUTED },
  );
  pdf.ensure(60);
  pdf.drawText("Data: ____________________", pdf.margin, pdf.y, { size: 10 });
  pdf.drawText("Assinatura do cliente: ____________________", pdf.margin, pdf.y + 26, { size: 10 });

  // O rodapé identifica a versão em TODAS as páginas. Numa proposta impressa
  // em papel, "qual versão é esta?" tem de ser respondível sem voltar ao sistema.
  pdf.stampFooters(`${input.code ?? "Proposta"} · v${input.version} · ${input.projectName}`);
  return pdf.build();
}