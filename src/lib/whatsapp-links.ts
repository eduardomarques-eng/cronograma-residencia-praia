/**
 * FASE 4E — LINKS DE WHATSAPP (item 51).
 *
 * Funções PURAS, sem JSX e sem `window`, para serem testáveis. O componente que
 * as usa vive em `proposal-share-actions.tsx`; a lógica fica aqui porque um
 * link mal construído não é um detalhe — é o cliente a receber metade da
 * mensagem.
 */

/** Link de partilha do WhatsApp, com o texto já preenchido. */
export function whatsappShareUrl(message: string): string {
  // `encodeURIComponent` e não `encodeURI`: o texto vive num query string, e
  // `&`, `#` ou `+` soltos fariam o WhatsApp ler outra mensagem — sem o
  // utilizador dar por isso.
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Link de conversa directa com um número, em formato internacional. */
export function whatsappContactUrl(phone: string, message: string): string {
  // O WhatsApp exige o número sem `+`, sem espaços e com o indicativo.
  const digits = phone.replace(/\D/g, "");
  const prefix = digits.startsWith("00") ? digits.slice(2) : digits;
  return `https://wa.me/${prefix}?text=${encodeURIComponent(message)}`;
}