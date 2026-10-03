"use client";

import { useState, useTransition } from "react";
import { uploadProjectDocumentAction } from "@/app/actions/domain-actions";

export function DocumentUploader({ projectId }: { projectId: string }) {
  const [visibility, setVisibility] = useState<"INTERNAL" | "CLIENT">("INTERNAL");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="mt-4 space-y-3" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("Enviando…");
    startTransition(async () => {
      try {
        await uploadProjectDocumentAction(projectId, data);
        form.reset();
        setVisibility("INTERNAL");
        setMessage("Documento enviado.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível enviar o documento.");
      }
    });
  }}>
    <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" required disabled={pending} className="block w-full text-sm" />
    <input type="hidden" name="visibility" value={visibility} />
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-slate-600">Disponibilidade
        <select value={visibility} onChange={(event) => setVisibility(event.target.value as "INTERNAL" | "CLIENT")} className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm">
          <option value="INTERNAL">Somente ADMIN</option>
          <option value="CLIENT">Liberado ao cliente</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Enviando…" : "Enviar documento"}</button>
    </div>
    {message ? <p role="status" className="text-sm text-slate-500">{message}</p> : null}
  </form>;
}
