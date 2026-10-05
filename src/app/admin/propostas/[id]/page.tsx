import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ProposalEditor, type ProposalEditorData } from "@/components/proposals/proposal-editor";
import { StudioEditor } from "@/components/studio/studio-editor";
import { readStudioDeck } from "@/lib/studio-deck";
import { readCommercialData } from "@/lib/studio-commercial";
import { ProposalCommercialPanel } from "@/components/proposals/proposal-commercial-panel";
import { SignatureActions } from "@/components/proposals/signature-actions";
import { ProposalSendActions } from "@/components/proposals/proposal-send-actions";
import { InsightsPanel } from "@/components/proposals/insights-panel";
import { getProposalCommercialInsights } from "@/server/services/commercial-service";
import { Badge } from "@/components/ui/badge";
import { getProposal, getProposalSuggestions } from "@/server/services/proposal-service";
import { listServiceCatalog } from "@/server/services/service-catalog-service";
import { readProposalItems } from "@/lib/proposal-item";
import { UNIT_LABELS, type ServiceUnitName } from "@/lib/pricing";
import { formatCurrencyBRL } from "@/lib/contract-template";
export const dynamic = "force-dynamic";

/** Texto de um campo Json, ou string vazia. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * FASE 4C — A PÁGINA DA PROPOSTA.
 *
 * Esta página responde às perguntas do item 61 sem que o ADMIN tenha de abrir o
 * formulário: quem é o cliente, que projeto, que versão, que status, que
 * serviços, que valor, se foi enviada, se foi vista e se foi aprovada.
 *
 * Os dados que alimentam o editor são resolvidos AQUI, no servidor. O
 * `proposalId` chega da rota, mas o cliente, o projeto e o catálogo são lidos do
 * banco — nunca do que o frontend envia (item 65).
 */
