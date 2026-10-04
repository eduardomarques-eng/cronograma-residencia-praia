import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { Progress } from "@/components/ui/progress";
import { requirePageRole } from "@/server/auth";
import { getClient } from "@/server/services/client-service";
import { stageCompletion } from "@/server/services/dashboard-service";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("ADMIN");
  const { id } = await params;

  let client;
  try {
    client = await getClient(id);
  } catch {
    notFound();
  }

  // Cronograma de cada projeto do cliente — mesma fonte do painel, para não
  // haver dois cálculos de progresso diferentes.
  const stagesByProject = await prisma.scheduleStage.findMany({
    where: { projectId: { in: client.projects.map((project) => project.id) } },
    select: { projectId: true, completion: true, status: true },
  });

  const progressFor = (projectId: string) => {
    const stages = stagesByProject.filter((stage) => stage.projectId === projectId);
    if (stages.length === 0) return 0;
    return Math.round(stages.reduce((sum, stage) => sum + stageCompletion(stage), 0) / stages.length);
  };

  return (
    <AppShell eyebrow="Relacionamento">
      {/* Navegação de contexto: volta à lista, não depende do histórico. */}
      <Link href="/admin/clientes" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
        ← Voltar a clientes
      </Link>

      <SectionHeading
        title={client.name}
        description={client.email ?? "Sem e-mail registado"}
        action={<Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status}</Badge>}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="font-semibold text-slate-900">Contacto</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Nome completo</dt>
              <dd className="text-slate-700">{client.fullName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">E-mail</dt>
              <dd className="break-all text-slate-700">{client.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Telefone</dt>
              <dd className="text-slate-700">{client.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Documento</dt>
              <dd className="text-slate-700">{client.document ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Cliente desde</dt>
              <dd className="text-slate-700">{formatDate(client.createdAt)}</dd>
            </div>
          </dl>
        </Card>

        <div>
          <h2 className="font-semibold text-slate-900">Projetos</h2>
          {client.projects.length === 0 ? (
            <EmptyState
              title="Sem projetos"
              description="Assim que associar um projeto a este cliente, ele aparece aqui."
            />
          ) : (
            <div className="mt-4 grid gap-4">
              {client.projects.map((project) => {
                const progress = progressFor(project.id);
                return (
                  <Card key={project.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/admin/projetos/${project.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                          {project.name}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">{project.type ?? "—"}</p>
                      </div>
                      <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>{project.status}</Badge>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Progresso</span>
                        <span className="font-semibold text-slate-700">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}