import { completionOf, phasesByDiscipline, stageCompletion, type PhaseProgress } from "./progress";
import { calculateFinancialSummary, paymentStatusLabels, type FinancialSummary } from "./finance";
import {
  alertDetail,
  attentionList,
  stageAlert,
  summarizeAlerts,
  type ScheduleAlertSummary,
  type StageAlert,
} from "./schedule-alerts";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "./schedule";
import { formatCurrencyBRL, formatDateBR } from "./contract-template";

/**
 * FASE 3 — modelo do "Relatório Executivo de Cronograma & Obras".
 *
 * FONTE DA ESTRUTURA: o PDF de referência não está no workspace (procura
 * recursiva em todo o volume, zero ficheiros .pdf/.docx). A estrutura usada aqui
 * foi extraída da implementação que já reproduzia esse documento —
 * `index.html` (secção "RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS", linhas
 * 752-1056), `app.js` (secção 17) e `painel-cliente.js` (blocos do relatório).
 * Mantêm-se a numeração e os títulos das 8 secções.
 *
 * O que NÃO foi inventado: campos que a referência mostra mas que o modelo não
 * tem (área construída, lote/quadra, zoneamento) são lidos de `Project.address`
 * quando o ADMIN os guardou e impressos como "Não informado" quando não. Não há
 * número, cláusula nem nome de pessoa gerado por este módulo.
 *
 * Determinístico: a saída é função pura de `input` + `emittedAt`. Sem
 * `Date.now()`, sem aleatoriedade — o mesmo conjunto de dados produz sempre o
 * mesmo documento, que é o requisito do gerador de documentos.
 */

export const REPORT_TITLE = "RELATÓRIO EXECUTIVO DE CRONOGRAMA & OBRAS";
export const REPORT_SUBTITLE = "ArqVértice • Arquitetura, Estrutura & Engenharia";
export const REPORT_DOCUMENT_KIND = "Dossiê de Acompanhamento Físico";

export type ReportStage = {
  id: string;
  name: string;
  discipline: string | null;
  designer: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
  completion: number;
  status: string;
  order: number;
  dependencyName: string | null;
  dependencyStatus: string | null;
};

export type ReportPayment = {
  id: string;
  name: string;
  amount: number;
  dueDate: Date | null;
  paidAt: Date | null;
  status: string;
  stageName: string | null;
};

export type ScheduleReportInput = {
  project: {
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    scope: string | null;
    startDate: Date | null;
    expectedEndDate: Date | null;
    status: string;
    address: Record<string, unknown> | null;
  };
  client: { name: string; fullName: string | null; city: string | null; state: string | null };
  stages: ReportStage[];
  payments: ReportPayment[];
  /** Valor contratado; `null` quando o ADMIN ainda não registou. */
  budget: number | null;
  /** Momento da emissão. Vem do chamador para a saída ser determinística. */
  emittedAt: Date;
};

export type ReportRow = { label: string; value: string };

export type ReportStageRow = {
  order: number;
  name: string;
  discipline: string;
  designer: string;
  dueDate: string;
  completion: number;
  statusLabel: string;
  alert: StageAlert;
  alertDetail: string;
  dependency: string;
};

export type ReportAlertRow = { stage: string; detail: string; priority: string };

export type ScheduleReport = {
  title: string;
  subtitle: string;
  documentKind: string;
  emittedAtLabel: string;
  statusGeral: string;
  statusGeralTone: "green" | "blue";
  /** Secção 1 — ficha técnica. */
  ficha: ReportRow[];
  /** Secção 2 — quadro técnico (equipe real). */
  equipe: { name: string; role: string; disciplines: string; stages: number; progress: number }[];
  /** Secção 3 — fases e fase atual. */
  phases: (PhaseProgress & { current: boolean; state: string })[];
  currentPhase: string | null;
  /** Secção 4 — parecer executivo. */
  parecer: string[];
  /** Secção 5 — avanço físico. */
  overall: { progress: number; completed: number; total: number };
  disciplines: PhaseProgress[];
  /** Secção 6 — financeiro. */
  financial: {
    summary: FinancialSummary;
    rows: { label: string; value: string }[];
    payments: { name: string; dueDate: string; paidAt: string; stage: string; status: string; amount: string }[];
    nextPayment: string;
  };
  /** Secção 7 — quadro consolidado de etapas. */
  stages: ReportStageRow[];
  /** Secção 8 — critérios de acompanhamento e alertas. */
  criteria: { label: string; description: string }[];
  alerts: ScheduleAlertSummary;
  alertRows: ReportAlertRow[];
  /** Assinaturas: quem assinou de facto, mais o cliente do projecto. */
  signatures: { name: string; role: string }[];
  /** Verdadeiro quando o projecto ainda não tem etapas cadastradas. */
  empty: boolean;
};

