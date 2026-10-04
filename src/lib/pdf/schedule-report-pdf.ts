import { PdfWriter } from "./pdf-writer";
import {
  REPORT_DOCUMENT_KIND,
  REPORT_SUBTITLE,
  REPORT_TITLE,
  type ScheduleReport,
} from "../schedule-report";

/**
 * Desenha o relatório no PDF.
 *
 * Ordem e títulos seguem a secção 8 da referência ("Relatório Executivo de
 * Cronograma & Obras"): cabeçalho, ficha técnica, quadro técnico, fase actual,
 * parecer, avanço por disciplina, financeiro, quadro de etapas, critérios e
 * assinaturas. O que o documento mostra é o que a base tem — nenhum campo é
 * preenchido por omissão.
 */
export function renderScheduleReportPdf(report: ScheduleReport): Uint8Array {
  const writer = new PdfWriter({
    title: `${REPORT_TITLE} — ${report.ficha.find((row) => row.label === "Obra")?.value ?? ""}`,
    author: "ArqVértice Flow",
    subject: REPORT_DOCUMENT_KIND,
  });

  header(writer, report);

  writer.heading("1. DADOS DE ENTRADA E FICHA TÉCNICA DO PROJETO");
  writer.keyValueGrid(report.ficha);

  writer.heading("2. QUADRO TÉCNICO DE ENGENHARIA & ARQUITETURA");
  if (report.equipe.length === 0) {
    writer.paragraph("Nenhum responsável atribuído às etapas deste projeto.", { color: "#64748b" });
  } else {
    writer.labelledList(
      report.equipe.map((person) => ({
        label: person.name,
        value: `${person.disciplines} · ${person.stages} etapa(s) sob responsabilidade · ${person.progress}% concluído`,
      })),
    );
  }

  writer.heading("3. FASE ATUAL DO EMPREENDIMENTO");
  if (report.phases.length === 0) {
    writer.paragraph("Sem etapas cadastradas: não há fase a assinalar.", { color: "#64748b" });
  } else {
    writer.table({
      columns: [
        { title: "Fase / Disciplina", weight: 30 },
        { title: "Estado", weight: 20 },
        { title: "Etapas", weight: 16, align: "center" },
        { title: "Avanço", weight: 34 },
      ],
      rows: report.phases.map((phase) => [
        phase.current ? `${phase.discipline} (estamos aqui)` : phase.discipline,
        phase.state,
        `${phase.completed}/${phase.total}`,
        "",
      ]),
      progressColumn: 3,
      progressValues: report.phases.map((phase) => phase.progress),
    });
  }

  writer.heading("4. PARECER TÉCNICO EXECUTIVO DO CRONOGRAMA");
  for (const paragraph of report.parecer) writer.paragraph(paragraph);

  writer.heading("5. RESUMO DE AVANÇO FÍSICO POR DISCIPLINA");
  writer.labelledList(
    [
      {
        label: "Progresso geral",
        value: `${report.overall.progress}% · ${report.overall.completed} de ${report.overall.total} etapas concluídas`,
      },
      ...report.disciplines.map((discipline) => ({
        label: discipline.discipline,
        value: `${discipline.progress}% · ${discipline.completed}/${discipline.total} concluídas`,
      })),
    ],
    { size: 9 },
  );

  writer.heading("6. RESUMO FINANCEIRO DO PROJETO");
  writer.labelledList(report.financial.rows);
  writer.flowText(report.financial.nextPayment, { size: 8.5, color: "#0369a1", gapAfter: 6 });
  writer.table({
    columns: [
      { title: "Parcela", weight: 22 },
      { title: "Data prevista", weight: 16 },
      { title: "Data paga", weight: 16 },
      { title: "Etapa relacionada", weight: 22 },
      { title: "Status", weight: 12 },
      { title: "Valor", weight: 14, align: "right" },
    ],
    rows: report.financial.payments.map((payment) => [
      payment.name,
      payment.dueDate,
      payment.paidAt,
      payment.stage,
      payment.status,
      payment.amount,
    ]),
  });

  writer.heading("7. QUADRO CONSOLIDADO DE ETAPAS & ENTREGAS");
  writer.table({
    columns: [
      { title: "Descrição / Etapa", weight: 26 },
      { title: "Disciplina", weight: 14 },
      { title: "Responsável Técnico", weight: 17 },
      { title: "Data Limite", weight: 13 },
      { title: "Avanço Físico", weight: 15 },
      { title: "Status", weight: 15 },
    ],
    rows: report.stages.map((stage) => [
      stage.name,
      stage.discipline,
      stage.designer,
      stage.dueDate,
      "",
      stage.alertDetail,
    ]),
    progressColumn: 4,
    progressValues: report.stages.map((stage) => stage.completion),
  });

  writer.heading("8. CRITÉRIOS OFICIAIS DE ACOMPANHAMENTO");
  writer.labelledList(
    report.criteria.map((criterion) => ({ label: criterion.label, value: criterion.description })),
    { size: 8 },
  );

  writer.heading("8.1 ALERTAS DO CRONOGRAMA", { gapAfter: 4 });
  if (report.alertRows.length === 0) {
    writer.paragraph("Nenhuma etapa em atraso, bloqueada ou com prazo próximo.", { color: "#15803d" });
  } else {
    writer.table({
      columns: [
        { title: "Etapa", weight: 44 },
        { title: "Situação", weight: 36 },
        { title: "Prioridade", weight: 20 },
      ],
      rows: report.alertRows.map((row) => [row.stage, row.detail, row.priority]),
      headerFill: "#b91c1c",
    });
  }

  signatures(writer, report);
  writer.stampFooters(REPORT_DOCUMENT_KIND);
  return writer.build();
}

