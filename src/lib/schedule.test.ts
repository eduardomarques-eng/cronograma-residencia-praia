import { describe, expect, it } from "vitest";
import {
  averageSchedulePercentage,
  parseLegacyDate,
  scheduleStatusFromPercentage,
  sortLegacyTasks,
  toScheduleStageData,
} from "./schedule";

const tasks = [
  { id: "2", descricao_etapa: "B", disciplina_projeto: "3D", projetista: "Equipe", data_conclusao: "15-08-2026", porcentagem: 0, ordem: 2 },
  { id: "1", descricao_etapa: "A", disciplina_projeto: "Arquitetura", projetista: "Equipe", data_conclusao: "12-06-2026", porcentagem: 100, ordem: 1 },
];

describe("paridade do cronograma legado", () => {
  it("preserva status, ordenação, datas e média por percentual", () => {
    expect(scheduleStatusFromPercentage(0)).toBe("NOT_STARTED");
    expect(scheduleStatusFromPercentage(20)).toBe("IN_PROGRESS");
    expect(scheduleStatusFromPercentage(100)).toBe("COMPLETED");
    expect(sortLegacyTasks(tasks).map((task) => task.id)).toEqual(["1", "2"]);
    expect(parseLegacyDate("12-06-2026")).toEqual(new Date(2026, 5, 12));
    expect(averageSchedulePercentage(tasks)).toBe(50);
  });

  it("converte uma tarefa sem descartar disciplina, projetista ou data de conclusão", () => {
    const stage = toScheduleStageData(tasks[0], "00000000-0000-0000-0000-000000000001");
    expect(stage).toMatchObject({
      name: "B",
      discipline: "3D",
      designer: "Equipe",
      completion: 0,
      order: 2,
    });
    expect(stage.dueDate).toEqual(new Date(2026, 7, 15));
  });

  it("rejeita datas fora do contrato DD-MM-AAAA", () => {
    expect(() => parseLegacyDate("2026-06-12")).toThrow("Data legada inválida");
  });
});
