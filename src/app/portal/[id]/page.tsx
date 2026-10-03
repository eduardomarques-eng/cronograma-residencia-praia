import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess } from "@/server/auth";
import { getProjectReport } from "@/server/services/project-report";
import { listProjectReports } from "@/server/services/report-visibility-service";
import { listProjectDocuments } from "@/server/services/document-service";
import { DocumentList } from "@/components/documents/document-list";

export default async function ClientPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  const [report, reports, documents] = await Promise.all([getProjectReport(id), listProjectReports(id, true), listProjectDocuments(id, true)]);
  if (!report) return null;
  const completed = report.stages.filter((stage) => stage.porcentagem === 100).length;
  const progress = report.stages.length ? Math.round(report.stages.reduce((sum, stage) => sum + stage.porcentagem, 0) / report.stages.length) : 0;
  return <AppShell eyebrow="Portal do cliente" environment="client"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm font-semibold text-blue-600">← Sair do projeto</Link><div className="mt-7"><Badge tone="blue">Portal do cliente</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{report.project.name}</h1><p className="mt-2 text-sm leading-6 text-slate-500">Acompanhe o andamento, as próximas etapas e os documentos liberados para você.</p></div><Card className="mt-8"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Andamento do projeto</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{progress}% concluído</h2></div><Badge tone={progress === 100 ? "green" : "blue"}>{completed} de {report.stages.length} etapas</Badge></div><div className="mt-7"><Progress value={progress} /></div></Card><Card className="mt-6"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Cronograma</h2><span className="text-xs text-slate-400">Próximas etapas</span></div><div className="mt-4 divide-y divide-slate-100">{report.stages.slice(0, 5).map((stage) => <div key={stage.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-700">{stage.descricao_etapa}</span><Badge tone={stage.porcentagem === 100 ? "green" : stage.porcentagem > 0 ? "blue" : "neutral"}>{stage.porcentagem}%</Badge></div>)}</div></Card><Card className="mt-6"><h2 className="font-semibold text-slate-900">Pagamentos autorizados</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-slate-400">Total pago</span><strong className="block">R$ {report.financial.totalPaid.toFixed(2)}</strong></div><div><span className="text-slate-400">Pendente</span><strong className="block">R$ {report.financial.totalPending.toFixed(2)}</strong></div><div><span className="text-slate-400">Saldo</span><strong className="block">R$ {report.financial.remainingBalance?.toFixed(2) ?? "—"}</strong></div></div></Card>{reports.length > 0 && <Card className="mt-6"><h2 className="font-semibold text-slate-900">Relatórios liberados</h2><div className="mt-3 divide-y divide-slate-100">{reports.map((item) => <Link key={item.id} href={`/projetos/${id}/relatorio`} className="block py-3 text-sm font-medium text-blue-700 hover:text-blue-900">{item.title} <span className="float-right">→</span></Link>)}  </div></Card>}<Card className="mt-6"><h2 className="font-semibold text-slate-900">Documentos liberados</h2><DocumentList documents={documents} clientView /></Card><Link href={`/portal/${id}/briefing`} className="mt-6 block rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800">Abrir briefing <span className="float-right">→</span></Link></div></AppShell>;
}
