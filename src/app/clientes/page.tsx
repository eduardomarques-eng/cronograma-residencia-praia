import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";

export const metadata = { title: "Clientes" };

export default function ClientsPage() {
  return <AppShell eyebrow="Relacionamento"><SectionHeading title="Clientes" description="Centralize contatos, projetos e histórico de relacionamento." action={<Button>Novo cliente</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row"><input aria-label="Buscar clientes" placeholder="Buscar por nome ou e-mail" className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500" /><select aria-label="Filtrar status" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600"><option>Todos os status</option><option>Ativos</option><option>Arquivados</option></select></div><EmptyState title="Nenhum cliente cadastrado" description="Quando o banco estiver conectado, os clientes criados pelos serviços aparecerão aqui." action={<Button>Novo cliente</Button>} /></AppShell>;
}
