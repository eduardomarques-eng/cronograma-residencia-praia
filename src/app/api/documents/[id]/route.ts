import { NextResponse } from "next/server";
import { downloadProjectDocument } from "@/server/services/document-service";
import { createRequestContext, logError } from "@/server/observability";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id } = await params;
    const { document, body } = await downloadProjectDocument(id);
    return new NextResponse(body, {
      headers: {
        "Content-Type": document.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.name.replace(/["\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    logError("document_download_failed", error, { requestId });
    return NextResponse.json(
      { error: "Documento não encontrado.", requestId },
      { status: 404, headers: { "X-Request-Id": requestId } },
    );
  }
}
