/**
 * REGRA ÚNICA DE PROGRESSO — Fase 3.
 *
 * Só existe fonte de verdade: `ScheduleStage.completion` (0-100) guardado por
 * etapa. O progresso da disciplina é a média das suas etapas; o do projecto é a
 * média de todas as etapas. Calcular de outra forma em algum ecrã cria duas
 * verdades para o mesmo número.
 *
 * Antes vivia em `dashboard-service.ts` e era copiado por `schedule-service.ts`
 * (`stageCompletionValue`). A cópia foi removida: este módulo é o ÚNICO lugar
 * onde a regra existe, e `dashboard-service` reexporta daqui para não partir os
 * consumidores existentes.
 *
 * Fica em `src/lib/` porque é domínio puro: sem I/O, sem banco, sem React.
 */

export type StageProgress = { completion: number; status: string };

/**
 * Avanço de UMA etapa.
 *
 * Etapa concluída conta sempre 100, mesmo que `completion` tenha ficado abaixo
 * (etapa marcada como concluída mas por fechar a percentagem).
 */
export function stageCompletion(stage: StageProgress): number {
  if (stage.status === "COMPLETED") return 100;
  return Math.max(0, Math.min(100, stage.completion));
}

/** Média arredondada. Lista vazia é 0 — nunca `NaN`. */
export function averageCompletion(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Avanço médio de um conjunto de etapas, pela regra de cima. */
export function completionOf(stages: ReadonlyArray<StageProgress>): number {
  return averageCompletion(stages.map(stageCompletion));
}

export type DisciplineProgress = { discipline: string; progress: number };

/** Progresso por disciplina de um conjunto de etapas. */
export function progressByDiscipline(
  stages: ReadonlyArray<StageProgress & { discipline: string | null }>,
): DisciplineProgress[] {
  const byDiscipline = new Map<string, number[]>();
  for (const stage of stages) {
    const key = stage.discipline?.trim() || "Geral";
    const list = byDiscipline.get(key) ?? [];
    list.push(stageCompletion(stage));
    byDiscipline.set(key, list);
  }
  return [...byDiscipline.entries()]
    .map(([discipline, values]) => ({ discipline, progress: averageCompletion(values) }))
    .sort((a, b) => a.discipline.localeCompare(b.discipline, "pt-BR"));
}

export type PhaseProgress = DisciplineProgress & {
  total: number;
  completed: number;
};

/**
 * Fases do empreendimento, na ordem alfabetica usada pelo relatorio.
 *
 * Reutiliza `progressByDiscipline` — a media continua a ser a mesma regra, so
 * muda o agrupamento. Disciplinas sem nenhuma etapa ficam de fora: uma fase sem
 * etapa nao e uma fase do projeto.
 */
export function phasesByDiscipline(
  stages: ReadonlyArray<StageProgress & { discipline: string | null }>,
): PhaseProgress[] {
  const rows = progressByDiscipline(stages);
  return rows
    .map((row) => {
      const own = stages.filter(
        (stage) => (stage.discipline?.trim() || "Geral") === row.discipline,
      );
      return {
        ...row,
        total: own.length,
        completed: own.filter((stage) => stageCompletion(stage) === 100).length,
      };
    })
    .sort((a, b) => a.discipline.localeCompare(b.discipline, "pt-BR"));
}