/** Eventos comerciais registrados para integrações futuras (Tópico 22). */
export const COMMERCIAL_EVENT = {
  PROPOSAL_GENERATED: "proposal.generated",
  PROPOSAL_SENT: "proposal.sent",
  MESSAGE_SENT: "message.sent",
  PROPOSAL_VIEWED: "proposal.viewed",
  PROPOSAL_APPROVED: "proposal.approved",
  PROPOSAL_REJECTED: "proposal.rejected",
  CONTRACT_GENERATED: "contract.generated",
  CONTRACT_SENT: "contract.sent",
  CONTRACT_VIEWED: "contract.viewed",
  CONTRACT_SIGNED: "contract.signed",
} as const;

export type CommercialEventType = (typeof COMMERCIAL_EVENT)[keyof typeof COMMERCIAL_EVENT];

export const COMMERCIAL_EVENT_LABELS: Record<CommercialEventType, string> = {
  "proposal.generated": "Proposta gerada",
  "proposal.sent": "Proposta enviada",
  "message.sent": "Mensagem enviada",
  "proposal.viewed": "Proposta visualizada",
  "proposal.approved": "Proposta aprovada",
  "proposal.rejected": "Proposta recusada",
  "contract.generated": "Contrato gerado",
  "contract.sent": "Contrato enviado",
  "contract.viewed": "Contrato visualizado",
  "contract.signed": "Contrato assinado",
};

export const NOTIFICATION_CHANNEL = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  INTERNAL: "INTERNAL",
  MANUAL: "MANUAL",
} as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_STATUS = {
  RECORDED: "RECORDED",
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

/** Chaves dos templates editáveis pelo ADMIN. */
export const MESSAGE_TEMPLATE_KEY = {
  PROPOSAL_WHATSAPP: "proposal.whatsapp",
  CONTRACT_WHATSAPP: "contract.whatsapp",
} as const;

export type MessageTemplateKey = (typeof MESSAGE_TEMPLATE_KEY)[keyof typeof MESSAGE_TEMPLATE_KEY];