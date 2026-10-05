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
  PROPOSAL_EXPIRED: "PROPOSAL_EXPIRED",
  PROPOSAL_NEGOTIATION: "PROPOSAL_NEGOTIATION",
  PROPOSAL_PDF_GENERATED: "PROPOSAL_PDF_GENERATED",
  PROPOSAL_EMAIL_SENT: "PROPOSAL_EMAIL_SENT",
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
  // Um template de mensagem muda o texto que o cliente recebe. É uma acção
  // crítica e não tinha entrada própria: o registo dizia só "algo mudou".
  MESSAGE_TEMPLATE_UPDATED: "MESSAGE_TEMPLATE_UPDATED",
  CONTRACT_TEMPLATE_UPDATED: "CONTRACT_TEMPLATE_UPDATED",
  SERVICE_CREATED: "SERVICE_CREATED",
  SERVICE_DEACTIVATED: "SERVICE_DEACTIVATED",
  SERVICE_UPDATED: "SERVICE_UPDATED",
  // Ações que os serviços já gravavam MAS QUE NÃO ESTAVAM no catálogo. Foram
  // registadas depois de o build de produção as ter apanhado — ver o relatório
  // da fase 4C-1. Foi o build que viu o que `tsc` não viu.
  PROPOSAL_WHATSAPP_READY: "PROPOSAL_WHATSAPP_READY",
  CONTRACT_GENERATION_SKIPPED: "CONTRACT_GENERATION_SKIPPED",
  PACKAGE_ITEMS_REPLACED: "PACKAGE_ITEMS_REPLACED",

  // FASE 4E — Proposal Studio (item 56).
  //
  // Antes existia uma única acção genérica para tudo o que o editor fazia, o
  // que respondia "a apresentação foi guardada" e não "o que mudou". Estas
  // entradas tornam a granularidade explícita, e por isso o que a auditoria de
  // uma proposta tem de conseguir responder fica escrito no catálogo.
  STUDIO_DECK_CREATED: "STUDIO_DECK_CREATED",
  STUDIO_DECK_IMPORTED: "STUDIO_DECK_IMPORTED",
  STUDIO_DECK_SAVED: "STUDIO_DECK_SAVED",
  STUDIO_SLIDE_ADDED: "STUDIO_SLIDE_ADDED",
  STUDIO_SLIDE_REMOVED: "STUDIO_SLIDE_REMOVED",
  STUDIO_SLIDE_DUPLICATED: "STUDIO_SLIDE_DUPLICATED",
  STUDIO_SLIDE_REORDERED: "STUDIO_SLIDE_REORDERED",
  STUDIO_SLIDE_EDITED: "STUDIO_SLIDE_EDITED",
  STUDIO_LAYOUT_CHANGED: "STUDIO_LAYOUT_CHANGED",
  STUDIO_THEME_CHANGED: "STUDIO_THEME_CHANGED",
  STUDIO_AI_EDIT_APPLIED: "STUDIO_AI_EDIT_APPLIED",
  STUDIO_AI_COMMAND_REFUSED: "STUDIO_AI_COMMAND_REFUSED",
  STUDIO_IMAGE_INSERTED: "STUDIO_IMAGE_INSERTED",
  STUDIO_IMAGE_REPLACED: "STUDIO_IMAGE_REPLACED",
  STUDIO_IMAGE_GENERATED: "STUDIO_IMAGE_GENERATED",
  STUDIO_MEDIA_UPLOADED: "STUDIO_MEDIA_UPLOADED",
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
  PROPOSAL_EXPIRED: "Proposta expirada",
  PROPOSAL_NEGOTIATION: "Negociação iniciada",
  PROPOSAL_PDF_GENERATED: "PDF da proposta gerado",
  PROPOSAL_EMAIL_SENT: "Proposta enviada por e-mail",
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
  MESSAGE_TEMPLATE_UPDATED: "Template de mensagem alterado",
  CONTRACT_TEMPLATE_UPDATED: "Template de contrato alterado",
  SERVICE_CREATED: "Serviço criado no catálogo",
  SERVICE_DEACTIVATED: "Serviço desativado no catálogo",
  SERVICE_UPDATED: "Serviço alterado no catálogo",
  PROPOSAL_WHATSAPP_READY: "Mensagem de WhatsApp preparada",
  CONTRACT_GENERATION_SKIPPED: "Geração de contrato adiada",
  PACKAGE_ITEMS_REPLACED: "Itens do pacote substituídos",

  STUDIO_DECK_CREATED: "Apresentação criada",
  STUDIO_DECK_IMPORTED: "Apresentação importada",
  STUDIO_DECK_SAVED: "Apresentação guardada",
  STUDIO_SLIDE_ADDED: "Página criada",
  STUDIO_SLIDE_REMOVED: "Página removida",
  STUDIO_SLIDE_DUPLICATED: "Página duplicada",
  STUDIO_SLIDE_REORDERED: "Páginas reordenadas",
  STUDIO_SLIDE_EDITED: "Página editada",
  STUDIO_LAYOUT_CHANGED: "Disposição alterada",
  STUDIO_THEME_CHANGED: "Tema alterado",
  STUDIO_AI_EDIT_APPLIED: "Edição por IA aplicada",
  STUDIO_AI_COMMAND_REFUSED: "Comando de IA recusado",
  STUDIO_IMAGE_INSERTED: "Imagem inserida",
  STUDIO_IMAGE_REPLACED: "Imagem substituída",
  STUDIO_IMAGE_GENERATED: "Imagem gerada por IA",
  STUDIO_MEDIA_UPLOADED: "Ficheiro carregado",
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
  MESSAGE_TEMPLATE: "MessageTemplate",
  CONTRACT_TEMPLATE: "ContractTemplate",
  // FASE 4E: o deck da apresentação vive em `ProposalVersion.presentation`, e a
  // auditoria usa a VERSÃO como entidade. Não há — nem deve haver — uma tabela
  // paralela de apresentações (item 59).
  STUDIO_DECK: "ProposalVersion",
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
