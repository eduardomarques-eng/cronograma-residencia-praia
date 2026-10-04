import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "@/components/section-heading";
import { StageStatusControl } from "@/components/schedule/stage-status-control";
import { requirePageProjectAccess } from "@/server/auth";
import { kanbanBoard, type KanbanColumnId } from "@/server/services/schedule-service";
import { alertDetail, DUE_SOON_DAYS } from "@/lib/schedule-alerts";

export const dynamic = "force-dynamic";

const COLUMN_TONE: Record<KanbanColumnId, "red" | "neutral" | "blue" | "green"> = {
  ATRASADO: "red",
  NOT_STARTED: "neutral",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
};

/** Prioridade derivada da regra única de alertas — não é coluna na base. */
const PRIORITY_TONE = { ALTA: "red", MEDIA: "amber", NORMAL: "neutral" } as const;

/**
 * Cor do texto do alerta, por valor.
 *
 * Não pode ser `text-${tone}-700`: o Tailwind só gera as classes que encontra
 * no código, e uma classe montada em runtime não existe no CSS final.
 */
const ALERT_TEXT: Record<string, string> = {
  green: "text-emerald-700",
  red: "text-rose-700",
  amber: "text-amber-700",
  blue: "text-blue-700",
  neutral: "text-slate-500",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default async function CronogramaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  const board = await kanbanBoard(id);

  return (
    <AppShell eyebrow="Cronograma">
      <Link href={`/projetos/${id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
        ← Voltar ao projeto
      </Link>

      <SectionHeading
        title={`Cronograma — ${board.project.name}`}
        description="Cada etapa aparece numa única coluna, pelo seu estado real. O aviso vem da regra única de alertas."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={board.totals.overdue > 0 ? "red" : "green"}>
              {board.totals.overdue > 0 ? `${board.totals.overdue} atrasada(s)` : "Sem atrasos"}
            </Badge>
            {board.alerts.blocked > 0 ? <Badge tone="amber">{board.alerts.blocked} bloqueada(s)</Badge> : null}
            {board.alerts.dueSoon > 0 ? (
              <Badge tone="amber">
                {board.alerts.dueSoon} com prazo ≤ {DUE_SOON_DAYS} dias
              </Badge>
            ) : null}
            <Badge tone="blue">{board.totals.completion}%</Badge>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <Link href={`/admin/projetos/${id}/relatorio`} className="font-semibold text-blue-600 hover:text-blue-700">
          Relatório do cronograma →
        </Link>
      </div>

      {board.totals.stages === 0 ? (
        <Card className="mt-6 border-dashed text-center">
          <p className="py-8 text-sm text-slate-500">Este projeto ainda não tem etapas no cronograma.</p>
        </Card>
      ) : (
        // Kanban horizontal com scroll no próprio tabuleiro: em ecrãs estreitos
        // as colunas deslizam em vez de forçarem overflow da página.
        <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10">
          <div className="flex min-w-max gap-4">
            {board.columns.map((column) => (
              <section key={column.id} className="w-80 shrink-0" aria-label={column.label}>
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-700">{column.label}</h2>
                  <Badge tone={COLUMN_TONE[column.id]}>{column.cards.length}</Badge>
                </header>

                <div className="mt-3 space-y-3">
                  {column.cards.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      Sem etapas
                    </p>
                  ) : (
                    column.cards.map((card) => (
                      <Card key={card.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{card.name}</p>
                          <Badge tone={PRIORITY_TONE[card.priority]}>{card.priority}</Badge>
                        </div>
                        {card.discipline ? (
                          <p className="mt-1 text-xs text-slate-500">{card.discipline}</p>
                        ) : null}

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Avanço</span>
                            <span className="font-semibold text-slate-700">{card.completion}%</span>
                          </div>
                          <Progress value={card.completion} />
                        </div>

                        <dl className="mt-3 space-y-1 text-xs text-slate-500">
                          <div className="flex justify-between gap-2">
                            <dt>Responsável</dt>
                            <dd className={card.designer ? "text-slate-700" : "font-medium text-amber-700"}>
                              {card.designer ?? "Por atribuir"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Início</dt>
                            <dd className="text-slate-700">{formatDate(card.startDate)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Prazo</dt>
                            <dd className="text-slate-700">{formatDate(card.dueDate)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Status</dt>
                            <dd className="text-slate-700">{card.statusLabel}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Alerta</dt>
                            <dd className={ALERT_TEXT[card.alert.tone]}>
                              {card.alert.label} · {alertDetail(card.alert)}
                            </dd>
                          </div>
                          {card.dependencyName ? (
                            <div className="flex justify-between gap-2">
                              <dt>Depende de</dt>
                              <dd className="truncate text-slate-700">{card.dependencyName}</dd>
                            </div>
                          ) : null}
                        </dl>

                        <StageStatusControl
                          stageId={card.id}
                          stageName={card.name}
                          current={card.status}
                          allowed={card.allowedTransitions}
                        />
                      </Card>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}