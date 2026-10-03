import { describe, expect, it } from "vitest";
import { buildSmartSchedule, type ScheduleTask } from "./smart-schedule";

describe("buildSmartSchedule — dependências", () => {
  it("encadeia anteprojeto → aprovação → executivo em vez de somar", () => {
    const tasks: ScheduleTask[] = [
      { id: "ante", name: "Anteprojeto", durationDays: 10 },
      { id: "apr", name: "Aprovação", durationDays: 5, dependsOn: ["ante"] },
      { id: "exe", name: "Executivo", durationDays: 20, dependsOn: ["apr"] },
    ];
    const result = buildSmartSchedule(tasks);
    // Encadeado = 10 + 5 + 20 = 35. Uma soma indiscriminada daria o mesmo
    // número aqui; o que distingue é a data de início de cada etapa.
    expect(result.totalDays).toBe(35);
    expect(result.tasks.find((t) => t.id === "ante")?.startDay).toBe(0);
    expect(result.tasks.find((t) => t.id === "apr")?.startDay).toBe(10);
    expect(result.tasks.find((t) => t.id === "exe")?.startDay).toBe(15);
  });

  it("ordena topologicamente mesmo com dependências invertidas", () => {
    const tasks: ScheduleTask[] = [
      { id: "c", name: "C", durationDays: 5, dependsOn: ["b"] },
      { id: "b", name: "B", durationDays: 5, dependsOn: ["a"] },
      { id: "a", name: "A", durationDays: 5 },
    ];
    const result = buildSmartSchedule(tasks);
    expect(result.tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(result.totalDays).toBe(15);
  });

  it("não trava com dependência circular e avisa o ADMIN", () => {
    const tasks: ScheduleTask[] = [
      { id: "a", name: "A", durationDays: 5, dependsOn: ["b"] },
      { id: "b", name: "B", durationDays: 5, dependsOn: ["a"] },
    ];
    const result = buildSmartSchedule(tasks);
    expect(result.warnings.some((w) => w.includes("circular"))).toBe(true);
    expect(result.tasks).toHaveLength(2);
  });

  it("avisa quando a dependência não existe no escopo", () => {
    const result = buildSmartSchedule([
      { id: "a", name: "A", durationDays: 5, dependsOn: ["fantasma"] },
    ]);
    expect(result.warnings.some((w) => w.includes("não existe no escopo"))).toBe(true);
    // A etapa continua a ser calculada: o ADMIN vê o aviso e corrige.
    expect(result.totalDays).toBe(5);
  });
});

describe("buildSmartSchedule — paralelismo", () => {
  it("etapas paralelas reduzem o prazo total em vez de somar", () => {
    const tasks: ScheduleTask[] = [
      { id: "arq", name: "Arquitetura", durationDays: 20 },
      { id: "est", name: "Estrutural", durationDays: 15, parallelWith: ["arq"] },
      { id: "comp", name: "Complementares", durationDays: 10, parallelWith: ["arq"] },
    ];
    const result = buildSmartSchedule(tasks);
    // Soma indiscriminada seria 45. Em paralelo, o caminho mais longo vence: 20.
    expect(result.totalDays).toBe(20);
    expect(result.parallelGroups.length).toBeGreaterThan(0);
  });

  it("a dependência prevalece sempre sobre o paralelismo", () => {
    const tasks: ScheduleTask[] = [
      { id: "a", name: "A", durationDays: 10 },
      { id: "b", name: "B", durationDays: 10, parallelWith: ["a"], dependsOn: ["a"] },
    ];
    const result = buildSmartSchedule(tasks);
    expect(result.tasks.find((t) => t.id === "b")?.startDay).toBe(10);
    expect(result.totalDays).toBe(20);
  });

  it("mistura paralelo e encadeado sem somar tudo", () => {
    const tasks: ScheduleTask[] = [
      { id: "ante", name: "Anteprojeto", durationDays: 10 },
      { id: "arq", name: "Arquitetura", durationDays: 20, dependsOn: ["ante"] },
      { id: "est", name: "Estrutural", durationDays: 15, dependsOn: ["ante"], parallelWith: ["arq"] },
      { id: "render", name: "Render", durationDays: 8, dependsOn: ["arq"] },
    ];
    const result = buildSmartSchedule(tasks);
    // 10 (ante) + max(20, 15) = 30; render começa em 30 e leva 8 → 38.
    expect(result.totalDays).toBe(38);
  });
});

describe("buildSmartSchedule — integridade", () => {
  it("não inventa prazo quando falta configuração", () => {
    const result = buildSmartSchedule([
      { id: "a", name: "Arquitetura", durationDays: null },
      { id: "b", name: "Render", durationDays: 8, dependsOn: ["a"] },
    ]);
    expect(result.totalDays).toBeNull();
    expect(result.tasks.find((t) => t.id === "a")?.state).toBe("SEM_PRAZO");
    expect(result.warnings.some((w) => w.includes("não tem prazo"))).toBe(true);
  });

  it("ignora duração zero ou negativa", () => {
    const result = buildSmartSchedule([
      { id: "a", name: "A", durationDays: 0 },
      { id: "b", name: "B", durationDays: -5 },
    ]);
    expect(result.totalDays).toBeNull();
  });

  it("identifica o caminho crítico", () => {
    const result = buildSmartSchedule([
      { id: "ante", name: "Anteprojeto", durationDays: 10 },
      { id: "exe", name: "Executivo", durationDays: 30, dependsOn: ["ante"] },
      { id: "det", name: "Detalhamento", durationDays: 5, parallelWith: ["exe"] },
    ]);
    expect(result.criticalPath).toEqual(["ante", "exe"]);
  });

  it("listas vazias e vazias produzem resultado trivial", () => {
    expect(buildSmartSchedule([]).totalDays).toBe(0);
    expect(buildSmartSchedule([]).tasks).toEqual([]);
  });

  it("é determinístico: a mesma entrada produz a mesma saída", () => {
    const tasks: ScheduleTask[] = [
      { id: "b", name: "B", durationDays: 5, dependsOn: ["a"] },
      { id: "a", name: "A", durationDays: 5 },
    ];
    const first = buildSmartSchedule(tasks);
    const second = buildSmartSchedule([...tasks].reverse());
    expect(second.tasks.map((t) => t.id)).toEqual(first.tasks.map((t) => t.id));
    expect(second.totalDays).toBe(first.totalDays);
  });
});
