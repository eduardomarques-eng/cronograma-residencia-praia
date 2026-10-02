"use client";

import { useState, useTransition } from "react";
import { createBriefingLinkAction, revokeBriefingLinkAction } from "@/app/actions/domain-actions";

export function BriefingLinkManager({ projectId, initialStatus }: { projectId: string; initialStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED"; initialLinkStatus: "ACTIVE" | "REVOKED" }) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  async function generate() {
    startTransition(async () => {
      const result = await createBriefingLinkAction(projectId);
      const value = `${window.location.origin}/briefing/${result.token}`;
      setLink(value);
      try { await window.navigator.clipboard.writeText(value); setMessage("Link gerado e copiado."); } catch { setMessage("Link gerado. Copie o endereço abaixo."); }
    });
  }
  return <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Briefing do cliente</p><h2 className="mt-1 font-semibold text-blue-950">Envie um link exclusivo e seguro</h2><p className="mt-1 text-sm text-blue-800">Status: {initialStatus === "SUBMITTED" ? "Enviado" : initialStatus === "IN_PROGRESS" ? "Em preenchimento" : "Não iniciado"}</p></div><button type="button" disabled={pending} onClick={generate} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">{pending ? "Gerando…" : "Gerar / regenerar link"}</button></div>{link ? <div className="mt-4 flex gap-2"><input readOnly value={link} aria-label="Link do briefing" className="min-h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-xs text-slate-600" /><a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-white px-3 text-xs font-semibold text-blue-700">Abrir</a></div> : null}<div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-blue-700">{message}</span><button type="button" onClick={() => { if (!window.confirm("Revogar o link atual? O cliente deixará de acessá-lo.")) return; startTransition(async () => { await revokeBriefingLinkAction(projectId); setLink(""); setMessage("Link revogado."); }); }} className="text-xs font-semibold text-rose-700">Revogar link</button></div></section>;
}
