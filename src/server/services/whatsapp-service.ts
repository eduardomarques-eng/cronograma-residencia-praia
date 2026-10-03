import { buildWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/whatsapp";

export type WhatsAppProviderName = "wa.me" | "api";

export type WhatsAppDispatchResult = {
  provider: WhatsAppProviderName;
  status: "SENT" | "SKIPPED";
  /** Deep link para envio manual pelo ADMIN quando não há provedor de API. */
  deepLink?: string;
  externalId?: string;
};

/**
 * Tópico 21 — camada de integração configurável. As credenciais ficam somente
 * no servidor (variáveis de ambiente) e nunca são expostas ao frontend.
 *
 *  - `WHATSAPP_PROVIDER=wa.me` (padrão): prepara o deep link para envio manual.
 *  - `WHATSAPP_PROVIDER=api`: chama o provedor oficial usando
 *    `WHATSAPP_API_URL` e `WHATSAPP_API_TOKEN`.
 */
export function getWhatsAppProvider(): WhatsAppProviderName {
  return (process.env.WHATSAPP_PROVIDER ?? "wa.me").toLowerCase() === "api" ? "api" : "wa.me";
}

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
}

export async function dispatchWhatsAppMessage(phone: string, message: string): Promise<WhatsAppDispatchResult> {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) throw new Error("Telefone inválido para o WhatsApp.");

  if (getWhatsAppProvider() === "wa.me") {
    return { provider: "wa.me", status: "SKIPPED", deepLink: buildWhatsAppLink(digits, message) };
  }

  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Provedor de WhatsApp configurado como 'api', mas WHATSAPP_API_URL/WHATSAPP_API_TOKEN não estão definidos no servidor.",
    );
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: digits, message }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Provedor de WhatsApp respondeu ${response.status}. ${detail.slice(0, 200)}`);
  }
  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { provider: "api", status: "SENT", externalId: data.id };
}