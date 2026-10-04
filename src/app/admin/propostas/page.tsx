import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import Link from "next/link";
import { listProposals } from "@/server/services/proposal-service";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const proposals = await listProposals();
  return (
    <AppShell eyebrow="Comercial">
      <SectionHeading title="Propostas" description="Apresentações, propostas formais, versões e decisões do cliente." />
      <div className="grid gap-4">
        {proposals.length ? proposals.map((proposal) => {
          const version = proposal.versions[0];
          return <Link key={proposal.id} href={`/propostas/${proposal.id}`} className="block"><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{proposal.status}</p><h2 className="mt-2 text-xl font-bold text-slate-950">{version?.title ?? "Proposta"}</h2><p className="mt-1 text-sm text-slate-500">{proposal.project.client.name} · {proposal.project.name} · versão {version?.version ?? proposal.currentVersion}</p></div><strong className="text-lg text-slate-900">R$ {Number(version?.total ?? 0).toFixed(2).replace(".", ",")}</strong></div></Card></Link>;
        }) : <Card><p className="text-sm text-slate-500">Nenhuma proposta criada ainda.</p></Card>}
      </div>
    </AppShell>
  );
}
