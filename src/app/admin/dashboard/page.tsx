import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { dashboardMetrics, projectSnapshots } from "@/server/services/dashboard-service";
import { requirePageRole } from "@/server/auth";

export const metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

const METRICS: { key: string; label: string; format?: "money" }[] = [
  { key: "clients", label: "Clientes ativos" },
  { key: "projects", label: "Projetos" },
  { key: "activeProjects", label: "Projetos em andamento" },
  { key: "pendingProposals", label: "Propostas pendentes" },
  { key: "approvedProposals", label: "Propostas aprovadas" },
  { key: "contracts", label: "Contratos" },
  { key: "pendingPayments", label: "Pagamentos pendentes" },
  { key: "receivedTotal", label: "Total recebido", format: "money" },
];

function formatValue(value: number, format?: "money") {
  if (format === "money") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return value.toLocaleString("pt-BR");
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminDashboardPage() {
  await requirePageRole("ADMIN");
  const [metrics, projects] = await Promise.all([dashboardMetrics(), projectSnapshots()]);

  const alerts = [
    metrics.delayedStages > 0 ? { tone: "rose", text: `${metrics.delayedStages} etapa(s) com prazo vencido` } : null,
    metrics.stagesWithoutOwner > 0 ? { tone: "amber", text: `${metrics.stagesWithoutOwner} etapa(s) sem responsável` } : null,
    metrics.pendingProposals > 0 ? { tone: "blue", text: `${metrics.pendingProposals} proposta(s) aguardando resposta` } : null,
  ].filter(Boolean) as { tone: string; text: string }[];

  return (
    <AppShell eyebrow="Painel de controlo">
      <SectionHeading
        title="Painel"
        description="Estado do estúdio em um só lugar: carteira, comercial e cronograma."
        action={<Link href="/clientes" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Ver clientes →</Link>}
      />

      {alerts.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <Badge key={alert.text} tone={alert.tone === "rose" ? "red" : alert.tone === "amber" ? "amber" : "blue"}>{alert.text}</Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map(({ key, label, format }) => (
          <Card key={key}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {formatValue(metrics[key as keyof typeof metrics], format)}
            </p>
          </Card>
        ))}
      </div>

      <SectionProjects projects={projects} />
    </AppShell>
  );
}

type Snapshot = Awaited<ReturnType<typeof projectSnapshots>>[number];

function SectionProjects({ projects }: { projects: Snapshot[] }) {
  return (
    <>
      <h2 className="mt-10 text-lg font-semibold text-slate-900">Projetos</h2>
      <p className="mt-1 text-sm text-slate-500">Progresso calculado a partir das etapas de cada cronograma.</p>

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto com cronograma"
          description="Assim que criar um projeto e adicionar etapas, o progresso aparece aqui."
        />
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/projetos/${project.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{project.clientName}</p>
                </div>
                <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>{project.status}</Badge>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progresso geral</span>
                  <span className="font-semibold text-slate-700">{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Etapa atual</dt>
                  <dd className="text-slate-700">{project.currentStage ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Próximo prazo</dt>
                  <dd className="text-slate-700">{formatDate(project.nextDueDate)}</dd>
                </div>
              </dl>

              {project.delayedStages > 0 ? (
                <p className="mt-3 text-sm font-medium text-rose-600">{project.delayedStages} etapa(s) atrasada(s)</p>
              ) : null}

              {project.disciplines.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {project.disciplines.map((discipline) => (
                    <li key={discipline.discipline} className="text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>{discipline.discipline}</span>
                        <span className="font-semibold text-slate-700">{discipline.progress}%</span>
                      </div>
                      <Progress value={discipline.progress} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}