export const legacyDisciplines = [
  "Arquitetura",
  "3D",
  "Estrutura",
  "Complementares",
  "Obras",
] as const;

export type LegacyTask = {
  id: string;
  descricao_etapa: string;
  disciplina_projeto: string;
  projetista: string;
  data_conclusao: string;
  porcentagem: number;
  ordem: number;
};

export type ScheduleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

/**
 * Estados que o MODELO conhece. `ScheduleStageStatus` no Prisma tem exactamente
 * estes três. A referência conceptual da fase fala em "REVIEW" e "OVERDUE", mas
 * não foram inventados: `OVERDUE` é derivado (prazo vencido e etapa não
 * concluída) e "REVIEW" não tem coluna nem enum — acrescentá-lo ao banco só para
 * coincidir com o nome criaria um estado que ninguém pode distinguir de
 * `IN_PROGRESS`.
 */
export const SCHEDULE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;

/** Rótulos em português — uma vez só, para UI e PDF não divergirem. */
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
};

export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return typeof value === "string" && (SCHEDULE_STATUSES as readonly string[]).includes(value);
}

/**
 * Transições permitidas.
 *
 * O estado é DERIVADO do `completion` (regra única do domínio). Por isso mudar de
 * estado não grava `status` à mão: grava o `completion` correspondente e deixa o
 * status ser recalculado. Sem esta tabela, um "Concluir" manual produziria uma
 * etapa a 100% que o sistema continuaria a contar como em andamento.
 */
export const SCHEDULE_TRANSITIONS: Record<ScheduleStatus, readonly ScheduleStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["NOT_STARTED", "COMPLETED"],
  COMPLETED: ["NOT_STARTED", "IN_PROGRESS"],
};

export function canTransition(from: ScheduleStatus, to: ScheduleStatus): boolean {
  if (from === to) return false;
  return SCHEDULE_TRANSITIONS[from].includes(to);
}

/**
 * `completion` que corresponde ao estado pedido.
 *
 * IN_PROGRESS preserva o avanço real quando a etapa já estava a meio; quando não
 * estava (0% ou 100%), arranca em 1% — o mínimo que significa "começou", sem
 * inventar uma percentagem arbitrária de meio caminho.
 */
export function completionForStatus(status: ScheduleStatus, current: number): number {
  const safe = Math.max(0, Math.min(100, current));
  if (status === "COMPLETED") return 100;
  if (status === "NOT_STARTED") return 0;
  return safe > 0 && safe < 100 ? safe : 1;
}

export function scheduleStatusFromPercentage(percentage: number): ScheduleStatus {
  if (percentage <= 0) return "NOT_STARTED";
  if (percentage >= 100) return "COMPLETED";
  return "IN_PROGRESS";
}

export function parseLegacyDate(value: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw new Error(`Data legada inválida: ${value}`);
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(`Data legada inválida: ${value}`);
  }
  return date;
}

export function sortLegacyTasks(tasks: readonly LegacyTask[]): LegacyTask[] {
  return [...tasks].sort((a, b) => a.ordem - b.ordem || parseLegacyDate(a.data_conclusao).getTime() - parseLegacyDate(b.data_conclusao).getTime());
}

export function averageSchedulePercentage(tasks: readonly Pick<LegacyTask, "porcentagem">[]): number {
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((total, task) => total + task.porcentagem, 0) / tasks.length);
}

export function toScheduleStageData(task: LegacyTask, projectId: string) {
  return {
    projectId,
    name: task.descricao_etapa,
    discipline: task.disciplina_projeto,
    designer: task.projetista,
    dueDate: parseLegacyDate(task.data_conclusao),
    endDate: parseLegacyDate(task.data_conclusao),
    status: scheduleStatusFromPercentage(task.porcentagem),
    completion: task.porcentagem,
    order: task.ordem,
  };
}
