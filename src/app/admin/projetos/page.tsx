import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { Progress } from "@/components/ui/progress";
import { requirePageRole } from "@/server/auth";
import { listProjects } from "@/server/services/project-service";

export const metadata = { title: "Projetos" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "blue" | "green" | "amber" | "neutral"> = {
  PLANNING: "amber",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
};

/**
 * Lista real de projetos, lida do banco.
 *
 * O progresso NÃO é recalculado aqui: `getProjectSchedule` é quem sabe das
 * etapas. Enquanto o serviço de leitura não expõe isso, mostramos o estado do
 * projeto sem inventar percentagem — um "0%" fixo seria pior do que nada.
 */
export default async function ProjectsPage() {
  await requirePageRole("ADMIN");
  const projects = await listProjects();

  return (
    <AppShell eyebrow="Portfólio">
      <SectionHeading title="Projetos" description="Cada projeto com o seu cliente, estado e acesso direto." />

      {projects.length === 0 ? (
        <EmptyState title="Nenhum projeto" description="Assim que criar um projeto, ele aparece aqui." />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/projetos/${project.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{"type" in project && project.type ? project.type : "Sem tipo definido"}</p>
                </div>
                <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>{project.status}</Badge>
              </div>

              <div className="mt-4 flex gap-4 text-xs text-slate-500">
                <Link href={`/admin/projetos/${project.id}/cronograma`} className="font-semibold text-blue-600 hover:text-blue-700">
                  Cronograma →
                </Link>
                <Link href={`/admin/projetos/${project.id}/relatorio`} className="font-semibold text-blue-600 hover:text-blue-700">
                  Relatório →
                </Link>
              </div>

              <Link href={`/admin/projetos/${project.id}`} className="mt-3 inline-block text-sm font-semibold text-slate-700 hover:text-blue-700">
                Abrir projeto →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}