/** Rótulos dos critérios de acompanhamento — a legenda oficial do relatório. */
export const REPORT_CRITERIA: { label: string; description: string }[] = [
  { label: "0% — Não iniciada", description: "Etapa sem avanço registado." },
  { label: "1% a 99% — Em andamento", description: "Etapa em desenvolvimento ativo." },
  { label: "100% — Concluída", description: "Etapa entregue; conta 100% mesmo que a percentagem fique por fechar." },
  { label: "Prazo vencido — Atrasada", description: "Prazo passou e a etapa não está concluída." },
  { label: `Prazo em 7 dias ou menos — Prazo próximo`, description: "Janela de alerta da legenda oficial do cronograma." },
  { label: "Dependência pendente — Bloqueada", description: "A etapa depende de outra que ainda não está concluída." },
  { label: "Sem prazo", description: "Etapa sem data limite cadastrada; não é atraso, é dado em falta." },
];

/** Marcas de combinação: o que fica depois de "NFD" num acento. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Campo do `Project.address` (Json livre) por lista de chaves possíveis.
 *
 * A referência mostra área, lote/quadra e zoneamento, mas o modelo não tem
 * colunas para isso — o ADMIN grava o que tem no `address`. Se não houver nada,
 * devolve `null` e o relatório imprime "Não informado". Nada é preenchido por
 * conta própria.
 */
function addressField(
  address: Record<string, unknown> | null,
  keys: readonly string[],
): string | null {
  if (!address) return null;
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(address)) {
    normalized.set(
      key
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ""),
      value,
    );
  }
  for (const key of keys) {
    const value = normalized.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function orDash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "Não informado";
}

function dateOrDash(date: Date | null): string {
  return date ? formatDateBR(date) : "—";
}

/** "01/06/2026 a 30/11/2026", ou "—" quando falta um dos lados. */
function dateRange(from: Date | null, to: Date | null): string {
  if (!from && !to) return "—";
  return `${from ? formatDateBR(from) : "—"} a ${to ? formatDateBR(to) : "—"}`;
}

/** Secção 2 — quadro técnico: quem responde por quê, com a carga real. */
function buildEquipe(stages: ReportStage[]): ScheduleReport["equipe"] {
  const byDesigner = new Map<string, { disciplines: Set<string>; total: number; done: number }>();
  for (const stage of stages) {
    const name = stage.designer?.trim();
    if (!name) continue;
    const entry = byDesigner.get(name) ?? { disciplines: new Set<string>(), total: 0, done: 0 };
    entry.total += 1;
    if (stageCompletion(stage) === 100) entry.done += 1;
    if (stage.discipline?.trim()) entry.disciplines.add(stage.discipline.trim());
    byDesigner.set(name, entry);
  }
  return [...byDesigner.entries()]
    .map(([name, entry]) => ({
      name,
      role: entry.total === 1 ? "Responsável técnico" : "Responsável técnico",
      disciplines: [...entry.disciplines].toSorted((a, b) => a.localeCompare(b, "pt-BR")).join(", ") || "Geral",
      stages: entry.total,
      progress: completionOf(stages.filter((stage) => stage.designer?.trim() === name)),
    }))
    .toSorted((a, b) => b.progress - a.progress || a.name.localeCompare(b.name, "pt-BR"));
}

