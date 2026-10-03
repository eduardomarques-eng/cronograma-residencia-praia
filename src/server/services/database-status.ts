import { prisma } from "@/server/db";

export type DatabaseStatus = {
  ok: boolean;
  /** Motivo legível para o ADMIN, sem expor segredos. */
  reason: string;
  /** As tabelas do projecto existem? Distingue "ligação falhou" de "migrations por aplicar". */
  migrationsPending: boolean;
};

/**
 * Diagnóstico da base de dados para o interface.
 *
 * Existe porque uma aplicação sem base de dados é INDENTIFICÁVEL a olho nu:
 * os cartões mostram "—" e parece que a aplicação está quebrada. Aqui
 * distinguimos os três casos reais — sem `DATABASE_URL`, ligação recusada, ou
 * migrations por aplicar — e dizemos qual é.
 *
 * A mensagem nunca inclui a URL: ela carrega utilizador e senha.
 */
export async function checkDatabase(): Promise<DatabaseStatus> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      reason: "A variável DATABASE_URL não está definida neste ambiente.",
      migrationsPending: true,
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    // O erro do Prisma costuma dizer se a tabela não existe (P2021) — que é
    // exatamente o caso "migrations por aplicar".
    const migrationsPending = /P2021|does not exist|relation .* does not exist/i.test(message);
    return {
      ok: false,
      reason: migrationsPending
        ? "A base de dados está acessível, mas as tabelas do projecto ainda não foram criadas."
        : "Não foi possível ligar à base de dados.",
      migrationsPending,
    };
  }

  // Ligação ok. Verificamos se as tabelas existem.
  try {
    await prisma.project.count();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const migrationsPending = /P2021|does not exist/i.test(message);
    return {
      ok: false,
      reason: migrationsPending
        ? "A base de dados está acessível, mas as tabelas do projecto ainda não foram criadas."
        : "A base de dados respondeu, mas a leitura de dados falhou.",
      migrationsPending,
    };
  }

  return { ok: true, reason: "Base de dados conectada.", migrationsPending: false };
}
