import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess } from "@/server/auth";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  return <AppShell eyebrow="Projeto"><Link href="/projetos" className="text-sm font-semibold text-blue-600">← Voltar para projetos</Link><div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-blue-600">Projeto</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Projeto {id}</h1><p className="mt-2 text-sm text-slate-500">Os dados serão carregados pelo agregador ProjectReportData.</p></div><Badge tone="amber">Aguardando dados</Badge></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Card><h2 className="font-semibold text-slate-900">Andamento</h2><div className="mt-6"><Progress value={0} /><p className="mt-3 text-sm text-slate-500">Nenhuma etapa disponível.</p></div></Card><Card><h2 className="font-semibold text-slate-900">Resumo financeiro</h2><div className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><p className="text-slate-400">Valor contratado</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Total pago</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Pendente</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div><div><p className="text-slate-400">Saldo restante</p><strong className="mt-1 block text-lg text-slate-900">R$ —</strong></div></div></Card></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><EmptyState title="Cronograma vazio" description="As etapas respeitarão a ordem, datas, progresso e status do modelo legado." /><EmptyState title="Pagamentos vazios" description="Parcelas editáveis e seus status aparecerão quando houver registros." /></div></AppShell>;
}
