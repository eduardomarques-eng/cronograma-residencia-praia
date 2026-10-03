import { describe, expect, it } from "vitest";
import { buildCommercialTimeline, COMMERCIAL_TIMELINE_STEPS } from "./commercial-timeline";

describe("linha do tempo comercial", () => {
  it("mantém a ordem canônica das etapas", () => {
    expect(COMMERCIAL_TIMELINE_STEPS.map((step) => step.key)).toEqual([
      "BRIEFING_DONE",
      "BRIEFING_VALIDATED",
      "PROPOSAL_CREATED",
      "PROPOSAL_GENERATED",
      "PROPOSAL_SENT",
      "PROPOSAL_VIEWED",
      "PROPOSAL_APPROVED",
      "CONTRACT_GENERATED",
      "CONTRACT_SENT",
      "CONTRACT_VIEWED",
      "CONTRACT_SIGNED",
      "PROJECT_STARTED",
    ]);
  });

  it("marca apenas as etapas com fatos registrados", () => {
    const steps = buildCommercialTimeline({
      briefingExists: true,
      briefingStatus: "FINALIZED",
      proposalCreated: true,
      events: [
        { type: "proposal.generated", occurredAt: "2026-09-30T10:00:00.000Z" },
        { type: "proposal.sent", occurredAt: "2026-10-01T10:00:00.000Z" },
        { type: "proposal.viewed", occurredAt: "2026-10-01T18:00:00.000Z" },
        { type: "proposal.approved", occurredAt: "2026-10-02T10:00:00.000Z" },
      ],
      contractStatus: null,
      signatureStatus: null,
      projectStatus: "PLANNING",
    });
    const byKey = Object.fromEntries(steps.map((step) => [step.key, step.state]));
    expect(byKey.BRIEFING_DONE).toBe("DONE");
    expect(byKey.BRIEFING_VALIDATED).toBe("DONE");
    expect(byKey.PROPOSAL_CREATED).toBe("DONE");
    expect(byKey.PROPOSAL_GENERATED).toBe("DONE");
    expect(byKey.PROPOSAL_SENT).toBe("DONE");
    expect(byKey.PROPOSAL_VIEWED).toBe("DONE");
    expect(byKey.PROPOSAL_APPROVED).toBe("DONE");
    expect(byKey.CONTRACT_GENERATED).toBe("CURRENT");
    expect(byKey.PROJECT_STARTED).toBe("PENDING");
    expect(steps.find((step) => step.key === "PROPOSAL_SENT")?.at).toBe("2026-10-01T10:00:00.000Z");
  });

  it("marca como atual o primeiro passo que ainda não aconteceu", () => {
    const steps = buildCommercialTimeline({
      briefingExists: true,
      briefingStatus: "FINALIZED",
      proposalCreated: true,
      events: [{ type: "proposal.sent", occurredAt: "2026-10-01T10:00:00.000Z" }],
    });
    const byKey = Object.fromEntries(steps.map((step) => [step.key, step.state]));
    expect(byKey.PROPOSAL_GENERATED).toBe("CURRENT");
    expect(byKey.PROPOSAL_VIEWED).toBe("PENDING");
  });

  it("conclui as etapas finais com assinatura e projeto iniciado", () => {
    const steps = buildCommercialTimeline({
      events: [],
      contractStatus: "SIGNED",
      signatureStatus: "COMPLETED",
      projectStatus: "IN_PROGRESS",
    });
    const byKey = Object.fromEntries(steps.map((step) => [step.key, step.state]));
    expect(byKey.CONTRACT_SENT).toBe("DONE");
    expect(byKey.CONTRACT_SIGNED).toBe("DONE");
    expect(byKey.PROJECT_STARTED).toBe("DONE");
  });

  it("é determinístico: mesmas entradas produzem a mesma saída", () => {
    const input = { events: [{ type: "proposal.sent", occurredAt: "2026-10-01T10:00:00.000Z" }] };
    expect(buildCommercialTimeline(input)).toEqual(buildCommercialTimeline(input));
  });

  it("não avança etapas sem evidência registrada", () => {
    const steps = buildCommercialTimeline({ events: [] });
    const byKey = Object.fromEntries(steps.map((step) => [step.key, step.state]));
    expect(byKey.BRIEFING_DONE).toBe("CURRENT");
    expect(byKey.PROPOSAL_SENT).toBe("PENDING");
  });
});