import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { averageCompletion, completionOf, progressByDiscipline, stageCompletion } from "@/lib/progress";
import { stageAlert, summarizeAlerts } from "@/lib/schedule-alerts";

/**
 * REGRA ÚNICA DE PROGRESSO — a implementação está em `@/lib/progress`.
 *
 * Reexportada daqui porque o painel, o quadro e o relatório consomem a MESMA
 * função. Na Fase 3 a implementação saiu deste ficheiro: existia uma cópia em
 * `schedule-service` (`stageCompletionValue`), e cada cópia é uma verdade nova
 * para o mesmo número.
 */
export { averageCompletion, completionOf, stageCompletion, progressByDiscipline };

export type DashboardMetrics = {
  clients: number;
  projects: number;
  activeProjects: number;
  pendingProposals: number;
  approvedProposals: number;
  contracts: number;
  pendingPayments: number;
  receivedTotal: number;
  tasksInProgress: number;
  delayedStages: number;
  stagesWithoutOwner: number;
};

/**
 * Métricas do dashboard, todas lidas da base — nada de números fixos no
 * componente. `ADMIN` obrigatório: são dados do estúdio inteiro.
 */
export async function dashboardMetrics(): Promise<DashboardMetrics> {
  await requireRole("ADMIN");

  const now = new Date();
  const [
    clients,
    projects,
    activeProjects,
    pendingProposals,
    approvedProposals,
    contracts,
    pendingPayments,
    paidPayments,
    tasksInProgress,
    delayedStages,
    stagesWithoutOwner,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS", "PAUSED"] } } }),
    prisma.proposal.count({ where: { status: { in: ["READY", "SENT", "VIEWED", "IN_REVIEW"] } } }),
    prisma.proposal.count({ where: { status: { in: ["APPROVED", "CONVERTED"] } } }),
    prisma.contract.count(),
    prisma.payment.count({ where: { status: { not: "PAID" } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.scheduleStage.count({ where: { status: "IN_PROGRESS" } }),
    // Atrasada = prazo passou e a etapa não está concluída.
    prisma.scheduleStage.count({ where: { status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
    prisma.scheduleStage.count({ where: { status: { not: "COMPLETED" }, designer: null } }),
  ]);

  return {
    clients,
    projects,
    activeProjects,
    pendingProposals,
    approvedProposals,
    contracts,
    pendingPayments,
    // `amount` é Decimal no Prisma; a interface é em number, por isso converte.
    receivedTotal: Number(paidPayments._sum.amount ?? 0),
    tasksInProgress,
    delayedStages,
    stagesWithoutOwner,
  };
}

export type ProjectSnapshot = {
  id: string;
  name: string;
  status: string;
  clientName: string;
  progress: number;
  currentStage: string | null;
  nextDueDate: Date | null;
  delayedStages: number;
  disciplines: { discipline: string; progress: number }[];
};

/** Projetos com progresso e etapa atual, para o painel e para o cronograma. */
export async function projectSnapshots(limit = 6): Promise<ProjectSnapshot[]> {
  await requireRole("ADMIN");
  const now = new Date();

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      client: { select: { name: true } },
      stages: { orderBy: { order: "asc" } },
    },
  });

  return projects.map((project) => {
    const stages = project.stages;
    const current = stages.find((stage) => stage.status === "IN_PROGRESS") ?? null;
    const pending = stages.filter((stage) => stage.status !== "COMPLETED");
    const nextDue = [...pending]
      .filter((stage) => stage.dueDate)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))[0];

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      clientName: project.client?.name ?? "Sem cliente",
      progress: completionOf(stages),
      currentStage: current?.name ?? null,
      nextDueDate: nextDue?.dueDate ?? null,
      // Mesma regra de alertas do quadro e do relatório — não uma contagem
      // recalculada aqui, que voltaria a criar uma segunda verdade.
      delayedStages: summarizeAlerts(
        stages.map((stage) =>
          stageAlert({ status: stage.status, dueDate: stage.dueDate }, now),
        ),
      ).overdue,
      disciplines: progressByDiscipline(stages),
    };
  });
}