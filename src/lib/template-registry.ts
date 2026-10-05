/**
 * TEMPLATE REGISTRY — CONTRATOS, NÃO CONTEÚDO.
 *
 * Este módulo declara QUAIS templates existem e que variáveis aceitam. NÃO
 * contém texto de mensagem.
 *
 * Porquê (Prompt 19, Parte 1): o conteúdo operacional vive em `MessageTemplate`,
 * no banco, editável pelo ADMIN. Com o `defaultBody` aqui, o mesmo texto
 * existia em dois sítios — o banco e o código — e o ADMIN editava um enquanto o
 * sistema servia o outro. A auditoria mostrou que este módulo não tinha
 * consumidores, portanto o texto aqui não servia nem de fallback.
 *
 * Hierarquia:
 *   template-registry        → chaves, tipos, variáveis obrigatórias (contrato)
 *   MessageTemplate          → conteúdo real (fonte operacional de verdade)
 *   message-template-service → resolve, valida e entrega
 */

export const TEMPLATE_KIND = {
  PROPOSAL_COVER: "proposal.cover",
  PROPOSAL_SERVICES: "proposal.services",
  PROPOSAL_INVESTMENT: "proposal.investment",
  PROPOSAL_FORMAL: "proposal.formal",
  CONTRACT_BODY: "contract.body",
  SCOPE_BODY: "scope.body",
  SERVICE_TEXT: "service.text",
  WHATSAPP_PROPOSAL: "proposal.whatsapp",
  WHATSAPP_FOLLOWUP: "proposal.reminder",
  EMAIL_PROPOSAL: "email.proposal",
  EMAIL_APPROVED: "email.approved",
  EMAIL_SIGNOFF: "email.signoff",
} as const;

export type TemplateKind = (typeof TEMPLATE_KIND)[keyof typeof TEMPLATE_KIND];

export type TemplateVariable = { key: string; label: string; required: boolean };

/** Catálogo de variáveis do e-mail da proposta. */
const EMAIL_PROPOSAL_VARS: TemplateVariable[] = [
  { key: "CLIENTE", label: "Nome do cliente", required: true },
  { key: "PROJETO", label: "Nome do projeto", required: true },
  { key: "PROPOSTA", label: "Título da proposta", required: false },
  { key: "VALOR", label: "Valor total", required: false },
  { key: "VALIDADE", label: "Validade", required: false },
  { key: "LINK", label: "Link público da proposta", required: true },
];

export type TemplateDefinition = {
  kind: TemplateKind;
  /** Chave persistida em `MessageTemplate.key`. */
  key: string;
  /** Canal gravado em `MessageTemplate.channel`. */
  channel: string;
  /** Nome exibido na interface de edição. */
  name: string;
  /** Variáveis que este template aceita, com obrigatoriedade declarada. */
  variables: ReadonlyArray<TemplateVariable>;
  /** Quando true, uma variável obrigatória em falta impede o envio. */
  blockOnMissing: boolean;
};

/**
 * Temas do Tópico 43 — a estrutura narrativa da proposta comercial.
 * A ordem é fixa porque é a ordem em que o cliente compreende o valor.
 */
export const NARRATIVE_SECTIONS = [
  { key: "CLIENT_PROJECT", title: "O projeto do cliente", origin: "BRIEFING" },
  { key: "IDENTIFIED", title: "O que foi identificado", origin: "BRIEFING" },
  { key: "APPROACH", title: "Como a ArqVértice irá trabalhar", origin: "SERVICOS_CONTRATADOS" },
  { key: "DELIVERABLES", title: "O que será entregue", origin: "SERVICOS_CONTRATADOS" },
  { key: "PROCESS", title: "Como o processo acontecerá", origin: "CRONOGRAMA" },
  { key: "INVESTMENT", title: "O investimento", origin: "PROPOSTA_APROVADA" },
  { key: "AFTER_APPROVAL", title: "O que acontece após a aprovação", origin: "CONFIGURACAO" },
] as const;

export type NarrativeSectionKey = (typeof NARRATIVE_SECTIONS)[number]["key"];

/**
 * Catálogo de variáveis, tipado como `TemplateVariable[]` (e não `as const`).
 * A tipagem explícita é necessária porque os grupos são combinados com spread,
 * e literais inferidos dariam incompatibilidade de `key`.
 */
const CLIENT_VARS: TemplateVariable[] = [
  { key: "CLIENTE_NOME", label: "Nome do cliente", required: true },
  { key: "PROJETO_NOME", label: "Nome do projeto", required: true },
  { key: "PROJETO_DESCRICAO", label: "Descrição do projeto", required: false },
  { key: "AREA", label: "Área", required: false },
  { key: "AMBIENTES", label: "Ambientes citados", required: false },
];

