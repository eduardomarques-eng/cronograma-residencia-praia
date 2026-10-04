import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { scheduleStageSchema, scheduleStageUpdateSchema } from "@/lib/validation";
import { scheduleStatusFromPercentage, type ScheduleStatus } from "@/lib/schedule";

/**
 * Colunas do quadro.
 *
 * Só entram estados que existem no modelo. `ScheduleStageStatus` tem apenas
 * NOT_STARTED / IN_PROGRESS / COMPLETED — não existe "em revisão" nem
 * "prioridade", e não foram inventados. "ATRASADO" é derivado: etapa não
 * concluída cujo prazo já passou. Cada etapa aparece em UMA coluna, para não
 * contar duas vezes.
 */
export type KanbanColumnId = "ATRASADO" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export const KANBAN_COLUMNS: { id: KanbanColumnId; label: string }[] = [
  { id: "ATRASADO", label: "Atrasado" },
  { id: "NOT_STARTED", label: "Não iniciado" },
  { id: "IN_PROGRESS", label: "Em andamento" },
  { id: "COMPLETED", label: "Concluído" },
];

export type KanbanCard = {
  id: string;
  name: string;
  discipline: string | null;
  designer: string | null;
  completion: number;
  status: ScheduleStatus;
  startDate: Date | null;
  dueDate: Date | null;
  /** Nome da etapa de que esta depende, quando existe. */
  dependencyName: string | null;
};

export type KanbanBoard = {
  project: { id: string; name: string };
  columns: { id: KanbanColumnId; label: string; cards: KanbanCard[] }[];
  totals: { stages: number; overdue: number; completion: number };
};

/** Coluna de uma etapa: o atraso tem prioridade sobre o status. */
export function columnFor(stage: { status: ScheduleStatus; completion: number; dueDate: Date | null }, now: Date): KanbanColumnId {
  if (stage.status !== "COMPLETED" && stage.dueDate && stage.dueDate < now) return "ATRASADO";
  return stage.status;
}

/** Etapas de um projecto, agrupadas nas colunas do quadro. */
export async function kanbanBoard(projectId: string): Promise<KanbanBoard> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) return notFound("Projeto");

  const stages = await prisma.scheduleStage.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: { dependency: { select: { name: true } } },
  });

  const now = new Date();
  const cards: KanbanCard[] = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    discipline: stage.discipline,
    designer: stage.designer,
    completion: stage.status === "COMPLETED" ? 100 : stageCompletionValue(stage.completion),
    status: stage.status,
    startDate: stage.startDate,
    dueDate: stage.dueDate,
    dependencyName: stage.dependency?.name ?? null,
  }));

  const columns = KANBAN_COLUMNS.map((column) => ({
    ...column,
    cards: cards.filter((card) => columnFor({ status: card.status, completion: card.completion, dueDate: card.dueDate }, now) === column.id),
  }));

  return {
    project,
    columns,
    totals: {
      stages: cards.length,
      overdue: columns[0].cards.length,
      completion: cards.length ? Math.round(cards.reduce((sum, card) => sum + card.completion, 0) / cards.length) : 0,
    },
  };
}

/** Mesma regra do painel: percentagem presa a 0–100. */
function stageCompletionValue(completion: number) {
  return Math.max(0, Math.min(100, completion));
}

export { scheduleStatusFromPercentage };

export async function createScheduleStage(input: unknown) {
  const data = scheduleStageSchema.parse(input);
  const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
  if (!project) return notFound("Projeto");
  return prisma.scheduleStage.create({ data: { ...data, status: scheduleStatusFromPercentage(data.completion) } });
}

export async function updateScheduleStage(id: string, input: unknown) {
  const data = scheduleStageUpdateSchema.parse(input);
  const update = data.completion === undefined ? data : { ...data, status: scheduleStatusFromPercentage(data.completion) };
  try {
    return await prisma.scheduleStage.update({ where: { id }, data: update });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Etapa");
    throw error;
  }
}

export async function completeScheduleStage(id: string) {
  return updateScheduleStage(id, { completion: 100, completedAt: new Date() });
}

export async function reorderScheduleStage(id: string, order: number) {
  if (!Number.isInteger(order) || order < 0) throw new Error("A ordem da etapa é inválida.");
  return updateScheduleStage(id, { order });
}

export async function updateScheduleStageStatus(id: string, status: string) {
  if (!["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(status)) throw new Error("Status de etapa inválido.");
  return updateScheduleStage(id, { status });
}
