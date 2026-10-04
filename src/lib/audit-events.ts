/**
 * Tópico 36 — catálogo das ações críticas que precisam deixar rastro.
 *
 * O enum em vez de strings livres é deliberado: obriga a decidir o que é
 * "crítico" e impede que uma ação nova passe despercebida. Cada entrada declara
 * o que a auditoria precisa capturar para responder às perguntas do tópico —
 * quem fez, o que fez, quando, qual versão, e os estados anterior e posterior.
 */
export const AUDIT_ACTION = {
  PROPOSAL_CREATED: "PROPOSAL_CREATED",
  PROPOSAL_VERSION_SAVED: "PROPOSAL_VERSION_SAVED",
  PROPOSAL_LINK_ISSUED: "PROPOSAL_LINK_ISSUED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  PROPOSAL_RESENT: "PROPOSAL_RESENT",
  PROPOSAL_VIEWED: "PROPOSAL_VIEWED",
  PROPOSAL_APPROVED: "PROPOSAL_APPROVED",
  PROPOSAL_REJECTED: "PROPOSAL_REJECTED",
  PROPOSAL_ACCESS_DENIED: "PROPOSAL_ACCESS_DENIED",
  PROPOSAL_DECISION_BLOCKED: "PROPOSAL_DECISION_BLOCKED",
  CONTRACT_GENERATED: "CONTRACT_GENERATED",
  CONTRACT_CHANGED: "CONTRACT_CHANGED",
  CONTRACT_SENT: "CONTRACT_SENT",
  CONTRACT_SIGNATURE_REQUESTED: "CONTRACT_SIGNATURE_REQUESTED",
  CONTRACT_SIGNATURE_UPDATED: "CONTRACT_SIGNATURE_UPDATED",
  CONTRACT_CANCELLED: "CONTRACT_CANCELLED",
  SERVICE_PRICE_CHANGED: "SERVICE_PRICE_CHANGED",
  CONVERSION_COMPLETED: "CONVERSION_COMPLETED",
  PAYMENTS_GENERATED: "PAYMENTS_GENERATED",
  DOCUMENT_STORED: "DOCUMENT_STORED",
  BRIEFING_ANSWER_SAVED: "BRIEFING_ANSWER_SAVED",
  BRIEFING_FINALIZED: "BRIEFING_FINALIZED",
  BRIEFING_REOPENED: "BRIEFING_REOPENED",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/** Rótulos exibidos na interface de auditoria. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  PROPOSAL_CREATED: "Proposta criada",
  PROPOSAL_VERSION_SAVED: "Nova versão da proposta",
  PROPOSAL_LINK_ISSUED: "Link da proposta emitido",
  PROPOSAL_SENT: "Proposta enviada",
  PROPOSAL_RESENT: "Proposta reenviada",
  PROPOSAL_VIEWED: "Proposta visualizada",
  PROPOSAL_APPROVED: "Proposta aprovada",
  PROPOSAL_REJECTED: "Proposta recusada",
  PROPOSAL_ACCESS_DENIED: "Acesso à proposta negado",
  PROPOSAL_DECISION_BLOCKED: "Decisão bloqueada",
  CONTRACT_GENERATED: "Contrato gerado",
  CONTRACT_CHANGED: "Contrato alterado",
  CONTRACT_SENT: "Contrato enviado",
  CONTRACT_SIGNATURE_REQUESTED: "Assinatura solicitada",
  CONTRACT_SIGNATURE_UPDATED: "Assinatura atualizada",
  CONTRACT_CANCELLED: "Contrato cancelado",
  SERVICE_PRICE_CHANGED: "Preço de serviço alterado",
  CONVERSION_COMPLETED: "Conversão concluída",
  PAYMENTS_GENERATED: "Parcelas geradas",
  DOCUMENT_STORED: "Documento armazenado",
  BRIEFING_ANSWER_SAVED: "Resposta do briefing alterada",
  BRIEFING_FINALIZED: "Briefing confirmado pelo cliente",
  BRIEFING_REOPENED: "Briefing reaberto pelo estúdio",
};

/** Entidades sobre as quais a auditoria pode recair. */
export const AUDIT_ENTITY = {
  PROPOSAL: "Proposal",
  PROPOSAL_VERSION: "ProposalVersion",
  CONTRACT: "Contract",
  CONTRACT_SIGNATURE: "ContractSignature",
  SERVICE_ITEM: "ServiceItem",
  CLIENT: "Client",
  PROJECT: "Project",
  PAYMENT: "Payment",
  PROJECT_DOCUMENT: "ProjectDocument",
  // Tópico 4A: quem respondeu, quando e o que mudou.
  BRIEFING: "Briefing",
} as const;

export type AuditEntity = (typeof AUDIT_ENTITY)[keyof typeof AUDIT_ENTITY];

export const AUDIT_OUTCOME = {
  SUCCESS: "SUCCESS",
  DENIED: "DENIED",
  FAILED: "FAILED",
  /** Ação do sistema sem usuário autenticado (ex.: conversão automática). */
  SYSTEM: "SYSTEM",
} as const;

export type AuditOutcome = (typeof AUDIT_OUTCOME)[keyof typeof AUDIT_OUTCOME];

/**
 * Quem executou a ação. `SYSTEM` nunca significa "desconhecido": significa que
 * a automação do próprio sistema agiu. São situações diferentes na investigação.
 */
export const AUDIT_ACTOR = {
  SYSTEM: "SYSTEM",
  CLIENT_LINK: "CLIENT_LINK",
} as const;

export type AuditActor = (typeof AUDIT_ACTOR)[keyof typeof AUDIT_ACTOR] | string;
