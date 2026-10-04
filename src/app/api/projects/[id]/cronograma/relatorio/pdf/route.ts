import { NextResponse } from "next/server";
import { getScheduleReport } from "@/server/services/schedule-report-service";
import { renderScheduleReportPdf } from "@/lib/pdf/schedule-report-pdf";
import { createRequestContext, logError } from "@/server/observability";
import { DomainError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * PDF do relatório de cronograma — server-side, sem browser.
 *
 * O `projectId` chega do pedido e não prova acesso nenhum: quem autoriza é
 * `getScheduleReport`, que percorre `Project → Client/ProjectAccess`. Por isso
 * qualquer falha de autorização devolve a MESMA resposta de "não encontrado":
 * um 403 confirmaria ao atacante que o projecto de outra pessoa existe.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id } = await params;
    const bundle = await getScheduleReport(id);
    if (!bundle) {
      return NextResponse.json(
        { error: "Relatório não encontrado.", requestId },
        { status: 404, headers: { "X-Request-Id": requestId } },
      );
    }

    const pdf = renderScheduleReportPdf(bundle.report);
    // Nome com a obra e a data: o cliente acumula versões do mesmo relatório.
    const slug = bundle.projectName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
    const filename = `Cronograma_${slug || "obra"}_${bundle.report.emittedAtLabel.replace(/\//g, "-")}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Relatório não encontrado.", requestId },
        { status: 404, headers: { "X-Request-Id": requestId } },
      );
    }
    logError("schedule_report_pdf_failed", error, { requestId });
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}