function header(writer: PdfWriter, report: ScheduleReport): void {
  writer.drawText(REPORT_TITLE, writer.margin, writer.y + 16, {
    size: 15,
    bold: true,
    color: "#0f172a",
  });
  writer.y += 20;
  writer.drawText(REPORT_SUBTITLE, writer.margin, writer.y + 8, {
    size: 8.5,
    bold: true,
    color: "#475569",
  });
  writer.y += 12;
  writer.drawText(`Emissão: ${report.emittedAtLabel}`, writer.width - writer.margin, writer.y + 8, {
    size: 8.5,
    color: "#0f172a",
    align: "right",
  });
  writer.drawText(`Status Geral: ${report.statusGeral}`, writer.width - writer.margin, writer.y + 19, {
    size: 8.5,
    bold: true,
    color: report.statusGeralTone === "green" ? "#065f46" : "#1e40af",
    align: "right",
  });
  writer.y += 26;
  writer.rect(writer.margin, writer.y, writer.contentWidth, 1.6, { fill: "#0f172a" });
  writer.y += 12;
}

function signatures(writer: PdfWriter, report: ScheduleReport): void {
  writer.ensure(80);
  writer.rect(writer.margin, writer.y, writer.contentWidth, 0.8, { fill: "#0f172a" });
  writer.y += 14;
  const column = writer.contentWidth / 2;
  report.signatures.forEach((person, index) => {
    const left = writer.margin + (index % 2) * column;
    const top = writer.y + Math.floor(index / 2) * 34;
    writer.rect(left + 8, top + 18, column - 24, 0.7, { fill: "#0f172a" });
    writer.drawText(person.name, left + 8, top + 13, { size: 9, bold: true, color: "#0f172a" });
    writer.drawText(person.role, left + 8, top + 3, { size: 7.5, color: "#475569" });
  });
  writer.y += Math.ceil(report.signatures.length / 2) * 34 + 6;
  writer.drawText(
    "Documento de acompanhamento físico · ArqVértice · gerado a partir dos dados registados no sistema",
    writer.width / 2,
    writer.y + 8,
    { size: 7.5, color: "#64748b", align: "center" },
  );
}
