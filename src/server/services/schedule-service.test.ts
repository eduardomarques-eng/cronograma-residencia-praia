import { describe, expect, it } from "vitest";
import { columnFor, KANBAN_COLUMNS, type KanbanColumnId } from "./schedule-service";

const AGORA = new Date("2026-10-10T00:00:00.000Z");
const ONTEM = new Date("2026-10-05T00:00:00.000Z");
const AMANHA = new Date("2026-10-15T00:00:00.000Z");

describe("colunas do quadro", () => {
  it("classifica pela percentagem quando não há prazo", () => {
    expect(columnFor({ status: "NOT_STARTED", completion: 0, dueDate: null }, AGORA)).toBe("NOT_STARTED");
    expect(columnFor({ status: "IN_PROGRESS", completion: 50, dueDate: null }, AGORA)).toBe("IN_PROGRESS");
    expect(columnFor({ status: "COMPLETED", completion: 100, dueDate: null }, AGORA)).toBe("COMPLETED");
  });

  it("prazo vencido manda a etapa para ATRASADO", () => {
    expect(columnFor({ status: "NOT_STARTED", completion: 0, dueDate: ONTEM }, AGORA)).toBe("ATRASADO");
    expect(columnFor({ status: "IN_PROGRESS", completion: 40, dueDate: ONTEM }, AGORA)).toBe("ATRASADO");
  });

  it("prazo ainda no futuro nao marca como atrasada", () => {
    expect(columnFor({ status: "IN_PROGRESS", completion: 40, dueDate: AMANHA }, AGORA)).toBe("IN_PROGRESS");
  });

  it("etapa concluída nunca fica em ATRASADO, mesmo com prazo antigo", () => {
    expect(columnFor({ status: "COMPLETED", completion: 100, dueDate: ONTEM }, AGORA)).toBe("COMPLETED");
  });

  it("todas as colunas são estados que o modelo conhece", () => {
    const ids = KANBAN_COLUMNS.map((column) => column.id);
    // "EM REVISÃO" não existe em ScheduleStageStatus e não foi inventado.
    expect(ids).toEqual(["ATRASADO", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
    const doModelo: KanbanColumnId[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
    for (const id of ids) {
      if (id !== "ATRASADO") expect(doModelo).toContain(id);
    }
  });
});