export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [proposal, insights, suggestions, catalog] = await Promise.all([
    getProposal(id),
    getProposalCommercialInsights(id),
    // O prefill vem do PROJETO, resolvido no servidor (itens 5 e 65).
    getProposalSuggestions(id),
    listServiceCatalog({ includeInactive: false }),
  ]);

  const version = proposal.versions[0];
  const presentation = (version?.presentation ?? {}) as {
    slides?: Array<{ title?: string; body?: string }>;
    portfolioOverrides?: Record<string, string>;
  };
  const formalText = (version?.formalText ?? {}) as Record<string, unknown>;
  const items = readProposalItems(version?.services);
  const frozen = Boolean(version?.frozenAt);
  const pricing = (version?.pricing ?? null) as { adjustmentReason?: unknown } | null;

  /*
   * Dados comerciais para o Studio (itens 26 a 30).
   *
   * São lidos AQUI, no servidor, e passados como dados — o componente não vai
   * buscá-los sozinho. É o que garante que a tabela de investimento, o cronograma
   * e as parcelas que o ADMIN vê são exactamente os desta VERSÃO, e não uma
   * segunda leitura feita no browser.
   *
   * `Number(...)` converte os `Decimal` do Prisma: a regra do projecto é que o
   * `Decimal` chegue à interface já convertido, e um `Decimal` serializado
   * atravessa o Server Component como `{}`.
   */
  const commercial = version
    ? readCommercialData({
        services: version.services,
        subtotal: Number(version.subtotal ?? 0),
        adjustment: Number(version.adjustment ?? 0),
        total: Number(version.total ?? 0),
        paymentPlan: version.paymentPlan,
      })
    : null;

  const initial: ProposalEditorData = {
    proposalId: proposal.id,
    status: proposal.status,
    code: proposal.code ?? null,
    version: version?.version ?? proposal.currentVersion,
    approvedVersion: proposal.approvedVersion ?? null,
    title: version?.title ?? "",
    slides: (presentation.slides ?? []).map((slide) => ({
      title: String(slide?.title ?? ""),
      body: String(slide?.body ?? ""),
    })),
    object: text(formalText.object),
    conditions: text(formalText.conditions),
    included: text(formalText.included),
    excluded: text(formalText.excluded),
    premisses: Array.isArray(formalText.premises)
      ? formalText.premises.map(String).join("\n")
      : text(formalText.premises),
    observations: text(formalText.observations),
    validityDays: typeof formalText.validityDays === "number" ? formalText.validityDays : 30,
    expiresAt: proposal.expiresAt ? proposal.expiresAt.toISOString().slice(0, 10) : "",
    paymentTerms: text(formalText.formaPagamento),
    lines: items.map((item) => ({
      serviceId: item.serviceId ?? "",
      name: item.name,
      discipline: item.discipline ?? "",
      unit: item.unit ?? "un.",
      quantity: String(item.quantity).replace(".", ","),
      unitPrice: String(item.unitPrice).replace(".", ","),
      optional: item.optional,
      notes: item.notes ?? "",
    })),
    adjustment: Number(version?.adjustment ?? 0),
    // O motivo vive no snapshot de preço congelado — é a única fonte que
    // sobrevive a uma edição posterior da proposta.
    adjustmentReason: typeof pricing?.adjustmentReason === "string" ? pricing.adjustmentReason : "",
    catalog: catalog.map((service) => ({
      id: service.id,
      name: service.name,
      discipline: service.discipline,
      unit: UNIT_LABELS[service.unit as ServiceUnitName] ?? service.unit,
      baseMedium: service.baseMedium,
    })),
    suggestions: (suggestions?.suggestions ?? []).map((suggestion) => ({
      serviceId: suggestion.serviceId,
      name: suggestion.name,
      discipline: suggestion.discipline,
      unit: suggestion.unit,
      basePrice: suggestion.basePrice,
      suggestedQuantity: suggestion.suggestedQuantity,
      reason: suggestion.reason,
    })),
    provenance: suggestions?.input.evidence ?? [],
    portfolioOverrides: presentation.portfolioOverrides ?? {},
  };

  const obrigatorias = items.filter((item) => !item.optional);
  const opcionais = items.filter((item) => item.optional);
  const somaObrigatorias = obrigatorias.reduce((sum, item) => sum + item.subtotal, 0);
  const somaOpcionais = opcionais.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <AppShell eyebrow="Comercial">
      <Link href="/admin/propostas" className="text-sm font-semibold text-blue-600">
        ← Voltar para propostas
      </Link>

      <div className="mt-6">
        <SectionHeading
          title={initial.title || "Proposta"}
          description={`Cliente ${proposal.project.client.name} · projeto ${proposal.project.name} · status ${proposal.status}`}
        />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Código</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{proposal.code ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Versão</p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            v{initial.version}
            {frozen ? <span className="ml-2 text-xs font-semibold text-emerald-700">congelada</span> : null}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total contratado</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{formatCurrencyBRL(Number(version?.total ?? 0))}</p>
          {opcionais.length ? (
            <p className="mt-1 text-xs text-amber-700">+ {formatCurrencyBRL(somaOpcionais)} opcionais</p>
          ) : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Decisão</p>
          <p className="mt-1">
            {proposal.approvedAt || proposal.rejectedAt ? (
              <Badge tone={proposal.status === "APPROVED" ? "green" : "red"}>
                {proposal.status === "APPROVED" ? "Aprovada" : "Recusada"} · v{proposal.approvedVersion}
              </Badge>
            ) : proposal.viewedAt ? (
              <Badge tone="blue">Visualizada</Badge>
            ) : proposal.sentAt ? (
              <Badge tone="blue">Enviada</Badge>
            ) : (
              <Badge tone="neutral">Rascunho</Badge>
            )}
          </p>
        </Card>
      </div>

      {items.length ? (
        <Card className="mt-6">
          <h2 className="font-semibold text-slate-900">Serviços desta versão</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {obrigatorias.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
                <span className="text-slate-700">
                  {item.name} · {item.quantity} {item.unit}
                  {item.priceOverridden ? <span className="ml-2 text-xs text-amber-700">preço ajustado</span> : null}
                </span>
                <strong className="text-slate-900">{formatCurrencyBRL(item.subtotal)}</strong>
              </div>
            ))}
            {opcionais.map((item, index) => (
              <div key={`opt-${item.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-2 text-sm text-amber-800">
                <span>
                  {item.name} · {item.quantity} {item.unit} <em>(opcional)</em>
                </span>
                <strong>{formatCurrencyBRL(item.subtotal)}</strong>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-950">
            <span>Subtotal contratado</span>
            <span>{formatCurrencyBRL(somaObrigatorias)}</span>
          </div>
        </Card>
      ) : null}

      <ProposalCommercialPanel
        proposalId={proposal.id}
        status={proposal.status}
        clientPhone={proposal.project.client.phone}
        approvedVersion={proposal.approvedVersion}
        frozen={frozen}
        contractStatus={proposal.contract?.status ?? null}
      />

      {/* Tópico 41: o preview usa o mesmo gerador da página do cliente, com os
          dados reais. É o que garante que o que o ADMIN vê é o que será enviado. */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Visualizar como o cliente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Abre exactamente a experiência do cliente, com os dados reais deste processo.
            </p>
          </div>
          <Link
            href={`/admin/propostas/${proposal.id}/preview`}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Visualizar como o cliente
          </Link>
        </div>
      </Card>

      {/*
        FASE 4D — ENVIAR (itens 41 e 42).

        Fica ao lado do contrato e não dentro dele: enviar é uma acção comercial
        sobre a PROPOSTA, e o contrato é o que nasce da aprovação. Misturar os dois
        fazia o ADMIN assinar e enviar com um clique, sem ver o que ia para o
        cliente.

        Desliga-se quando a proposta está aprovada: reabrir um ciclo encerrado
        seria devolver um cliente a um documento que já assinou.
      */}
      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Enviar ao cliente</h2>
        <p className="mt-1 text-sm text-slate-500">
          A mensagem vem do template configurado em Mensagens, com o telefone e o e-mail do cliente. Sem serviço de
          WhatsApp configurado, o botão abre o WhatsApp com o texto preparado — não envia por si.
        </p>
        <div className="mt-4">
          <ProposalSendActions
            proposalId={proposal.id}
            encerrada={proposal.status === "APPROVED" || proposal.status === "REJECTED" || frozen}
          />
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

      {/*
        FASE 4C — O STUDIO (item 9).
        *
        * O `readStudioDeck` NORMALIZA o que está gravado. Uma proposta antiga só
        * tem `{ title, body }` por página: o modelo rico nasce vazio à volta
        * disso, e é por isso que abrir esta página nunca quebra uma proposta já
        * publicada.
        *
        * A aprovação desliga a edição, exactamente como desliga o resto — o
        * contrato não pode deixar de ser o que o cliente assinou.
      */}
      <Card className="mt-6">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900">Apresentação</h2>
          <p className="mt-1 text-sm text-slate-500">
            Páginas, imagens e temas da proposta. Editar a apresentação não altera o orçamento: os valores continuam a vir da
            versão desta proposta.
          </p>
        </div>
        <StudioEditor
          initialDeck={readStudioDeck(presentation)}
          proposalId={proposal.id}
          readOnly={frozen || Boolean(proposal.approvedVersion)}
          commercial={commercial}
        />
      </Card>

      <Card className="mt-6">
        <ProposalEditor initial={initial} />
      </Card>
    </AppShell>
  );
}

