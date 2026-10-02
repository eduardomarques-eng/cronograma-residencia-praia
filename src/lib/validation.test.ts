import { describe, expect, it } from "vitest";
import { briefingSchema, clientSchema, paymentSchema, projectSchema, scheduleStageSchema } from "./validation";

const projectId = "00000000-0000-4000-8000-000000000001";

describe("validações da camada de negócio", () => {
  it("aceita criação de cliente e projeto com referência válida", () => {
    expect(clientSchema.parse({ name: "Cliente", email: "cliente@example.com" }).name).toBe("Cliente");
    expect(projectSchema.parse({ clientId: projectId, name: "Projeto" })).toMatchObject({
      clientId: projectId,
      status: "PLANNING",
    });
  });

  it("rejeita projeto sem cliente ou pagamento com valor inválido", () => {
    expect(() => projectSchema.parse({ clientId: "invalido", name: "Projeto" })).toThrow();
    expect(() => paymentSchema.parse({ projectId, name: "Entrada", amount: -1, order: 0 })).toThrow();
  });

  it("valida etapa, pagamento e briefing incrementais", () => {
    expect(scheduleStageSchema.parse({ projectId, name: "Arquitetura", order: 1 })).toMatchObject({
      completion: 0,
    });
    expect(paymentSchema.parse({ projectId, name: "Entrada", amount: 1000, order: 1 }).status).toBe("PENDING");
    expect(briefingSchema.parse({ projectId, responses: { objetivo: "Casa" } }).responses).toEqual({ objetivo: "Casa" });
  });
});
