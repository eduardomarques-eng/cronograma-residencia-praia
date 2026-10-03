import type { Discipline } from "./commercial-scope";

/**
 * Tópico 42 — prazos calculados a partir dos serviços contratados.
 *
 * A regra central: **não somar indiscriminadamente**. O prazo total é o
 * comprimento do CAMINHO CRÍTICO do grafo de dependências, não a soma de todas
 * as etapas. Etapas em paralelo reduzem o total, exatamente como na realidade.
 *
 * Quando uma disciplina não tem prazo cadastrado, o sistema não inventa: a
 * etapa é marcada como `SEM_PRAZO` e o total fica inconclusivo, sinalizando ao
 * ADMIN o que falta configurar (Tópico 30).
 */

export type ScheduleTask = {
  id: string;
  name: string;
  discipline?: Discipline | string | null;
  /** Prazo em dias, quando configurado. */
  durationDays?: number | null;
  /** Ids de tarefas que precisam terminar antes desta começar. */
  dependsOn?: readonly string[];
  /** Tarefas que podem correr em paralelo com esta, se o ADMIN configurar. */
  parallelWith?: readonly string[];
};

export type ScheduleNode = {
  id: string;
  name: string;
  discipline: string | null;
  durationDays: number;
  dependsOn: string[];
  parallelWith: string[];
  /** Dia de início (0-based, relativo ao início do cronograma). */
  startDay: number;
  endDay: number;
  /** `SEM_PRAZO` quando o prazo não foi cadastrado pelo ADMIN. */
  state: "PRONTO" | "SEM_PRAZO";
};

export type SmartSchedule = {
  tasks: ScheduleNode[];
  /** Caminho crítico; vazio quando falta prazo para fechar o total. */
  criticalPath: string[];
  /** Prazo total em dias, ou null enquanto houver tarefa sem prazo. */
  totalDays: number | null;
  /** Grupos de tarefas que realmente coincidiram no tempo. */
  parallelGroups: string[][];
  incomplete: ScheduleTask[];
  warnings: string[];
};

/**
 * Ordenação topológica com desempate estável por nome. Sem `Math.random` nem
 * `Date.now`: o resultado é sempre o mesmo para a mesma entrada.
 */
function topologicallySort(tasks: ScheduleTask[]): { order: ScheduleTask[]; cycle: string[] } {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const order: ScheduleTask[] = [];
  const visiting = new Set<string>();
  let cycle: string[] = [];

  const visit = (task: ScheduleTask, trail: string[]) => {
    if (visited.has(task.id)) return;
    if (visiting.has(task.id)) {
      cycle = [...new Set([...trail, task.id])];
      return;
    }
    visiting.add(task.id);
    for (const dependency of task.dependsOn ?? []) {
      const target = byId.get(dependency);
      // Dependência para tarefa inexistente é ignorada aqui e reportada como
      // aviso: não deve travar o cronograma do ADMIN.
      if (target) visit(target, [...trail, task.id]);
    }
    visiting.delete(task.id);
    visited.add(task.id);
    order.push(task);
  };

  for (const task of [...tasks].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
    visit(task, []);
  }
  return { order, cycle };
}


/**
 * Caminho crítico: a cadeia de tarefas cujo fim determina o fim do projeto.
 * Percorre o grafo de trás para a frente a partir da tarefa que termina por
 * último, escolhendo a predecessora mais longa em caso de empate.
 */
function findCriticalPath(nodes: ScheduleNode[]): string[] {
  if (!nodes.length) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const last = nodes.reduce((max, node) => (node.endDay > max.endDay ? node : max), nodes[0]);
  const path = [last.id];

  let current = last;
  // Cada passo recua para a predecessora mais longa. O limite evita ciclo
  // infinito se, apesar do aviso, sobrar dependência circular.
  for (let guard = 0; guard < nodes.length; guard += 1) {
    const predecessors = current.dependsOn
      .map((id) => byId.get(id))
      .filter((node): node is ScheduleNode => Boolean(node));
    if (!predecessors.length) break;
    current = predecessors.reduce((longest, node) =>
      node.endDay > longest.endDay ? node : longest,
    );
    path.unshift(current.id);
  }
  return path;
}

