/**
 * REGRA ÚNICA DE ATRASOS E ALERTAS — Fase 3.
 *
 * Antes desta fase o mesmo conceito estava espalhado: `columnFor` no quadro,
 * `delayedStages` no painel, `getDaysRemaining` no painel legado. Três
 * vocabulários para a mesma pergunta. Aqui passa a haver UMA resposta, e todas
 * as telas consomem esta função.
 *
 * Os nomes vêm do enunciado da fase; o que decide é a CONDIÇÃO, que se
 * apoia apenas em dados que existem no modelo:
 *
 *   · `completed`    — etapa concluída (`status === "COMPLETED"`).
 *   · `blocked`      — a etapa tem `dependencyId` e essa dependência ainda NAO
 *     está concluída. No modelo não existe estado "bloqueado": é exatamente
 *     isto. `blocked` e `pendingDependency` são o mesmo fato, com dois nomes
 *     porque o enunciado os pede assim.
 *   · `noDueDate`    — etapa sem prazo cadastrado. Não é atraso nem "em dia":
 *     é falta de dado, e aparece como tal.
 *   · `overdue`      — prazo já passou e a etapa não está concluída.
 *   · `dueSoon`      — prazo vence dentro da janela de alerta.
 *
 * A ordem importa: concluído vence tudo; sem prazo não é atraso; bloqueada
 * ganha de atrasada, porque a causa é a dependência e não o calendário.
 *
 * A janela de alerta vem da legenda oficial do relatório de referência:
 * "Alerta: Entrega em 7 dias ou menos".
 */

export const DUE_SOON_DAYS = 7;

export type AlertKind =
  | "COMPLETED"
  | "NO_DUE_DATE"
  | "BLOCKED"
  | "OVERDUE"
  | "DUE_SOON"
  | "ON_TRACK";

export type AlertTone = "green" | "neutral" | "red" | "amber" | "blue";

export type AlertPriority = "ALTA" | "MEDIA" | "NORMAL";

export type StageAlert = {
  kind: AlertKind;
  /** Rótulo em português, pronto para UI e para PDF. */
  label: string;
  tone: AlertTone;
  /** Dias até o prazo. Negativo = vencido. `null` quando não há prazo. */
  daysRemaining: number | null;
  completed: boolean;
  blocked: boolean;
  pendingDependency: boolean;
  overdue: boolean;
  dueSoon: boolean;
  noDueDate: boolean;
  /** Prioridade DERIVADA desta regra — não é coluna na base. */
  priority: AlertPriority;
};

export type AlertInput = {
  status: string;
  dueDate: Date | null;
  /** Nome da etapa de que esta depende, quando existe. */
  dependencyName?: string | null;
  /** Estado da etapa de que esta depende, quando existe. */
  dependencyStatus?: string | null;
};

/**
 * Diferença em dias CORRIDOS entre o prazo e agora.
 *
 * Usa UTC de propósito: o servidor pode estar em qualquer fuso (a Vercel roda em
 * UTC) e o mesmo conjunto de etapas tem de dar o mesmo resultado em todos os
 * ambientes. Comparar milissegundos daria 1 dia a mais quando a etapa foi criada
 * às 18h.
 */
export function daysUntil(dueDate: Date, now: Date): number {
  const day = (value: Date) =>
    Math.floor(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86_400_000,
    );
  return day(dueDate) - day(now);
}

/**
 * Prioridade derivada da mesma regra — usada porque o modelo não tem coluna de
 * prioridade. Sem segunda verdade: sai daqui, não de outro ecrã.
 */
function priorityOf(kind: AlertKind): AlertPriority {
  if (kind === "OVERDUE" || kind === "BLOCKED") return "ALTA";
  if (kind === "DUE_SOON") return "MEDIA";
  return "NORMAL";
}

export const ALERT_LABELS: Record<AlertKind, string> = {
  COMPLETED: "Concluída",
  NO_DUE_DATE: "Sem prazo",
  BLOCKED: "Bloqueada",
  OVERDUE: "Atrasada",
  DUE_SOON: "Prazo próximo",
  ON_TRACK: "Em dia",
};

