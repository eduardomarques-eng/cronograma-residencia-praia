import Link from "next/link";

type DocumentItem = { id: string; name: string; mimeType: string | null; sizeBytes: bigint | null; visibility: "INTERNAL" | "CLIENT"; createdAt: Date };

export function DocumentList({ documents, clientView = false }: { documents: DocumentItem[]; clientView?: boolean }) {
  if (!documents.length) return <p className="mt-3 text-sm text-slate-500">Nenhum documento disponível.</p>;
  return <div className="mt-3 divide-y divide-slate-100">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium text-slate-800">{document.name}</p><p className="text-xs text-slate-400">{document.mimeType ?? "Arquivo"}{document.sizeBytes ? ` · ${(Number(document.sizeBytes) / 1024 / 1024).toFixed(2)} MB` : ""}</p></div><Link href={`/api/documents/${document.id}`} className="font-semibold text-blue-700" target="_blank" rel="noreferrer">{clientView ? "Abrir" : "Baixar"}</Link></div>)}</div>;
}
