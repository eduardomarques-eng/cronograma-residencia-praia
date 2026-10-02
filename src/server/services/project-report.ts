import { prisma } from "@/server/db";
import { calculateFinancialSummary, type FinancialPayment } from "@/lib/finance";
import { sortLegacyTasks, type LegacyTask } from "@/lib/schedule";
import type { Prisma } from "@prisma/client";
import { requireProjectAccess } from "@/server/auth";

export type ProjectReportData = {
  project: Prisma.ProjectGetPayload<{ include: { client: true; stages: true; payments: true; briefing: true } }>;
  stages: LegacyTask[];
  financial: ReturnType<typeof calculateFinancialSummary>;
};

export async function getProjectReport(projectId: string): Promise<ProjectReportData | null> {
  await requireProjectAccess(projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      stages: { orderBy: { order: "asc" } },
      payments: { orderBy: { order: "asc" } },
      briefing: true,
    },
  });

  if (!project) return null;

  const legacyStages: LegacyTask[] = project.stages.map((stage) => ({
    id: stage.id,
    descricao_etapa: stage.name,
    disciplina_projeto: stage.discipline ?? "",
    projetista: stage.designer ?? "",
    data_conclusao: stage.dueDate?.toLocaleDateString("pt-BR").replace(/\//g, "-") ?? "",
    porcentagem: stage.completion,
    ordem: stage.order,
  }));

  const payments: FinancialPayment[] = project.payments.map((payment) => ({
    amount: payment.amount.toString(),
    status: payment.status,
  }));

  return {
    project,
    stages: sortLegacyTasks(legacyStages),
    financial: calculateFinancialSummary(project.budget?.toString(), payments),
  };
}
