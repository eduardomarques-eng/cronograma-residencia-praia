import type { Insight } from "@/lib/commercial-insights";

const ORIGIN_LABELS: Record<Insight["origin"], string> = {
  BRIEFING: "Briefing",
  SERVICOS_CONTRATADOS: "Serviços contratados",
  PROPOSTA_APROVADA: "Proposta aprovada",
  CATALOGO: "Catálogo",
  CONFIGURACAO: "Configuração",
};

/** Tópico 30 — recomendações sempre com a origem visível. */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return <p className="text-sm text-slate-500">Nenhuma recomendação disponível ainda.</p>;
  }
  return (
    <ul className="space-y-2">
      {insights.map((insight) => (
        <li key={insight.code} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{insight.label}</span>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              origem: {ORIGIN_LABELS[insight.origin]}
            </span>
            {insight.requiresAdminApproval ? (
              <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                requer aprovação
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{insight.detail}</p>
          <p className="mt-1 text-[11px] text-slate-400">fonte: {insight.originRef}</p>
        </li>
      ))}
    </ul>
  );
}