export const ALERT_TONES: Record<AlertKind, AlertTone> = {
  COMPLETED: "green",
  NO_DUE_DATE: "neutral",
  BLOCKED: "amber",
  OVERDUE: "red",
  DUE_SOON: "amber",
  ON_TRACK: "blue",
};

/** A resposta única para "como está esta etapa?". */
export function stageAlert(input: AlertInput, now: Date): StageAlert {
  const completed = input.status === "COMPLETED";
  const hasDependency = Boolean(input.dependencyName);
  const pendingDependency = !completed && hasDependency && input.dependencyStatus !== "COMPLETED";
  const noDueDate = !completed && !input.dueDate;
  const daysRemaining = input.dueDate ? daysUntil(input.dueDate, now) : null;
  const overdue = !completed && daysRemaining !== null && daysRemaining < 0;
  const dueSoon =
    !completed && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= DUE_SOON_DAYS;

  let kind: AlertKind = "ON_TRACK";
  if (completed) kind = "COMPLETED";
  else if (noDueDate) kind = "NO_DUE_DATE";
  else if (pendingDependency) kind = "BLOCKED";
  else if (overdue) kind = "OVERDUE";
  else if (dueSoon) kind = "DUE_SOON";

  return {
    kind,
    label: ALERT_LABELS[kind],
    tone: ALERT_TONES[kind],
    daysRemaining,
    completed,
    blocked: pendingDependency,
    pendingDependency,
    overdue,
    dueSoon,
    noDueDate,
    priority: priorityOf(kind),
  };
}

/** Frase curta do alerta, usada na tabela do relatório e no cartão do quadro. */
export function alertDetail(alert: StageAlert): string {
  if (alert.kind === "COMPLETED") return "Concluída";
  if (alert.kind === "NO_DUE_DATE") return "Sem prazo cadastrado";
  if (alert.kind === "BLOCKED") return "Dependência pendente";
  const days = alert.daysRemaining ?? 0;
  if (alert.overdue) return `${Math.abs(days)} dia(s) em atraso`;
  if (alert.dueSoon) return days === 0 ? "Vence hoje" : `Vence em ${days} dia(s)`;
  return `${days} dia(s) restantes`;
}

export type ScheduleAlertSummary = {
  overdue: number;
  dueSoon: number;
  blocked: number;
  noDueDate: number;
  completed: number;
  onTrack: number;
  /** Etapas que exigem acção: atraso, prazo próximo ou bloqueio. */
  attention: number;
};

/** Contagem por estado de alerta — painel, quadro e relatório usam a mesma. */
export function summarizeAlerts(alerts: readonly StageAlert[]): ScheduleAlertSummary {
  return {
    overdue: alerts.filter((alert) => alert.overdue).length,
    dueSoon: alerts.filter((alert) => alert.dueSoon).length,
    blocked: alerts.filter((alert) => alert.blocked).length,
    noDueDate: alerts.filter((alert) => alert.noDueDate).length,
    completed: alerts.filter((alert) => alert.completed).length,
    onTrack: alerts.filter((alert) => alert.kind === "ON_TRACK").length,
    attention: alerts.filter((alert) => alert.overdue || alert.dueSoon || alert.blocked).length,
  };
}

/** Rank de gravidade: o que bloqueia ou venceu vem primeiro. */
const ALERT_RANK: Record<AlertKind, number> = {
  BLOCKED: 0,
  OVERDUE: 1,
  DUE_SOON: 2,
  NO_DUE_DATE: 3,
  ON_TRACK: 4,
  COMPLETED: 5,
};

/** As etapas que exigem acção, das mais graves para as menos graves. */
export function attentionList<T extends { alert: StageAlert }>(stages: readonly T[]): T[] {
  return stages
    .filter((stage) => stage.alert.overdue || stage.alert.dueSoon || stage.alert.blocked)
    .toSorted((a, b) => ALERT_RANK[a.alert.kind] - ALERT_RANK[b.alert.kind]);
}