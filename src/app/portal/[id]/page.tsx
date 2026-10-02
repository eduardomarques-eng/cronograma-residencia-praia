import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess } from "@/server/auth";

export default async function ClientPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  return <AppShell eyebrow="Portal do cliente"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm font-semibold text-blue-600">← Voltar</Link><div className="mt-7"><Badge tone="blue">Portal do cliente</Badge><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Acompanhe seu projeto</h1><p className="mt-2 text-sm leading-6 text-slate-500">Uma visão simples do andamento, cronograma e pagamentos.</p></div><Card className="mt-8"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">Projeto</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Projeto {id}</h2></div><Badge tone="amber">Aguardando dados</Badge></div><div className="mt-7"><div className="flex justify-between text-sm"><span className="text-slate-500">Andamento geral</span><strong>0%</strong></div><div className="mt-3"><Progress value={0} /></div></div></Card><div className="mt-6 grid gap-4 sm:grid-cols-2"><EmptyState title="Cronograma" description="As etapas do seu projeto aparecerão aqui." /><EmptyState title="Pagamentos" description="Consulte parcelas, vencimentos e status." /></div><Link href={`/portal/${id}/briefing`} className="mt-6 block rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800">Preencher briefing guiado <span className="float-right">→</span></Link></div></AppShell>;
}
