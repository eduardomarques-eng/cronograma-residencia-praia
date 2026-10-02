import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";

const metrics = [
  ["Projetos ativos", "—", "Nenhum banco conectado"],
  ["Próximas etapas", "—", "Aguardando dados"],
  ["Pagamentos pendentes", "—", "Aguardando dados"],
  ["Total recebido", "R$ —", "Aguardando dados"],
];

export default function HomePage() {
  return <AppShell><SectionHeading title="Visão geral" description="Uma leitura objetiva do estúdio: projetos, cronograma e financeiro em um só lugar." action={<Badge tone="amber">Banco não conectado</Badge>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note]) => <Card key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></Card>)}</div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]"><Card><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Projetos recentes</h2><p className="mt-1 text-sm text-slate-500">Acompanhe o que precisa de atenção.</p></div><Link href="/projetos" className="text-sm font-semibold text-blue-600">Ver todos</Link></div><div className="mt-6"><EmptyState title="Nenhum projeto carregado" description="Configure DATABASE_URL e execute a migration para começar a visualizar os projetos do estúdio." action={<Link href="/projetos" className="text-sm font-semibold text-blue-600">Abrir projetos</Link>} /></div></Card>
      <Card><h2 className="font-semibold text-slate-900">Atalhos</h2><div className="mt-5 grid gap-3"><Link href="/clientes" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cadastrar cliente <span className="float-right text-slate-400">→</span></Link><Link href="/projetos" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Criar projeto <span className="float-right text-slate-400">→</span></Link><Link href="/login" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Entrar no portal do cliente <span className="float-right text-slate-400">→</span></Link></div></Card>
    </div>
  </AppShell>;
}
