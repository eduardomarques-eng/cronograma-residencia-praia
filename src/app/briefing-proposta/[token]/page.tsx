import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { ProposalDecision } from "@/components/proposals/proposal-decision";
import { ProposalPresentation } from "@/components/proposals/proposal-presentation";
import { ProposalShareActions } from "@/components/proposals/proposal-share-actions";
import { loadPublicProposalDocument } from "@/server/services/preview-service";
import { RateLimitError, resolveClientKey } from "@/lib/proposal-access";
import { formatCurrencyBRL } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

/**
 * A proposta é partilhada por token. O token é a única autorização, por isso
 * a rota nunca pode ser indexada. Só `noindex` — `nocache` não é uma
 * directiva de robots válida.
 */
export const metadata: Metadata = {
  title: "Proposta",
  robots: { index: false },
};

/**
 * FASE 4E — VIEWPORT E ZOOM (itens 51 e 52).
 *
 * `maximumScale` e `userScalable` ficam DELIBERADAMENTE por definir.
 *
 * Bloquear o zoom é a falha de acessibilidade mais comum em páginas mobile, e é
 * um problema real e não teórico: quem tem baixa visão precisa de ampliar para
 * ler os valores de uma proposta — o número é a informação. Um `userScalable:
 * false` aqui significaria que o cliente não consegue ler o preço que se
 * comprometidos a assinar.
 *
 * `width=device-width` sem escala máxima é o que permite ao layout responder a um
 * ecrã estreito e, ao mesmo tempo, deixar o utilizador aproximar-se.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f5f7",
};

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
      {/*
        FASE 4E — ACESSIBILIDADE (item 52).

        Um link que só aparece com o Tab. Para quem navega só com teclado ou
        leitor de ecrã, é a forma de saltar a navegação repetida em cada página
        e chegar ao conteúdo — sem ele, é preciso percorrer tudo para chegar ao
        mesmo sítio em cada link.

        `sr-only` esconde visualmente mas mantém no fluxo de acessibilidade;
        `focus:not-sr-only` traz o foco de volta à vista, para quem o vê.
      */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
      >
        Saltar para o conteúdo
      </a>

      <div id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 focus:outline-none">
        <header className="rounded-3xl bg-slate-950 p-8 text-white md:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            ArqVértice Flow · proposta
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">{document.title}</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Uma leitura clara do escopo, das condições e do investimento para o seu projeto.
          </p>
        </header>

        {/*
          Partilha e contacto (item 51). Fica antes da apresentação porque o
          cliente que chega pelo WhatsApp é, tipicamente, o que quer repassar
          a proposta ou fazer uma pergunta antes de a ler até ao fim.
        */}
        <Card>
          <h2 className="text-2xl font-bold text-slate-950">Partilhar ou perguntar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Se quiser falar com alguém sobre esta proposta, o WhatsApp abre com a mensagem já escrita.
          </p>
          <div className="mt-5">
            <ProposalShareActions title={document.title} token={token} />
          </div>
        </Card>

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
