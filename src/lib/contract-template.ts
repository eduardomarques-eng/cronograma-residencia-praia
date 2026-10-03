import { missingRequiredVariables, renderTemplate } from "./template-engine";

/**
 * Variáveis do motor de templates contratuais (Tópico 24). O texto jurídico é
 * de responsabilidade do ADMIN: o sistema apenas substitui variáveis.
 */
export const CONTRACT_VARIABLES = [
  { key: "CLIENTE_NOME", label: "Nome do cliente", required: true },
  { key: "CLIENTE_CPF", label: "CPF do cliente", required: false },
  { key: "CLIENTE_RG", label: "RG do cliente", required: false },
  { key: "CLIENTE_ENDERECO", label: "Endereço do cliente", required: false },
  { key: "CLIENTE_CIDADE", label: "Cidade do cliente", required: false },
  { key: "CONTRATADO_NOME", label: "Nome da empresa contratada", required: true },
  { key: "CONTRATADO_DOCUMENTO", label: "Documento da empresa contratada", required: false },
  { key: "PROJETO_NOME", label: "Nome do projeto", required: true },
  { key: "PROJETO_DESCRICAO", label: "Descrição do projeto", required: false },
  { key: "AREA", label: "Área do projeto", required: false },
  { key: "SERVICOS", label: "Serviços contratados", required: true },
  { key: "ETAPAS", label: "Etapas", required: false },
  { key: "PRAZOS", label: "Prazos", required: false },
  { key: "HONORARIOS", label: "Honorários", required: false },
  { key: "FORMA_PAGAMENTO", label: "Forma de pagamento", required: false },
  { key: "VALOR_TOTAL", label: "Valor total", required: true },
  { key: "VALIDADE", label: "Validade", required: false },
  { key: "DATA_CONTRATO", label: "Data do contrato", required: true },
] as const;

export type ContractVariableKey = (typeof CONTRACT_VARIABLES)[number]["key"];

export const REQUIRED_CONTRACT_VARIABLES = CONTRACT_VARIABLES.filter((variable) => variable.required).map(
  (variable) => variable.key,
);

/**
 * Estrutura normalizada das cláusulas exigidas no Tópico 25. Os textos ficam
 * vazios de propósito: o texto jurídico é escrito e editado pelo ADMIN.
 */
export const CONTRACT_CLAUSE_SECTIONS = [
  { key: "objeto", title: "Objeto", order: 1 },
  { key: "etapas", title: "Etapas", order: 2 },
  { key: "prazos", title: "Prazos", order: 3 },
  { key: "honorarios", title: "Honorários", order: 4 },
  { key: "obrigacoes", title: "Obrigações", order: 5 },
  { key: "responsabilidades", title: "Responsabilidades", order: 6 },
  { key: "direitos_autoriais", title: "Direitos autorais", order: 7 },
  { key: "documentos", title: "Documentos", order: 8 },
  { key: "condicoes", title: "Condições", order: 9 },
  { key: "assinatura", title: "Assinatura", order: 10 },
] as const;

export type ContractClauseSection = (typeof CONTRACT_CLAUSE_SECTIONS)[number];

export function buildContractText(
  body: string,
  values: Record<string, string | number | null | undefined>,
) {
  const rendered = renderTemplate(body, values);
  return { ...rendered, missingRequired: missingRequiredVariables(REQUIRED_CONTRACT_VARIABLES, rendered.missing) };
}

export function formatCurrencyBRL(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  const [integerPart, decimalPart] = safe.toFixed(2).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped},${decimalPart}`;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function formatDateBR(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function formatDateLongBR(date: Date): string {
  return `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}