/** Secção 3 — fases; a atual é a primeira abaixo de 100%. */
function buildPhases(stages: ReportStage[]) {
  const phases = phasesByDiscipline(stages);
  const current = phases.find((phase) => phase.progress < 100) ?? phases[phases.length - 1] ?? null;
  return {
    phases: phases.map((phase) => ({
      ...phase,
      current: current ? phase.discipline === current.discipline : false,
      state:
        phase.total === 0
          ? "Aguardando"
          : phase.progress >= 100
            ? "Concluída"
            : phase.progress > 0
              ? "Em andamento"
              : "Não iniciada",
    })),
    currentPhase: current ? current.discipline : null,
  };
}

/**
 * Secção 4 — parecer executivo.
 *
 * Calculado a partir das etapas reais, como na referência. Texto fixo envelheceria
 * a cada actualização do cronograma; aqui cada linha reflecte o estado de agora.
 */
function buildParecer(
  project: ScheduleReportInput["project"],
  client: ScheduleReportInput["client"],
  rows: ReportStageRow[],
): string[] {
  const clientName = client.fullName?.trim() || client.name;
  const paragraphs: string[] = [
    `Prezado cliente ${clientName}, o presente relatório consolida o acompanhamento físico e o planejamento executivo da obra ${project.name}.`,
  ];

  if (rows.length === 0) {
    paragraphs.push(
      "O projecto ainda não tem etapas cadastradas no cronograma. Sem etapas não há avanço físico a declarar: a percentagem geral apresentada é 0% e nenhum prazo pode ser verificado.",
    );
    return paragraphs;
  }

  const done = rows.filter((row) => row.completion === 100);
  const running = rows.filter((row) => row.completion > 0 && row.completion < 100);
  const pending = rows.filter((row) => row.completion === 0);
  const overdue = rows.filter((row) => row.alert.overdue);
  const blocked = rows.filter((row) => row.alert.blocked);

  const names = (list: ReportStageRow[], withProgress: boolean) =>
    list
      .map((row) => `${row.name}${withProgress ? ` (${row.completion}%)` : ""}`)
      .join(", ");

  if (done.length) paragraphs.push(`Etapas concluídas: ${names(done, false)}.`);
  if (running.length) paragraphs.push(`Etapas em desenvolvimento ativo: ${names(running, true)}.`);
  if (pending.length) paragraphs.push(`Próximas etapas programadas: ${names(pending.slice(0, 6), false)}.`);
  if (blocked.length) {
    paragraphs.push(
      `Etapas bloqueadas por dependência pendente: ${names(blocked, false)}. Estas etapas só entram em andamento depois de a etapa de que dependem ser concluída.`,
    );
  }
  if (overdue.length) {
    paragraphs.push(
      `Entregas com prazo vencido: ${names(overdue, true)}. Estas etapas estão em regime de recuperação de prazo e pedem plano de reacção.`,
    );
  }
  return paragraphs;
}
/**
 * Monta o relatório a partir de dados já lidos.
 *
 * Não consulta a base e não sabe de React: o serviço entrega o `input` e esta
 * função devolve o documento. É o mesmo contrato do gerador de propostas, e é o
 * que permite gerar o PDF e a página do ecrã a partir do MESMO objecto — o
 * cliente nunca vê um número diferente do PDF.
 */
