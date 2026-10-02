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
