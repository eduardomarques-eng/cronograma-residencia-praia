import { Resend } from "resend";
import { recordNotification } from "@/server/services/notification-service";
import { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from "@/lib/commercial-events";

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Contexto do evento de negócio, gravado em `NotificationEvent`. */
  eventType?: string;
  entityType?: string;
  entityId?: string;
};

export type EmailResult = {
  ok: boolean;
  /** `false` quando não há `RESEND_API_KEY` — o e-mail não saiu, mas o pedido
   *  de recuperação de senha ainda foi registado na auditoria. */
  configured: boolean;
  error?: string;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Envio de e-mail via Resend.
 *
 * Nunca deixa rebentar o pedido que o originou: se a chave não estiver
 * configurada ou o Resend falhar, devolve `{ ok: false }` e o chamador decide.
 * Todos os envios ficam registados em `NotificationEvent`.
 */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ARQVERTICE <nao-responda@resend.dev>";
  const record = (status: string, error?: string) =>
    recordNotification({
      type: (input.eventType ?? "proposal.sent") as never,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      status: status as never,
      subject: input.subject,
      body: input.text,
      recipient: input.to,
      error,
      entityType: input.entityType,
      entityId: input.entityId,
    }).catch(() => undefined); // a auditoria nunca pode derrubar o envio

  if (!apiKey) {
    await record(NOTIFICATION_STATUS.FAILED, "RESEND_API_KEY não configurado.");
    return { ok: false, configured: false, error: "RESEND_API_KEY não configurado." };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
    if (error) {
      await record(NOTIFICATION_STATUS.FAILED, error.message);
      return { ok: false, configured: true, error: error.message };
    }
    await record(NOTIFICATION_STATUS.SENT);
    return { ok: true, configured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no envio.";
    await record(NOTIFICATION_STATUS.FAILED, message);
    return { ok: false, configured: true, error: message };
  }
}

/** Link de recuperação, com o token em claro. */
export function passwordResetUrl(token: string) {
  return `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/** E-mail de recuperação de senha. */
export function passwordResetEmail(input: { to: string; name: string; url: string; expiresInMinutes: number }) {
  const subject = "Redefinição de senha — ARQVERTICE";
  const text = [
    `Olá ${input.name},`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta na ARQVERTICE.",
    "",
    `Crie uma nova senha através deste link (válido por ${input.expiresInMinutes} minutos):`,
    input.url,
    "",
    "Se não foi você, ignore este e-mail: nada será alterado.",
  ].join("\n");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:18px;font-weight:700">ARQVERTICE<span style="color:#2563eb">.</span></p>
        <p style="margin:0 0 24px;font-size:13px;color:#64748b">Arquitetura e Engenharia</p>
        <h1 style="margin:0 0 16px;font-size:20px">Redefinir senha</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Olá ${escapeHtml(input.name)},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6">Recebemos um pedido para redefinir a senha da sua conta. Use o botão abaixo para criar uma nova senha.</p>
        <p style="margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:600;font-size:15px">Criar nova senha</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b">O link expira em ${input.expiresInMinutes} minutos e só pode ser usado uma vez.</p>
        <p style="margin:0 0 20px;font-size:13px;color:#64748b">Se o botão não funcionar, copie este endereço:<br><span style="word-break:break-all">${escapeHtml(input.url)}</span></p>
        <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b">Se não foi você, ignore este e-mail: nada será alterado.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { to: input.to, subject, text, html, eventType: "contract.sent" };
}

/**
 * O link vai por e-mail e o assunto/body podem ser reflectidos na interface,
 * por isso nunca inserimos HTML sem escapar.
 */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}