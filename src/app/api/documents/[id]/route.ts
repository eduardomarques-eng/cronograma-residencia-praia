import { NextResponse } from "next/server";
import { downloadProjectDocument } from "@/server/services/document-service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { document, body } = await downloadProjectDocument(id);
    return new NextResponse(body, {
      headers: {
        "Content-Type": document.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${document.name.replace(/["\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
}
