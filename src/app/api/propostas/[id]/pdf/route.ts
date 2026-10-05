import { NextResponse } from "next/server";
import { getProposalPdfInput } from "@/server/services/proposal-service";
import { generateProposalPdf } from "@/lib/pdf/proposal-pdf";
import { createRequestContext, logError } from "@/server/observability";
import { DomainError } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * FASE 4C — PDF da proposta formal (item 58).
 *
 * Server-side, sem browser e sem dependência nova: reutiliza o `PdfWriter` que o
 * relatório de cronograma já usa. Ver `src/lib/pdf/proposal-pdf.ts` para a
 * decisão e a razão.
 *
 * Autorização: `getProposalPdfInput` chama `requireRole("ADMIN")` e resolve o
 * cliente e o projeto a partir da proposta. O `id` do URL não prova acesso
 * nenhum. Uma falha de autorização devolve "não encontrado", não 403 — um 403
 * confirmaria ao atacante que a proposta de outra pessoa existe (item 66).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id } = await params;
    // `versao` é opcional: sem ele, sai a versão PUBLICADA. O parâmetro existe
    // para o ADMIN conferir uma versão específica sem a republicar.
    const url = new URL(request.url);
    const raw = url.searchParams.get("versao");
    const versionNumber = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;

    const input = await getProposalPdfInput(id, versionNumber);

    const pdf = generateProposalPdf(input);
    const slug = input.projectName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
    // O nome inclui a VERSÃO: sem isso, duas impressões da mesma obra com
    // conteúdos diferentes ficam indistinguíveis na pasta do cliente.
    const filename = `Proposta_${input.code ?? slug}_v${input.version}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        // Documento comercial: nunca vai para cache partilhado nem para o
        // histórico do browser partilhado do equipamento do cliente.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Proposta não encontrada.", requestId }, { status: 404, headers: { "X-Request-Id": requestId } });
    }
    logError("proposal_pdf_failed", error, { requestId });
    return NextResponse.json(
      { error: "Não foi possível gerar o PDF da proposta.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}