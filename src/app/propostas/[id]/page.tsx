import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ProposalEditor, type ProposalEditorData } from "@/components/proposals/proposal-editor";
import { ProposalCommercialPanel } from "@/components/proposals/proposal-commercial-panel";
import { SignatureActions } from "@/components/proposals/signature-actions";
import { InsightsPanel } from "@/components/proposals/insights-panel";
import { getProposalCommercialInsights } from "@/server/services/commercial-service";
import { getProposal } from "@/server/services/proposal-service";

export const dynamic = "force-dynamic";

export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await getProposal(id);
  const insights = await getProposalCommercialInsights(id);
  const version = proposal.versions[0];
  const presentation = (version?.presentation as { slides?: Array<{ title?: string; body?: string }> } | null) ?? {};
  const formalText = (version?.formalText as { object?: string; validityDays?: number; conditions?: string } | null) ?? {};
  const rawServices = Array.isArray(version?.services) ? (version.services as Array<Record<string, unknown>>) : [];

  const initial: ProposalEditorData = {
    title: version?.title ?? "",
    slides: (presentation.slides ?? []).map((slide) => ({ title: String(slide?.title ?? ""), body: String(slide?.body ?? "") })),
    object: formalText.object ?? "",
    validityDays: formalText.validityDays ?? 30,
    conditions: formalText.conditions ?? "",
    services: rawServices.map((service) => ({
      name: String(service.name ?? ""),
      discipline: String(service.discipline ?? ""),
      unit: String(service.unit ?? "un."),
      quantity: String(service.quantity ?? 1),
      subtotal: String(service.subtotal ?? 0),
    })),
    adjustment: Number(version?.adjustment ?? 0),
    expiresAt: proposal.expiresAt ? proposal.expiresAt.toISOString().slice(0, 10) : "",
  };

  return (
    <AppShell eyebrow="Comercial">
      <Link href="/propostas" className="text-sm font-semibold text-blue-600">← Voltar para propostas</Link>
      <div className="mt-6">
        <SectionHeading
          title={initial.title || "Proposta"}
          description={`Cliente ${proposal.project.client.name} · projeto ${proposal.project.name} · status ${proposal.status} · versão ${version?.version ?? proposal.currentVersion}`}
        />
      </div>
      <ProposalCommercialPanel
        proposalId={proposal.id}
        status={proposal.status}
        clientPhone={proposal.project.client.phone}
        approvedVersion={proposal.approvedVersion}
        frozen={Boolean(version?.frozenAt)}
        contractStatus={proposal.contract?.status ?? null}
      />
      {/* Tópico 41: o preview usa o mesmo gerador da página do cliente, com os
          dados reais. É o que garante que o que o ADMIN vê é o que será enviado. */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Visualizar como o cliente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Abre exatamente a experiência do cliente, com os dados reais deste processo.
            </p>
          </div>
          <Link
            href={`/propostas/${proposal.id}/preview`}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Visualizar como o cliente
          </Link>
        </div>
      </Card>
      {proposal.contract ? (
        <Card className="mt-6">
          <h2 className="font-semibold text-slate-900">Contrato e assinatura</h2>
          <p className="mt-1 text-sm text-slate-500">
            Contrato versão {proposal.contract.version}
            {proposal.contract.templateVersion ? ` · template v${proposal.contract.templateVersion}` : ""} · status{" "}
            {proposal.contract.status}
          </p>
          <div className="mt-4">
            <SignatureActions
              contractId={proposal.contract.id}
              status={proposal.contract.signature?.status ?? null}
              provider={proposal.contract.signature?.provider ?? null}
            />
          </div>
        </Card>
      ) : null}
      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Recomendações do sistema</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sugestões determinísticas baseadas apenas em dados já cadastrados. Nada é aplicado sem sua autorização.
        </p>
        <div className="mt-4">
          <InsightsPanel insights={insights} />
        </div>
      </Card>
      <Card>
        <ProposalEditor proposalId={proposal.id} initial={initial} />
      </Card>
    </AppShell>
  );
}
