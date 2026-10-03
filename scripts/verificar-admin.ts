/**
 * Verificação pontual da conta de ADMIN na base de dados.
 * Ferramenta de diagnóstico local — não faz parte da aplicação.
 *
 * Uso: npx tsx scripts/verificar-admin.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.CHECK_EMAIL;
  if (!email) {
    console.error("Defina CHECK_EMAIL com o e-mail a verificar.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { email: true, name: true, role: true, passwordHash: true, clientId: true, createdAt: true },
  });

  if (!user) {
    console.log("UTILIZADOR NAO EXISTE para", email);
    const todos = await prisma.user.findMany({ select: { email: true, role: true } });
    console.log("Utilizadores na base:", JSON.stringify(todos, null, 2));
    return;
  }

  console.log("UTILIZADOR ENCONTRADO");
  console.log("  email :", user.email);
  console.log("  nome  :", user.name);
  console.log("  role  :", user.role);
  console.log("  hash  :", user.passwordHash.slice(0, 24) + "…");
  console.log("  client:", user.clientId ?? "(nenhum)");

  // Verifica a password com a MESMA função que o login usa. Se aqui passar e
  // o login falhar, o problema é o AUTH_SECRET do servidor, não o hash.
  const senha = process.env.CHECK_PASSWORD;
  if (senha) {
    const { verifyPassword } = await import("../src/lib/password");
    const ok = verifyPassword(senha, user.passwordHash);
    console.log("  verifyPassword:", ok ? "OK" : "FALHOU");
    console.log("  AUTH_SECRET len:", (process.env.AUTH_SECRET ?? "").length);
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