const SERVICES_VARS: TemplateVariable[] = [
  { key: "SERVICOS", label: "Lista de serviços contratados", required: true },
  { key: "DISCIPLINAS", label: "Disciplinas contratadas", required: false },
];

const INVESTMENT_VARS: TemplateVariable[] = [
  { key: "VALOR_TOTAL", label: "Valor total", required: true },
  { key: "PARCELAS", label: "Condição de pagamento", required: false },
];

const PROCESS_VARS: TemplateVariable[] = [
  { key: "CRONOGRAMA", label: "Cronograma calculado", required: false },
];

/**
 * Variáveis REAIS do WhatsApp, extraídas do que `sendProposalWhatsApp` passa
 * hoje. Não é uma lista inventada: é o contrato efectivo do consumidor.
 */
const WHATSAPP_PROPOSAL_VARS: TemplateVariable[] = [
  { key: "CLIENTE", label: "Nome do cliente", required: true },
  { key: "PROJETO", label: "Nome do projeto", required: true },
  { key: "PROPOSTA", label: "Título da proposta", required: false },
  { key: "VALOR", label: "Valor total", required: false },
  { key: "VALIDADE", label: "Validade", required: false },
  { key: "LINK", label: "Link público da proposta", required: true },
];

const WHATSAPP_FOLLOWUP_VARS: TemplateVariable[] = [
  { key: "CLIENTE", label: "Nome do cliente", required: true },
  { key: "PROJETO", label: "Nome do projeto", required: true },
  { key: "LINK", label: "Link público da proposta", required: true },
];

/** CATÁLOGO DE CONTRATOS. Nenhum `body` aqui — o conteúdo é do banco. */
export const TEMPLATE_CATALOG: readonly TemplateDefinition[] = [
  { kind: TEMPLATE_KIND.PROPOSAL_COVER, key: "proposal.cover", channel: "PROPOSAL", name: "Capa da proposta", variables: CLIENT_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.PROPOSAL_SERVICES, key: "proposal.services", channel: "PROPOSAL", name: "Serviços contratados", variables: SERVICES_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.PROPOSAL_INVESTMENT, key: "proposal.investment", channel: "PROPOSAL", name: "Investimento", variables: INVESTMENT_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.PROPOSAL_FORMAL, key: "proposal.formal", channel: "PROPOSAL", name: "Proposta formal", variables: [...CLIENT_VARS, ...SERVICES_VARS, ...INVESTMENT_VARS], blockOnMissing: true },
  { kind: TEMPLATE_KIND.CONTRACT_BODY, key: "contract.body", channel: "CONTRACT", name: "Corpo do contrato", variables: [...CLIENT_VARS, ...SERVICES_VARS, ...INVESTMENT_VARS, ...PROCESS_VARS], blockOnMissing: true },
  { kind: TEMPLATE_KIND.SCOPE_BODY, key: "scope.body", channel: "SERVICE", name: "Texto de escopo", variables: SERVICES_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.SERVICE_TEXT, key: "service.text", channel: "SERVICE", name: "Descrição de serviço", variables: [{ key: "SERVICO_NOME", label: "Nome do serviço", required: true }], blockOnMissing: false },
  { kind: TEMPLATE_KIND.WHATSAPP_PROPOSAL, key: "proposal.whatsapp", channel: "WHATSAPP", name: "WhatsApp — envio da proposta", variables: WHATSAPP_PROPOSAL_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.WHATSAPP_FOLLOWUP, key: "proposal.reminder", channel: "WHATSAPP", name: "WhatsApp — acompanhamento", variables: WHATSAPP_FOLLOWUP_VARS, blockOnMissing: false },
  { kind: TEMPLATE_KIND.EMAIL_PROPOSAL, key: "email.proposal", channel: "EMAIL", name: "E-mail — envio da proposta", variables: EMAIL_PROPOSAL_VARS, blockOnMissing: true },
  { kind: TEMPLATE_KIND.EMAIL_APPROVED, key: "email.approved", channel: "EMAIL", name: "E-mail — aprovação recebida", variables: CLIENT_VARS, blockOnMissing: false },
  { kind: TEMPLATE_KIND.EMAIL_SIGNOFF, key: "email.signoff", channel: "EMAIL", name: "E-mail — encerramento", variables: [], blockOnMissing: false },
];

const BY_KIND = new Map<TemplateKind, TemplateDefinition>(TEMPLATE_CATALOG.map((item) => [item.kind, item]));

/**
 * Contrato de uma chave persistida, para validar o que vier do banco.
 *
 * É o ÚNICO accessor deste módulo com consumidores. As funções de conveniência
 * (`keyForTemplateKind`, `getTemplateDefinition`, `requiredTemplateVariables`)
 * foram removidas: estavam sem consumidores e só prometiam uma API que ninguém
 * usava.
 */
export function findTemplateByKey(key: string): TemplateDefinition | undefined {
  return TEMPLATE_CATALOG.find((item) => item.key === key);
}
