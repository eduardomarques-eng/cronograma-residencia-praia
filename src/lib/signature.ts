export const SIGNATURE_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
} as const;

export type SignatureStatusName = (typeof SIGNATURE_STATUS)[keyof typeof SIGNATURE_STATUS];

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatusName, string> = {
  PENDING: "Aguardando envio",
  SENT: "Enviado ao signatário",
  VIEWED: "Visualizado",
  SIGNED: "Assinado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  FAILED: "Falhou",
};

/** Transições permitidas; qualquer outra combinação é rejeitada. */
const ALLOWED_TRANSITIONS: Record<SignatureStatusName, SignatureStatusName[]> = {
  PENDING: ["SENT", "CANCELLED", "FAILED"],
  SENT: ["VIEWED", "SIGNED", "CANCELLED", "FAILED"],
  VIEWED: ["SIGNED", "CANCELLED", "FAILED"],
  SIGNED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ["SENT", "CANCELLED"],
};

export function canTransitionSignature(from: SignatureStatusName, to: SignatureStatusName): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertSignatureTransition(from: SignatureStatusName, to: SignatureStatusName): void {
  if (!canTransitionSignature(from, to)) {
    throw new Error(`Transição de assinatura inválida: ${from} → ${to}.`);
  }
}

export type SignatureDocument = {
  contractId: string;
  contractVersion: number;
  title: string;
  text: string;
};

export type SignatureSignatory = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type SignatureSendInput = {
  contractId: string;
  document: SignatureDocument;
  signatory: SignatureSignatory;
};

export type SignatureResult = {
  provider: string;
  status: SignatureStatusName;
  externalId: string | null;
  /** Evidências devolvidas pelo provedor (hash, trilha de auditoria, IP, etc.). */
  evidence?: Record<string, unknown> | null;
};

/**
 * Tópico 27 — camada de assinatura digital desacoplada. Trocar o fornecedor
 * significa registrar outro `SignatureProvider`; nada no restante do sistema
 * muda. `providesLegalSignature` é explícito: o sistema nunca afirma ter uma
 * assinatura jurídica que o fornecedor não produziu.
 */
export interface SignatureProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  readonly providesLegalSignature: boolean;
  send(input: SignatureSendInput): Promise<SignatureResult>;
  refresh?(externalId: string): Promise<SignatureResult>;
}