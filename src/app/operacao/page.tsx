import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageScheduleRole } from "@/server/auth";
import { listOperationProjects } from "@/server/services/operation-service";

export const dynamic = "force-dynamic";

/**
 * Área do funcionário da equipa (OPERADOR). Mostra somente os projetos que lhe
 * foram atribuídos e o acesso direto ao cronograma de cada um. A lista vem de
 * `listOperationProjects(user.id)` — filtrada por `ProjectAccess` no servidor —
 * e não do menu. Sem projetos atribuídos, o operador vê um estado vazio, nunca
 * dados de outro cliente.
 */
export default async function OperacaoPage() {
  const user = await requirePageScheduleRole();
  const projects = await listOperationProjects(user.id);

  return (
    <AppShell eyebrow="Operação" role={user.role}>
      <SectionHeading
        title="Operação do cronograma"
        description="Projetos atribuídos a você. Abra um cronograma para atualizar o andamento das etapas."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto atribuído"
          description="Quando a equipa atribuir um projeto a você, ele aparece aqui com acesso ao cronograma."
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/projetos/${project.id}/cronograma`}
                    className="font-semibold text-slate-900 hover:text-blue-700"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{project.clientName}</p>
                </div>
                {project.overdue > 0 ? (
                  <Badge tone="red">{project.overdue} atrasada(s)</Badge>
                ) : (
                  <Badge tone="green">Em dia</Badge>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progresso · {project.stages} etapa(s)</span>
                  <span className="font-semibold text-slate-700">{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
              </div>

              <Link
                href={`/admin/projetos/${project.id}/cronograma`}
                className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Abrir cronograma →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