/**
 * Calcula o cronograma respeitando dependências e paralelismo configurado.
 *
 * O início de cada tarefa é o fim da última dependência. Tarefas declaradas
 * como paralelas alinham-se entre si sem violar dependências — é assim que o
 * paralelismo reduz o prazo total.
 */
export function buildSmartSchedule(tasks: ReadonlyArray<ScheduleTask>): SmartSchedule {
  const warnings: string[] = [];
  const list: ScheduleTask[] = tasks.map((task) => ({
    ...task,
    dependsOn: task.dependsOn ?? [],
    parallelWith: task.parallelWith ?? [],
  }));

  if (!list.length) {
    return { tasks: [], criticalPath: [], totalDays: 0, parallelGroups: [], incomplete: [], warnings: [] };
  }

  const { order, cycle } = topologicallySort(list);
  if (cycle.length) {
    warnings.push(`Dependência circular entre etapas: ${cycle.join(" → ")}. O cálculo seguiu ignorando o ciclo.`);
  }

  const ids = new Set(list.map((task) => task.id));
  for (const task of list) {
    for (const dependency of task.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        warnings.push(`A etapa “${task.name}” depende de “${dependency}”, que não existe no escopo.`);
      }
    }
  }

  const nodes = new Map<string, ScheduleNode>();
  const incomplete = list.filter(
    (task) => !Number.isFinite(task.durationDays) || (task.durationDays ?? 0) <= 0,
  );
  for (const task of incomplete) {
    warnings.push(`A etapa “${task.name}” não tem prazo cadastrado; o prazo total fica inconclusivo.`);
  }

  for (const task of order) {
    const duration =
      Number.isFinite(task.durationDays) && (task.durationDays ?? 0) > 0
        ? Math.round(task.durationDays as number)
        : 0;

    // Início = maior fim entre as dependências realmente existentes.
    const dependencyEnds = (task.dependsOn ?? [])
      .map((id) => nodes.get(id))
      .filter((node): node is ScheduleNode => Boolean(node))
      .map((node) => node.endDay);
    const dependencyStart = dependencyEnds.length ? Math.max(...dependencyEnds) : 0;

    // Paralelismo configurado: alinha às tarefas parceiras já posicionadas,
    // sem ultrapassar a dependência mais longa.
    const peerStarts = (task.parallelWith ?? [])
      .map((id) => nodes.get(id))
      .filter((node): node is ScheduleNode => Boolean(node))
      .map((node) => node.startDay);
    const peerStart = peerStarts.length ? Math.max(...peerStarts) : 0;

    const startDay = Math.max(dependencyStart, peerStart);

    nodes.set(task.id, {
      id: task.id,
      name: task.name,
      discipline: (task.discipline as string) ?? null,
      durationDays: duration,
      dependsOn: [...(task.dependsOn ?? [])],
      parallelWith: [...(task.parallelWith ?? [])],
      startDay,
      endDay: startDay + duration,
      state: duration > 0 ? "PRONTO" : "SEM_PRAZO",
    });
  }

  const orderedNodes = order
    .map((task) => nodes.get(task.id))
    .filter((node): node is ScheduleNode => Boolean(node));

  const totalDays = incomplete.length
    ? null
    : orderedNodes.reduce((max, node) => Math.max(max, node.endDay), 0);

  const criticalPath = totalDays === null ? [] : findCriticalPath(orderedNodes);

  // Grupos reais de paralelismo: tarefas que começam no mesmo dia.
  const byStart = new Map<number, string[]>();
  for (const node of orderedNodes) {
    const group = byStart.get(node.startDay) ?? [];
    group.push(node.id);
    byStart.set(node.startDay, group);
  }

  return {
    tasks: orderedNodes,
    criticalPath,
    totalDays,
    parallelGroups: [...byStart.values()].filter((group) => group.length > 1),
    incomplete,
    warnings,
  };
}
