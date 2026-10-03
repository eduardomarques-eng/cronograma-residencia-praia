"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateContractAction, sendProposalWhatsAppAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";

export function ProposalCommercialPanel({
  proposalId,
  status,
  clientPhone,
  approvedVersion,
  frozen,
  contractStatus,
}: {
  proposalId: string;
  status: string;
  clientPhone?: string | null;
  approvedVersion?: number | null;
  frozen?: boolean;
  contractStatus?: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ url: string | null; link: string; message: string } | null>(null);
  const [busy, setBusy] = useState<"wa" | "contract" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendWhatsApp() {
    setBusy("wa");
    setError("");
    setNotice("");
    try {
      const result = await sendProposalWhatsAppAction(proposalId);
      setPreview({ url: result.url, link: result.link, message: result.message });
      setNotice(
        result.url
          ? "Link da proposta (re)gerado. Abra o WhatsApp para concluir o envio."
          : "Mensagem enviada ao WhatsApp do cliente.",
      );
      router.refresh();
    } catch {
      setError("Não foi possível preparar o envio. Verifique se o cliente tem WhatsApp cadastrado.");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("contract");
    setError("");
    setNotice("");
    try {
      await generateContractAction(proposalId);
      setNotice("Contrato gerado a partir da versão aprovada.");
      router.refresh();
    } catch {
      setError("Só é possível gerar o contrato após a aprovação da proposta pelo cliente.");
    } finally {
      setBusy(null);
    }
  }

  const approved = status === "APPROVED";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ações comerciais</p>
          <h2 className="mt-1 font-semibold text-slate-900">Envio, aprovação e contrato</h2>
          <p className="mt-1 text-sm text-slate-500">
            WhatsApp: {clientPhone || "não cadastrado"} · status {status}
            {approved && approvedVersion ? ` · versão aprovada ${approvedVersion}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={sendWhatsApp} disabled={busy !== null}>
            {busy === "wa" ? "Preparando…" : "ENVIAR PROPOSTA · WhatsApp"}
          </Button>
          <Button onClick={generate} disabled={busy !== null || !approved || Boolean(contractStatus)}>
            {contractStatus ? `CONTRATO ${contractStatus}` : "GERAR CONTRATO"}
          </Button>
        </div>
      </div>
      {approved && frozen ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Proposta aprovada e versão congelada. Alterações exigem uma nova versão.
        </p>
      ) : null}
      {notice ? <p className="mt-4 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p> : null}
      {preview ? (
        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Mensagem parametrizada pronta para o WhatsApp</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{preview.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {preview.url ? (
              <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white">Abrir WhatsApp</a>
            ) : null}
            <a href={preview.link} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-xs font-semibold text-blue-700">Ver link da proposta</a>
          </div>
        </div>
      ) : null}
    </section>
  );
}