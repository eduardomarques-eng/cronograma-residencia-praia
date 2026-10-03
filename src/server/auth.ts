import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { DomainError } from "./errors";
import { hashPassword, verifyPassword } from "@/lib/password";

export type AuthRole = "ADMIN" | "CLIENT";
const COOKIE = "arqvertice_session";
const LIFETIME = 1000 * 60 * 60 * 24 * 7;

export { hashPassword, verifyPassword };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function signIn(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !verifyPassword(password, user.passwordHash)) throw new DomainError("E-mail ou senha inválidos.", "VALIDATION");
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt: new Date(Date.now() + LIFETIME) } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: LIFETIME / 1000 });
  return { id: user.id, name: user.name, role: user.role };
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function requireRole(role: AuthRole) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role !== role) throw new DomainError("Você não tem permissão para esta ação.", "INTEGRITY");
  return user;
}

export async function requirePageRole(role: AuthRole) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/");
  return user;
}

export async function requireProjectAccess(projectId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { clientId: user.clientId ?? "__none__" },
        { access: { some: { userId: user.id } } },
      ],
    },
    select: { id: true },
  });
  if (!project) throw new DomainError("Projeto não encontrado.", "NOT_FOUND");
  return user;
}

export async function requirePageProjectAccess(projectId: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/portal/${encodeURIComponent(projectId)}`);
  return requireProjectAccess(projectId);
}

/**
 * Tópico 35 — autorização de proposta derivada do BANCO, nunca do identificador
 * enviado pelo frontend.
 *
 * O `proposalId` chega da requisição e por si só não prova nada: a função
 * percorre `Proposal → Project → Client` e só então compara com o usuário
 * autenticado. Se o ID não pertence ao cliente, a resposta é idêntica à de um
 * recurso inexistente, para não revelar a existência de dados de terceiros.
 */
export async function requireProposalAccess(proposalId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      project: {
        OR: [
          { clientId: user.clientId ?? "__none__" },
          { access: { some: { userId: user.id } } },
        ],
      },
    },
    select: { id: true },
  });
  if (!proposal) throw new DomainError("Proposta não encontrada.", "NOT_FOUND");
  return user;
}

/**
 * Tópico 35 — mesma garantia para o contrato. O contrato nunca é diretamente
 * acessível ao cliente pelo ID: ele é alcançado pela proposta aprovada que o
 * originou, o que mantém a cadeia cliente → projeto → proposta → contrato.
 */
export async function requireContractAccess(contractId: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
  if (user.role === "ADMIN") return user;
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      proposal: {
        project: {
          OR: [
            { clientId: user.clientId ?? "__none__" },
            { access: { some: { userId: user.id } } },
          ],
        },
      },
    },
    select: { id: true },
  });
  if (!contract) throw new DomainError("Contrato não encontrado.", "NOT_FOUND");
  return user;
}