export function buildScheduleReport(input: ScheduleReportInput): ScheduleReport {
  const { project, client, stages, payments, budget, emittedAt } = input;
  const now = emittedAt;

  const rows: ReportStageRow[] = [...stages]
    .toSorted((a, b) => a.order - b.order || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .map((stage) => {
      const alert = stageAlert(
        {
          status: stage.status,
          dueDate: stage.dueDate,
          dependencyName: stage.dependencyName,
          dependencyStatus: stage.dependencyStatus,
        },
        now,
      );
      return {
        order: stage.order,
        name: stage.name,
        discipline: stage.discipline?.trim() || "Geral",
        designer: stage.designer?.trim() || "Por atribuir",
        dueDate: dateOrDash(stage.dueDate),
        completion: stageCompletion(stage),
        statusLabel: SCHEDULE_STATUS_LABELS[stage.status as ScheduleStatus] ?? stage.status,
        alert,
        alertDetail: alertDetail(alert),
        dependency: stage.dependencyName ? stage.dependencyName : "—",
      };
    });

  const overall = completionOf(stages);
  const alerts = summarizeAlerts(rows.map((row) => row.alert));
  const address = project.address;
  const phases = buildPhases(stages);
  const summary = calculateFinancialSummary(
    budget,
    payments.map((payment) => ({ amount: payment.amount, status: payment.status as never })),
  );

  const nextPayment = payments
    .filter((payment) => payment.status !== "PAID")
    .toSorted((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];

  const attention = attentionList(rows.map((row) => ({ name: row.name, alert: row.alert })));

  return {
    title: REPORT_TITLE,
    subtitle: REPORT_SUBTITLE,
    documentKind: REPORT_DOCUMENT_KIND,
    emittedAtLabel: formatDateBR(emittedAt),
    statusGeral: overall >= 100 ? "100% concluído" : `Em andamento (${overall}%)`,
    statusGeralTone: overall >= 100 ? "green" : "blue",
    ficha: [
      { label: "Obra", value: project.name },
      { label: "Cliente / Contratante", value: client.fullName?.trim() || client.name },
      {
        label: "Localização",
        value: orDash(
          addressField(address, ["localizacao", "location", "endereco", "address", "logradouro"]) ??
            [client.city, client.state].filter(Boolean).join(" - ") ??
            null,
        ),
      },
      { label: "Lote / Quadra", value: orDash(addressField(address, ["lote", "quadra", "lotequadra"])) },
      { label: "Área construída", value: orDash(addressField(address, ["areaconstruida", "area", "areatotal"])) },
      { label: "Área do lote", value: orDash(addressField(address, ["areaterreno", "areadoterreno", "arealote"])) },
      { label: "Zoneamento", value: orDash(addressField(address, ["zoneamento", "zona"])) },
      { label: "Tipo de empreendimento", value: orDash(project.type) },
      { label: "Cronograma contratual", value: dateRange(project.startDate, project.expectedEndDate) },
    ],
    equipe: buildEquipe(stages),
    phases: phases.phases,
    currentPhase: phases.currentPhase,
    parecer: buildParecer(project, client, rows),
    overall: {
      progress: overall,
      completed: rows.filter((row) => row.completion === 100).length,
      total: rows.length,
    },
    disciplines: phasesByDiscipline(stages),
    financial: {
      summary,
      rows: [
        { label: "Valor contratado", value: summary.contractedValue === null ? "Não informado" : formatCurrencyBRL(summary.contractedValue) },
        { label: "Valor pago", value: payments.length ? formatCurrencyBRL(summary.totalPaid) : "—" },
        { label: "Valor pendente", value: payments.length ? formatCurrencyBRL(summary.totalPending) : "—" },
        { label: "Saldo a receber", value: summary.remainingBalance === null ? "Não informado" : formatCurrencyBRL(summary.remainingBalance) },
      ],
      payments: payments.map((payment) => ({
        name: payment.name,
        dueDate: dateOrDash(payment.dueDate),
        paidAt: dateOrDash(payment.paidAt),
        stage: payment.stageName ?? "—",
        status: paymentStatusLabels[payment.status as keyof typeof paymentStatusLabels] ?? payment.status,
        amount: formatCurrencyBRL(payment.amount),
      })),
      nextPayment: nextPayment
        ? `Próximo pagamento: ${nextPayment.name} · ${dateOrDash(nextPayment.dueDate)} · ${formatCurrencyBRL(nextPayment.amount)}`
        : payments.some((payment) => payment.status !== "PAID")
          ? "Há parcelas pendentes sem data prevista."
          : "Nenhuma parcela pendente.",
    },
    stages: rows,
    criteria: REPORT_CRITERIA,
    alerts,
    alertRows: attention.map((stage) => ({
      stage: stage.name,
      detail: alertDetail(stage.alert),
      priority: stage.alert.priority,
    })),
    signatures: [
      ...buildEquipe(stages).map((person) => ({ name: person.name, role: person.disciplines })),
      { name: client.fullName?.trim() || client.name, role: "Cliente / Contratante" },
    ],
    empty: rows.length === 0,
  };
}
