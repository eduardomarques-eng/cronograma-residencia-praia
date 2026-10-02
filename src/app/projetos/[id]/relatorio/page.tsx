import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getProjectReport } from "@/server/services/project-report";
import { requirePageProjectAccess } from "@/server/auth";

export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  const report = await getProjectReport(id);
  if (!report) notFound();
  return <AppShell eyebrow="Relatório"><div className="print-report mx-auto max-w-4xl"><div className="flex items-start justify-between border-b border-slate-200 pb-6"><div><p className="text-sm font-bold text-blue-600">ArqVértice</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{report.project.name}</h1><p className="mt-2 text-sm text-slate-500">Relatório de acompanhamento · {new Date().toLocaleDateString("pt-BR")}</p></div><PrintButton /></div><div className="mt-7 grid gap-4 sm:grid-cols-3"><Card><p className="text-xs text-slate-400">Cliente</p><strong className="mt-2 block">{report.project.client.name}</strong></Card><Card><p className="text-xs text-slate-400">Etapas</p><strong className="mt-2 block">{report.stages.length}</strong></Card><Card><p className="text-xs text-slate-400">Percentual pago</p><strong className="mt-2 block">{report.financial.paidPercentage?.toFixed(0) ?? "—"}%</strong></Card></div><Card className="mt-6"><h2 className="font-semibold">Cronograma</h2><div className="mt-4 divide-y divide-slate-100">{report.stages.map((stage) => <div key={stage.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{stage.ordem}. {stage.descricao_etapa}</span><Badge tone={stage.porcentagem === 100 ? "green" : stage.porcentagem > 0 ? "blue" : "neutral"}>{stage.porcentagem}%</Badge></div>)}</div></Card><Card className="mt-6"><h2 className="font-semibold">Pagamentos</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><span className="text-slate-400">Contratado</span><strong className="block">R$ {report.financial.contractedValue?.toFixed(2) ?? "—"}</strong></div><div><span className="text-slate-400">Pago</span><strong className="block">R$ {report.financial.totalPaid.toFixed(2)}</strong></div><div><span className="text-slate-400">Pendente</span><strong className="block">R$ {report.financial.totalPending.toFixed(2)}</strong></div><div><span className="text-slate-400">Saldo</span><strong className="block">R$ {report.financial.remainingBalance?.toFixed(2) ?? "—"}</strong></div></div></Card><footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">ArqVértice · Documento gerado pelo Flow</footer></div></AppShell>;
}
