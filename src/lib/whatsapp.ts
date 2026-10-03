import { missingRequiredVariables, renderTemplate } from "./template-engine";

/**
 * Variáveis disponíveis nos templates de WhatsApp. A mensagem é editável pelo
 * ADMIN e fica no banco; nada de credenciais ou texto fixo no frontend.
 */
export const WHATSAPP_VARIABLES = [
  { key: "CLIENTE", label: "Nome do cliente", required: true },
  { key: "PROJETO", label: "Nome do projeto", required: false },
  { key: "PROPOSTA", label: "Título da proposta", required: false },
  { key: "VALOR", label: "Valor total", required: false },
  { key: "VALIDADE", label: "Validade", required: false },
  { key: "LINK", label: "Link da proposta", required: true },
] as const;

export const REQUIRED_WHATSAPP_VARIABLES = WHATSAPP_VARIABLES.filter((variable) => variable.required).map(
  (variable) => variable.key,
);

export function buildWhatsAppMessage(
  body: string,
  values: Record<string, string | number | null | undefined>,
) {
  const rendered = renderTemplate(body, values);
  return { ...rendered, missingRequired: missingRequiredVariables(REQUIRED_WHATSAPP_VARIABLES, rendered.missing) };
}

/** Converte um telefone livre em dígitos para o wa.me, sem lançar erro. */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

/** Deep link `wa.me`, usado quando não há provedor de API configurado. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) throw new Error("Telefone inválido para o WhatsApp.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
