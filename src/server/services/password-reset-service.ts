import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { hashPassword } from "@/server/auth";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isWellFormedPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset-token";
import { passwordResetEmail, passwordResetUrl, sendEmail } from "@/server/services/email-service";

/** Resposta idêntica exista ou não a conta — evita enumeração de e-mails. */
const NEUTRAL_ANSWER = "Se existir uma conta com este e-mail, enviámos as instruções para redefinir a senha.";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

/**
 * Pede a redefinição de senha e envia o link por e-mail.
 *
 * Devolve sempre a mesma mensagem: confirmar que o e-mail *não* existe seria
 * uma fuga de informação — permitiria descobrir quem tem conta. Quando não há
 * conta, não se envia email nem se cria token, mas o chamador vê o mesmo texto.
 */
export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } }) : null;

  if (!user) return { sent: true, message: NEUTRAL_ANSWER };

  // Só um link válido por pessoa: os anteriores deixam de servir.
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const token = createPasswordResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashPasswordResetToken(token), expiresAt } });

  const email_ = passwordResetEmail({
    to: user.email,
    name: user.name,
    url: passwordResetUrl(token),
    expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000),
  });
  const result = await sendEmail({ ...email_, entityType: "User", entityId: user.id });

  return { sent: result.ok, message: NEUTRAL_ANSWER, emailDelivered: result.ok, emailConfigured: result.configured };
}

/** Confere se um link ainda pode ser usado, sem o consumir. */
export async function inspectPasswordReset(token: unknown) {
  if (!isWellFormedPasswordResetToken(token)) throw new DomainError("Link de redefinição inválido.", "NOT_FOUND");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashPasswordResetToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new DomainError("Este link expirou, já foi usado ou não existe.", "NOT_FOUND");
  }
  return { expiresAt: record.expiresAt };
}

/**
 * Consome o link e grava a nova senha.
 *
 * Trocar a senha encerra **todas** as sessões do utilizador: se a conta foi
 * acessada por outra pessoa, essa pessoa perde o acesso imediatamente.
 */
export async function consumePasswordReset(token: unknown, newPassword: string) {
  if (!isWellFormedPasswordResetToken(token)) throw new DomainError("Link de redefinição inválido.", "NOT_FOUND");

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashPasswordResetToken(token) } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new DomainError("Este link expirou, já foi usado ou não existe.", "NOT_FOUND");
  }

  // Valida a política ANTES de gravar: `hashPassword` lança DomainError para
  // senhas com menos de 12 caracteres.
  const passwordHash = hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true };
}