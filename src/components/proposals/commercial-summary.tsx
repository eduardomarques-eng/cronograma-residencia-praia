import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CommercialTimeline } from "@/components/proposals/commercial-timeline";
import { formatCurrencyBRL } from "@/lib/contract-template";
import type { TimelineStep } from "@/lib/commercial-timeline";

type CommercialSummaryData = {
  proposal: { id: string; status: string; total: number; version: number | null } | null;
  contract: { id: string; status: string; version: number } | null;
  signature: { status: string; label: string; provider: string } | null;
  service: { status: string; label: string };
  timeline: TimelineStep[];
};

function Block({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${muted ? "text-slate-400" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

/** Tópicos 28 e 29 — mesma ficha do projeto, sem sistema isolado. */
export function CommercialSummary({ summary }: { summary: CommercialSummaryData }) {
  return (
    <Card className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Comercial</p>
      <h2 className="mt-1 font-semibold text-slate-950">Proposta, contrato e serviço</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Block
          label="Proposta"
          value={
            summary.proposal
              ? `${formatCurrencyBRL(summary.proposal.total)} · ${summary.proposal.status}`
              : "Não criada"
          }
          muted={!summary.proposal}
        />
        <Block label="Contrato" value={summary.contract?.status ?? "Não gerado"} muted={!summary.contract} />
        <Block
          label="Assinatura"
          value={summary.signature ? `${summary.signature.label} · ${summary.signature.provider}` : "Não solicitada"}
          muted={!summary.signature}
        />
        <Block label="Serviço" value={summary.service.label} />
      </div>
      {summary.proposal ? (
        <Link href={`/propostas/${summary.proposal.id}`} className="mt-4 inline-block text-sm font-semibold text-blue-700">
          Abrir proposta e contrato
        </Link>
      ) : null}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="font-semibold text-slate-900">Linha do tempo comercial</h3>
        <div className="mt-3">
          <CommercialTimeline steps={summary.timeline} />
        </div>
      </div>
    </Card>
  );
}