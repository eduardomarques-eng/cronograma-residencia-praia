import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

/**
 * Regra ÚNICA de progresso.
 *
 * Só existe fonte de verdade: `ScheduleStage.completion` (0–100) guardado por
 * etapa. O progresso da disciplina é a média das suas etapas; o do projeto é a
 * média de todas. Calcular de outra forma em algum ecrã criaria duas verdades
 * para o mesmo número — foi exactamente o que a secção 14 pede para evitar.
 *
 * Etapas concluídas contam sempre 100, mesmo que `completion` tenha ficado
 * abaixo (etapa marcada como concluída mas por fechar a percentagem).
 */
export function stageCompletion(stage: { completion: number; status: string }): number {
  if (stage.status === "COMPLETED") return 100;
  return Math.max(0, Math.min(100, stage.completion));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Progresso por disciplina de um conjunto de etapas. */
export function progressByDiscipline(stages: { discipline: string | null; completion: number; status: string }[]) {
  const byDiscipline = new Map<string, number[]>();
  for (const stage of stages) {
    const key = stage.discipline?.trim() || "Geral";
    const list = byDiscipline.get(key) ?? [];
    list.push(stageCompletion(stage));
    byDiscipline.set(key, list);
  }
  return [...byDiscipline.entries()]
    .map(([discipline, values]) => ({ discipline, progress: average(values) }))
    .sort((a, b) => a.discipline.localeCompare(b.discipline, "pt-BR"));
}

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
      progress: average(stages.map(stageCompletion)),
      currentStage: current?.name ?? null,
      nextDueDate: nextDue?.dueDate ?? null,
      delayedStages: stages.filter((stage) => stage.status !== "COMPLETED" && stage.dueDate && stage.dueDate < now).length,
      disciplines: progressByDiscipline(stages),
    };
  });
}