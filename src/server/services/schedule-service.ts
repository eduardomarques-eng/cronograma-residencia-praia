import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notFound, DomainError } from "@/server/errors";
import { requireScheduleRole } from "@/server/auth";
import { scheduleStageSchema, scheduleStageUpdateSchema } from "@/lib/validation";
import {
  canTransition,
  completionForStatus,
  isScheduleStatus,
  scheduleStatusFromPercentage,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_TRANSITIONS,
  type ScheduleStatus,
} from "@/lib/schedule";
import { stageCompletion } from "@/lib/progress";
import { stageAlert, summarizeAlerts, type AlertPriority, type StageAlert } from "@/lib/schedule-alerts";

/**
 * Colunas do quadro.
 *
 * Só entram estados que existem no modelo. `ScheduleStageStatus` tem apenas
 * NOT_STARTED / IN_PROGRESS / COMPLETED — não existe "em revisão" nem
 * "prioridade" no banco, e não foram inventados. "ATRASADO" é derivado: etapa
 * não concluída cujo prazo já passou. Cada etapa aparece em UMA coluna, para não
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
  order: number;
  name: string;
  discipline: string | null;
  designer: string | null;
  completion: number;
  status: ScheduleStatus;
  statusLabel: string;
  startDate: Date | null;
  dueDate: Date | null;
  /** Alerta único, calculado pela regra de `@/lib/schedule-alerts`. */
  alert: StageAlert;
  /** Prioridade derivada da regra de alertas — não é coluna na base. */
  priority: AlertPriority;
  /** Nome da etapa de que esta depende, quando existe. */
  dependencyName: string | null;
  /** Estado dessa dependência, para o ADMIN ver se já liberou. */
  dependencyStatus: string | null;
  /** Transições que o backend aceita a partir do estado atual. */
  allowedTransitions: readonly ScheduleStatus[];
};

export type KanbanBoard = {
  project: { id: string; name: string };
  columns: { id: KanbanColumnId; label: string; cards: KanbanCard[] }[];
  totals: { stages: number; overdue: number; attention: number; completion: number };
  /** Alertas agregados — a MESMA contagem usada no relatório. */
  alerts: ReturnType<typeof summarizeAlerts>;
  /**
   * Responsáveis reais do projecto: quem já está atribuído nas etapas +
   * utilizadores ADMIN existentes. Nenhum nome é inventado; a lista é lida da
   * base.
   */
  assignees: string[];
};

/** Coluna de uma etapa: o atraso tem prioridade sobre o status. */
export function columnFor(
  stage: { status: ScheduleStatus; completion: number; dueDate: Date | null },
  now: Date,
): KanbanColumnId {
  const alert = stageAlert({ status: stage.status, dueDate: stage.dueDate }, now);
  if (alert.overdue) return "ATRASADO";
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
    include: { dependency: { select: { name: true, status: true } } },
  });
  const assignees = await listAssignees(projectId);

  const now = new Date();
  const cards: KanbanCard[] = stages.map((stage) => {
    const dependencyName = stage.dependency?.name ?? null;
    const dependencyStatus = stage.dependency?.status ?? null;
    const alert = stageAlert(
      { status: stage.status, dueDate: stage.dueDate, dependencyName, dependencyStatus },
      now,
    );
    return {
      id: stage.id,
      order: stage.order,
      name: stage.name,
      discipline: stage.discipline,
      designer: stage.designer,
      completion: stageCompletion(stage),
      status: stage.status,
      statusLabel: SCHEDULE_STATUS_LABELS[stage.status],
      startDate: stage.startDate,
      dueDate: stage.dueDate,
      alert,
      priority: alert.priority,
      dependencyName,
      dependencyStatus,
      allowedTransitions: SCHEDULE_TRANSITIONS[stage.status],
    };
  });

  const columns = KANBAN_COLUMNS.map((column) => ({
    ...column,
    cards: cards.filter((card) => columnFor({ status: card.status, completion: card.completion, dueDate: card.dueDate }, now) === column.id),
  }));

  return {
    project,
    columns,
    totals: {
      stages: cards.length,
      overdue: cards.filter((card) => card.alert.overdue).length,
      attention: cards.filter((card) => card.alert.overdue || card.alert.dueSoon || card.alert.blocked).length,
      completion: cards.length ? Math.round(cards.reduce((sum, card) => sum + card.completion, 0) / cards.length) : 0,
    },
    alerts: summarizeAlerts(cards.map((card) => card.alert)),
    assignees,
  };
}

/**
 * Responsáveis que o sistema pode oferecer ao ADMIN.
 *
 * Duas fontes, ambas reais: os `designer` já gravados nas etapas deste projecto
 * e os utilizadores com `role = ADMIN`. Nenhuma pessoa é criada — se o estúdio
 * ainda não tiver equipa registada, a lista vem vazia e o ADMIN escreve o nome
 * no campo, como sempre fez.
 */
export async function listAssignees(projectId: string): Promise<string[]> {
  const [assigned, admins] = await Promise.all([
    prisma.scheduleStage.findMany({
      where: { projectId, designer: { not: null } },
      select: { designer: true },
      distinct: ["designer"],
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const names = new Set<string>();
  for (const row of admins) names.add(row.name.trim());
  for (const row of assigned) {
    const name = row.designer?.trim();
    if (name) names.add(name);
  }
  return [...names].filter(Boolean).toSorted((a, b) => a.localeCompare(b, "pt-BR"));
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

/**
 * Mudança de estado da etapa, respeitando as regras do domínio.
 *
 * Três guardas, todas no servidor — a interface só desenha botões:
 *
 *  1. O destino tem de ser um estado que o MODELO conhece.
 *  2. A transição tem de estar em `SCHEDULE_TRANSITIONS`.
 *  3. Uma etapa bloqueada por dependência pendente não entra em andamento: o
 *     bloqueio é real e mexer no estado por cima dele seria o sistema a dizer
 *     que a etapa avançou quando a predecessora ainda não entregou.
 *
 * O `status` NÃO é escrito à mão. Grava-se o `completion` correspondente e o
 * status é recalculado por `scheduleStatusFromPercentage`, mantendo a regra
 * única: o estado é derivado do avanço.
 */
export async function updateScheduleStageStatus(id: string, status: string) {
  // Autorização AQUI, não só na server action: o serviço é o ponto de escrita
  // e pode ser chamado de qualquer sítio. Sem esta guarda, uma chamada directa
  // ao serviço mudaria o estado de uma etapa sem qualquer verificação de sessão.
  // `requireScheduleRole` aceita ADMIN (dono) e OPERADOR (funcionário da equipa
  // com acesso restrito); o OPERADOR só chega às etapas dos projetos atribuídos.
  await requireScheduleRole();

  if (!isScheduleStatus(status)) throw new DomainError("Status de etapa inválido.", "VALIDATION");

  const stage = await prisma.scheduleStage.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      completion: true,
      dependency: { select: { name: true, status: true } },
    },
  });
  if (!stage) return notFound("Etapa");

  if (!canTransition(stage.status, status)) {
    throw new DomainError(
      `Não é possível passar de "${SCHEDULE_STATUS_LABELS[stage.status]}" para "${SCHEDULE_STATUS_LABELS[status]}".`,
      "CONFLICT",
    );
  }

  if (status === "IN_PROGRESS" && stage.dependency && stage.dependency.status !== "COMPLETED") {
    throw new DomainError(
      `A etapa depende de "${stage.dependency.name}", que ainda não está concluída.`,
      "CONFLICT",
    );
  }

  return prisma.scheduleStage.update({
    where: { id },
    data: {
      completion: completionForStatus(status, stage.completion),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}
