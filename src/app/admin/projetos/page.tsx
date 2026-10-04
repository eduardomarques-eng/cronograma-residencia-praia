import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";

export const metadata = { title: "Projetos" };

export default function ProjectsPage() {
  return <AppShell eyebrow="Portfólio"><SectionHeading title="Projetos" description="Acesse cronograma, pagamentos, briefing e relatório de cada projeto." action={<Button>Novo projeto</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row"><input aria-label="Buscar projetos" placeholder="Buscar por projeto, cliente ou tipo" className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500" /><select aria-label="Filtrar projetos por status" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600"><option>Todos os status</option><option>Em andamento</option><option>Concluídos</option></select></div><EmptyState title="Nenhum projeto cadastrado" description="A listagem será alimentada pelo Project Service após a conexão com PostgreSQL." /></AppShell>;
}
