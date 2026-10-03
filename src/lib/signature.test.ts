import { describe, expect, it } from "vitest";
import { assertSignatureTransition, canTransitionSignature, SIGNATURE_STATUS } from "./signature";

describe("camada de assinatura digital", () => {
  it("permite apenas transições controladas", () => {
    expect(canTransitionSignature("PENDING", "SENT")).toBe(true);
    expect(canTransitionSignature("SENT", "VIEWED")).toBe(true);
    expect(canTransitionSignature("SENT", "SIGNED")).toBe(true);
    expect(canTransitionSignature("SIGNED", "COMPLETED")).toBe(true);
    expect(canTransitionSignature("COMPLETED", "SIGNED")).toBe(false);
    expect(canTransitionSignature("CANCELLED", "SENT")).toBe(false);
  });

  it("rejeita transição inválida com erro explícito", () => {
    expect(() => assertSignatureTransition("COMPLETED", SIGNATURE_STATUS.SENT)).toThrow(
      "Transição de assinatura inválida",
    );
  });

  it("não permite pular de PENDING direto para assinado", () => {
    expect(() => assertSignatureTransition("PENDING", "SIGNED")).toThrow("Transição de assinatura inválida");
  });

  it("permite reenvio após falha", () => {
    expect(canTransitionSignature("FAILED", "SENT")).toBe(true);
  });
});