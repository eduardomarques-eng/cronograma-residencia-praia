export const COMMERCIAL_TIMELINE_STEPS = [
  { key: "BRIEFING_DONE", label: "Briefing concluído" },
  { key: "BRIEFING_VALIDATED", label: "Briefing validado" },
  { key: "PROPOSAL_CREATED", label: "Proposta criada" },
  { key: "PROPOSAL_GENERATED", label: "Proposta gerada" },
  { key: "PROPOSAL_SENT", label: "Proposta enviada" },
  { key: "PROPOSAL_VIEWED", label: "Proposta visualizada" },
  { key: "PROPOSAL_APPROVED", label: "Proposta aprovada" },
  { key: "CONTRACT_GENERATED", label: "Contrato gerado" },
  { key: "CONTRACT_SENT", label: "Contrato enviado" },
  { key: "CONTRACT_VIEWED", label: "Contrato visualizado" },
  { key: "CONTRACT_SIGNED", label: "Contrato assinado" },
  { key: "PROJECT_STARTED", label: "Projeto iniciado" },
] as const;

export type TimelineStepKey = (typeof COMMERCIAL_TIMELINE_STEPS)[number]["key"];
export type TimelineState = "DONE" | "CURRENT" | "PENDING";

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  state: TimelineState;
  at: string | null;
};

export type TimelineEvent = { type: string; occurredAt: Date | string };

export type TimelineInput = {
  briefingExists?: boolean;
  briefingStatus?: string | null;
  proposalCreated?: boolean;
  events: readonly TimelineEvent[];
  contractStatus?: string | null;
  signatureStatus?: string | null;
  projectStatus?: string | null;
};

const EVENT_TO_STEP: Record<string, TimelineStepKey> = {
  "proposal.generated": "PROPOSAL_GENERATED",
  "proposal.sent": "PROPOSAL_SENT",
  "message.sent": "PROPOSAL_SENT",
  "proposal.viewed": "PROPOSAL_VIEWED",
  "proposal.approved": "PROPOSAL_APPROVED",
  "contract.generated": "CONTRACT_GENERATED",
  "contract.sent": "CONTRACT_SENT",
  "contract.viewed": "CONTRACT_VIEWED",
  "contract.signed": "CONTRACT_SIGNED",
};

/**
 * Tópico 29 — deriva a linha do tempo apenas de fatos já registrados.
 * Determinístico: mesmos dados de entrada, mesma saída.
 */
export function buildCommercialTimeline(input: TimelineInput): TimelineStep[] {
  const done = new Set<TimelineStepKey>();
  const at = new Map<TimelineStepKey, string>();

  function mark(key: TimelineStepKey, when?: string) {
    done.add(key);
    if (when) {
      const previous = at.get(key);
      if (!previous || when < previous) at.set(key, when);
    }
  }

  for (const event of input.events) {
    const step = EVENT_TO_STEP[event.type];
    if (!step) continue;
    mark(step, event.occurredAt instanceof Date ? event.occurredAt.toISOString() : String(event.occurredAt));
  }

  if (input.briefingExists) mark("BRIEFING_DONE");
  if (input.briefingStatus === "FINALIZED") mark("BRIEFING_VALIDATED");
  if (input.proposalCreated) mark("PROPOSAL_CREATED");

  const contract = input.contractStatus;
  const signature = input.signatureStatus;
  if (contract && ["SENT", "VIEWED", "SIGNED"].includes(contract)) mark("CONTRACT_SENT");
  if (contract === "VIEWED" || contract === "SIGNED" || ["VIEWED", "SIGNED", "COMPLETED"].includes(signature ?? "")) {
    mark("CONTRACT_VIEWED");
  }
  if (contract === "SIGNED" || ["SIGNED", "COMPLETED"].includes(signature ?? "")) mark("CONTRACT_SIGNED");
  if (input.projectStatus && ["IN_PROGRESS", "COMPLETED"].includes(input.projectStatus)) mark("PROJECT_STARTED");

  const steps = COMMERCIAL_TIMELINE_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    state: (done.has(step.key) ? "DONE" : "PENDING") as TimelineState,
    at: at.get(step.key) ?? null,
  }));
  const currentIndex = steps.findIndex((step) => step.state === "PENDING");
  return steps.map((step, index) => (index === currentIndex ? { ...step, state: "CURRENT" as TimelineState } : step));
}