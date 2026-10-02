import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess } from "@/server/auth";
import { BriefingLinkManager } from "@/components/briefing/briefing-link-manager";
import { getBriefingLinkStatus } from "@/server/services/briefing-link-service";
import { listProjectReports } from "@/server/services/report-visibility-service";
import { ReportVisibilityControl } from "@/components/reports/report-visibility-control";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  const linkStatus = await getBriefingLinkStatus(id);
  const reports = await listProjectReports(id);
  return <AppShell eyebrow="Centro operacional"><Link href="/projetos" className="text-sm font-semibold text-blue-600">← Voltar para projetos</Link><div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-blue-600">Centro operacional</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Projeto {id}</h1><p className="mt-2 text-sm text-slate-500">Resumo, briefing, cronograma, pagamentos, documentos e relatórios em um só lugar.</p></div><Badge tone="amber">Aguardando dados</Badge></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Áreas do projeto">{["Resumo","Briefing","Cronograma","Pagamentos","Documentos","Relatórios","Observações","Acesso do cliente"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ","-")}`} className="min-w-max rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-blue-700">{item}</a>)}</nav><BriefingLinkManager projectId={id} initialStatus={linkStatus.briefingStatus} initialLinkStatus={linkStatus.linkStatus === "ACTIVE" ? "ACTIVE" : "REVOKED"} /><div id="resumo" className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Card><h2 className="font-semibold text-slate-900">Andamento</h2><div className="mt-6"><Progress value={0} /><p className="mt-3 text-sm text-slate-500">Nenhuma etapa disponível.</p></div></Card><Card><h2 className="font-semibold text-slate-900">Resumo financeiro</h2><div className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><p className="text-slate-400">Valor contratado</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Total pago</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Pendente</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Saldo restante</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div></div></Card></div><div id="cronograma" className="mt-6 grid gap-6 lg:grid-cols-2"><EmptyState title="Cronograma vazio" description="As etapas respeitarão a ordem, datas, progresso e status do modelo legado." /><EmptyState title="Pagamentos vazios" description="Parcelas editáveis e seus status aparecerão quando houver registros." /></div><div id="relatórios"><ReportVisibilityControl projectId={id} reports={reports.map((report) => ({ id: report.id, title: report.title, status: report.status }))} /></div></AppShell>;
}
