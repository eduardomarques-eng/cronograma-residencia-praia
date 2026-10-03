"use client";

import { useState } from "react";
import Link from "next/link";
import { createProposalAction, createProposalLinkAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";

export function ProposalActions({ projectId, proposalId: initialProposalId }: { projectId: string; proposalId?: string }) {
  const [proposalId, setProposalId] = useState(initialProposalId);
  const [link, setLink] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function createOrLink() {
    setBusy(true);
    try {
      const proposal = proposalId ? { id: proposalId } : await createProposalAction(projectId);
      setProposalId(proposal.id);
      const result = await createProposalLinkAction(proposal.id);
      setLink(`${window.location.origin}/briefing-proposta/${result.token}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={createOrLink} disabled={busy}>{proposalId ? "Enviar proposta" : "Gerar proposta"}</Button>
        {proposalId ? <Link href={`/propostas/${proposalId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50">Editar</Link> : null}
      </div>
      {link ? <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><p className="font-semibold">Link seguro gerado</p><input readOnly value={link} aria-label="Link seguro da proposta" className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs" /></div> : null}
    </div>
  );
}
