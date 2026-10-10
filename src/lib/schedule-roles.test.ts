import { describe, expect, it } from "vitest";
import { canOperateSchedule, isOperador } from "./schedule-roles";

describe("quem opera o cronograma", () => {
  it("ADMIN opera tudo", () => {
    expect(canOperateSchedule("ADMIN")).toBe(true);
  });

  it("OPERADOR opera o cronograma (acesso restrito a projetos atribuídos)", () => {
    expect(canOperateSchedule("OPERADOR")).toBe(true);
  });

  it("CLIENT não opera o cronograma", () => {
    expect(canOperateSchedule("CLIENT")).toBe(false);
  });

  it("papel desconhecido não opera", () => {
    expect(canOperateSchedule("")).toBe(false);
    expect(canOperateSchedule("FANTASMA")).toBe(false);
  });

  it("isOperador distingue o funcionário da equipa do dono", () => {
    expect(isOperador("OPERADOR")).toBe(true);
    expect(isOperador("ADMIN")).toBe(false);
    expect(isOperador("CLIENT")).toBe(false);
  });
});
