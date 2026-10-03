import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Card } from "@/components/ui/card";
import { ProposalDecision } from "@/components/proposals/proposal-decision";
import { ProposalPresentation } from "@/components/proposals/proposal-presentation";
import { loadPublicProposalDocument } from "@/server/services/preview-service";
import { RateLimitError, resolveClientKey } from "@/lib/proposal-access";
import { formatCurrencyBRL } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

/**
 * Página pública da proposta.
 *
 * Prompt 18, item 4: esta página NÃO consulta a proposta directamente. Recebe um
 * DTO já reduzido à lista de publicação, portanto é impossível, a partir daqui,
 * acidentalmente expor um campo interno — mesmo que alguém adicione um campo ao
 * `include` do loader.
 */
export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  // Tópico 35: a origem é calculada por uma função partilhada com a Server
  // Action de decisão, para que leitura e aprovação caiam no mesmo balde.
  const clientKey = resolveClientKey(requestHeaders);

  let document;
  try {
    document = await loadPublicProposalDocument({ token, clientKey });
  } catch (error) {
    // Não revelamos se o token existe, expirou ou foi revogado: a resposta é
    // sempre a mesma. A distinção fica apenas nos logs do servidor.
    if (error instanceof RateLimitError) {
      throw new Error("Muitas consultas ao link. Aguarde um instante e tente novamente.");
    }
    notFound();
  }

  const decided = document.status === "APPROVED" || document.status === "REJECTED";
  const validityDays = document.validityDays ?? 30;

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-slate-950 p-8 text-white md:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            ArqVértice Flow · proposta
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">{document.title}</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Uma leitura clara do escopo, das condições e do investimento para o seu projeto.
          </p>
        </header>

        <ProposalPresentation
          clientName={document.clientName}
          projectName={document.projectName}
          title={document.title}
          slides={document.slides}
        />

        <Card>
          <h2 className="text-2xl font-bold text-slate-950">Escopo e investimento</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {document.services.map((service, index) => (
              <div key={`${service.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                <span>
                  {service.name} · {service.quantity ?? 1} {service.unit ?? "un."}
                </span>
                <strong>{formatCurrencyBRL(service.subtotal)}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between border-t border-slate-200 pt-5 text-lg font-bold">
            <span>Valor final</span>
            <span>{formatCurrencyBRL(document.total)}</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {document.conditions ?? `Validade: ${validityDays} dias.`}
          </p>
        </Card>

        {document.paymentPlan.length ? (
          <Card>
            <h2 className="text-2xl font-bold text-slate-950">Condição de pagamento</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {document.paymentPlan.map((installment) => (
                <div key={installment.order} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                  <span className="text-slate-700">
                    {installment.order}. {installment.label} ({installment.percent}%)
                  </span>
                  <strong>{formatCurrencyBRL(installment.amount)}</strong>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="text-2xl font-bold text-slate-950">Próximo passo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Revise as informações e registre sua decisão quando estiver confortável.
          </p>
          <div className="mt-5">
            <ProposalDecision token={token} disabled={decided} />
          </div>
        </Card>
      </div>
    </main>
  );
}
